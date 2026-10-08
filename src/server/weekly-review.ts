import { effortLabel, type SetEffortValue } from "@/lib/set-effort";
import type { PrismaClient } from "@/generated/prisma/client";
import { formatLoad, jsonLoadType, type LoadEntryModeValue, type LoadTrackingTypeValue } from "@/lib/load-tracking";
import { completedWorkoutDurationMinutes } from "@/lib/workout-duration";
import { getActiveProgramme } from "@/server/active-programme";
import { coachReviewGuidance } from "@/server/coach-review-guidance";

const LONDON = "Europe/London";

export type WeekRange = { start: Date; end: Date; startDate: string; endDate: string };

type ReportSet = { effort?: SetEffortValue | null; setNumber: number; actualReps: number | null; targetReps: number; weightKg: number | null; loadValue: number | null; loadTrackingType: LoadTrackingTypeValue | null; loadEntryMode: LoadEntryModeValue | null; notes: string | null };
type ReportExercise = { slug: string; name: string; targetReps: number; restSeconds: number; notes: string | null; sets: ReportSet[]; primary: string[]; secondary: string[]; progression: string };
export type WeeklyReview = { weekStart: string; weekEnd: string; report: string; isEmpty: boolean; completedSessions: number; workingSets: number; programSlug: string | null; versionNumber: number | null };

function parts(date: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
}

function localDate(date: Date): string {
  const value = parts(date);
  return `${value.year}-${value.month}-${value.day}`;
}

function asUtcAtLondonMidnight(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  const intended = Date.UTC(year, month - 1, day);
  const displayed = parts(new Date(intended));
  const displayedAsUtc = Date.UTC(Number(displayed.year), Number(displayed.month) - 1, Number(displayed.day), Number(displayed.hour), Number(displayed.minute));
  return new Date(intended - (displayedAsUtc - intended));
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function londonWeekRange(weekStart?: string, now = new Date()): WeekRange {
  let startDate = weekStart;
  if (!startDate) {
    const today = parts(now);
    const offset = Math.max(0, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(today.weekday));
    const currentWeekStart = addDays(`${today.year}-${today.month}-${today.day}`, -offset);
    startDate = addDays(currentWeekStart, -7);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || new Date(`${startDate}T00:00:00.000Z`).getUTCDay() !== 1) throw new Error("INVALID_WEEK");
  const endDate = addDays(startDate, 7);
  return { start: asUtcAtLondonMidnight(startDate), end: asUtcAtLondonMidnight(endDate), startDate, endDate };
}

function comparePerformance(current: ReportSet[], previous: ReportSet[] | undefined): string {
  if (!previous?.length || !current.length) return "insufficient history";
  if (current[0].loadTrackingType !== previous[0].loadTrackingType || current[0].loadEntryMode !== previous[0].loadEntryMode) return "insufficient compatible history";
  const sumReps = (sets: ReportSet[]) => sets.reduce((total, set) => total + (set.actualReps ?? 0), 0);
  const maxLoad = (sets: ReportSet[]) => Math.max(...sets.map((set) => (set.loadTrackingType === null ? set.weightKg : set.loadValue) ?? 0));
  const currentLoad = maxLoad(current); const previousLoad = maxLoad(previous); const machine = current[0].loadTrackingType === "MACHINE_LEVEL";
  if (currentLoad > previousLoad) return machine ? "machine level increased" : "weight increased";
  if (currentLoad < previousLoad) return machine ? "machine level decreased" : "performance decreased";
  if (sumReps(current) > sumReps(previous)) return machine ? "same machine level, more reps" : "same weight, more reps";
  if (sumReps(current) < sumReps(previous)) return "performance decreased";
  return "same performance";
}

function reportLoad(set: ReportSet): string { return formatLoad(set.loadTrackingType, set.loadEntryMode, set.loadValue, { blank: "not entered", legacyWeightKg: set.weightKg }); }
export async function getWeeklyReview(prisma: PrismaClient, userId: string, requestedWeek?: string): Promise<WeeklyReview> {
  const range = londonWeekRange(requestedWeek);
  const sessions = await prisma.workoutSession.findMany({
    where: { userId, status: "COMPLETED", completedAt: { gte: range.start, lt: range.end } },
    orderBy: { completedAt: "asc" },
    include: {
      programVersion: { include: { program: true } },
      workoutDay: { select: { slug: true } },
      exerciseSessions: { orderBy: { position: "asc" }, include: { setLogs: { orderBy: { setNumber: "asc" }, include: { restPeriod: true } }, exercise: { include: { muscles: { include: { muscle: true } } } } } },
    },
  });
  const activeProgram = await getActiveProgramme(prisma, userId);
  const profile = await prisma.onboardingProfile.findUnique({ where: { userId }, select: { goal: true, sessionLengthMinutes: true, trainingPreferences: true, hasLimitations: true, limitationsText: true, personalPriorities: true, additionalNotes: true } });
  const availableExercises = await prisma.exercise.findMany({
    where: { active: true },
    orderBy: [{ equipment: { type: "asc" } }, { name: "asc" }],
    include: { equipment: { select: { available: true, type: true, name: true } }, muscles: { include: { muscle: true } } },
  });
  const currentVersion = activeProgram?.activeVersion ?? null;
  const versions = activeProgram && currentVersion ? await prisma.programVersion.findMany({ where: { programId: activeProgram.id, program: { userId }, versionNumber: { lte: currentVersion.versionNumber } }, orderBy: { versionNumber: "desc" }, take: 3, include: { days: { orderBy: { rotationOrder: "asc" }, include: { workoutExercises: { orderBy: { position: "asc" }, include: { exercise: true } } } } } }) : [];
  const lines = ["# VicGym weekly review", "", "## CURRENT PROGRAMME"];

  if (activeProgram && currentVersion) {
    lines.push(`Programme: ${activeProgram.name} [${activeProgram.slug}]`, `Programme version: ${currentVersion.versionNumber}`, "", "Workout days:", ...currentVersion.days.map((day) => `- ${day.name} [${day.slug}]`), "", "Default target reps: 12");
  } else {
    lines.push("No active programme is currently confirmed.", "Weekly schemaVersion 1 changes cannot be imported until a programme is active.", "An initial programme may be created with validated schemaVersion 2 JSON.");
  }
  if (currentVersion) {
    lines.push("", "Current planned exercise slots (not completed training):");
    for (const day of currentVersion.days) for (const item of day.workoutExercises) lines.push(`- ${day.slug}: ${item.exercise.slug} · position ${item.position} · ${item.sets} × ${item.targetReps} · rest ${item.restSeconds}s · autoRest ${item.autoRest} · ${formatLoad(item.loadTrackingTypeSnapshot as LoadTrackingTypeValue | null, item.loadEntryModeSnapshot as LoadEntryModeValue | null, item.plannedLoadValue == null ? null : Number(item.plannedLoadValue), { legacyWeightKg: item.plannedWeightKg == null ? null : Number(item.plannedWeightKg), blank: "not entered" })}`);
    lines.push("", "Recent programme composition (up to 3 versions; creation is not training exposure):");
    for (const version of versions) lines.push(`- Version ${version.versionNumber} · ${localDate(version.createdAt)}: ${version.days.map((day) => `${day.slug} [${day.workoutExercises.map((item) => item.exercise.slug).join(", ")}]`).join("; ")}${version.notes ? ` · Notes: ${version.notes}` : ""}`);
  }
  if (profile) lines.push("", "Stored coaching context (user answers; preserve existing coaching constraints):", `Goal: ${profile.goal ?? "not recorded"} · Session length: ${profile.sessionLengthMinutes ?? "not recorded"} minutes`, `Preferences: ${profile.trainingPreferences ?? "not recorded"}`, `Limitations: ${profile.limitationsText ?? (profile.hasLimitations ? "Reported; details not recorded" : "None reported")}`, `Priorities: ${profile.personalPriorities ?? "not recorded"}`, `Notes: ${profile.additionalNotes ?? "not recorded"}`);
  lines.push("", "## WEEK", `${range.startDate} to ${addDays(range.endDate, -1)}`, `Timezone: ${LONDON}`, "", "## TRAINING");

  const historyCache = new Map<string, ReportSet[]>();
  const exerciseIds = [...new Set([...sessions.flatMap((session) => session.exerciseSessions.map((exercise) => exercise.exerciseId)), ...(currentVersion?.days.flatMap((day) => day.workoutExercises.map((item) => item.exerciseId)) ?? [])].filter(Boolean))];
  const history = exerciseIds.length ? await prisma.exerciseSession.findMany({ where: { exerciseId: { in: exerciseIds }, workoutSession: { userId, status: "COMPLETED", completedAt: { gte: new Date(range.start.getTime() - 84 * 86400000), lt: range.end } } }, orderBy: [{ workoutSession: { completedAt: "asc" } }, { id: "asc" }], include: { workoutSession: { select: { completedAt: true, programVersion: { select: { versionNumber: true, program: { select: { slug: true } } } } } }, exercise: { select: { slug: true } }, setLogs: { where: { completedAt: { not: null } }, orderBy: { setNumber: "asc" } } } }) : [];
  const previous = new Map<string, ReportSet[]>();
  for (const item of history) {
    const key = `${item.exerciseId}:${item.loadTrackingTypeSnapshot}:${item.loadEntryModeSnapshot}`;
    historyCache.set(item.id, previous.get(key) ?? []);
    previous.set(key, item.setLogs.map((set) => ({ setNumber: set.setNumber, actualReps: set.actualReps, targetReps: set.targetReps, weightKg: set.weightKg === null ? null : Number(set.weightKg), loadValue: set.loadValue === null ? null : Number(set.loadValue), loadTrackingType: item.loadTrackingTypeSnapshot as LoadTrackingTypeValue | null, loadEntryMode: item.loadEntryModeSnapshot as LoadEntryModeValue | null, notes: set.notes, effort: set.effort })));
  }

  let completedSets = 0; let totalMinutes = 0; let cardioSeconds = 0; let volume = 0; let incomplete = 0; let skippedExercises = 0; let skippedRests = 0; let completedRests = 0; let completedRestSeconds = 0; let adjustedRestSeconds = 0;
  const primaryTotals = new Map<string, number>(); const secondaryTotals = new Map<string, number>();
  if (!sessions.length) lines.push("No completed workouts in this week.");

  for (const session of sessions) {
    lines.push("", `### ${session.workoutDayNameSnapshot} [${session.workoutDay.slug}]`, `Completed: ${localDate(session.completedAt!)} · Programme version ${session.programVersion.versionNumber}`);
    const minutes = completedWorkoutDurationMinutes(session); if (minutes) totalMinutes += minutes;
    if (session.cardioPlanned) { cardioSeconds += session.cardioDurationSeconds; lines.push(`Cardio: ${session.cardioDurationSeconds ? `${Math.floor(session.cardioDurationSeconds / 60)} min ${session.cardioDurationSeconds % 60} sec` : "planned but not recorded"}`); }
    for (const item of session.exerciseSessions) {
      const sets: ReportSet[] = item.setLogs.filter((set) => set.completedAt).map((set) => ({ setNumber: set.setNumber, actualReps: set.actualReps, targetReps: set.targetReps, weightKg: set.weightKg === null ? null : Number(set.weightKg), loadValue: set.loadValue === null ? null : Number(set.loadValue), loadTrackingType: item.loadTrackingTypeSnapshot as LoadTrackingTypeValue | null, loadEntryMode: item.loadEntryModeSnapshot as LoadEntryModeValue | null, notes: set.notes, effort: set.effort }));
      const primary = item.exercise.muscles.filter((muscle) => muscle.role === "PRIMARY").map((muscle) => muscle.muscle.name);
      const secondary = item.exercise.muscles.filter((muscle) => muscle.role === "SECONDARY").map((muscle) => muscle.muscle.name);
      const exercise: ReportExercise = { slug: item.exercise.slug, name: item.exerciseNameSnapshot, targetReps: item.targetReps, restSeconds: item.restSeconds, notes: item.notes, sets, primary, secondary, progression: comparePerformance(sets, historyCache.get(item.id)) };
      lines.push("", `${exercise.name} [${exercise.slug}]${item.isAdHoc ? " · Extra/ad-hoc exercise" : ""}`, `Target reps: ${exercise.targetReps}`, `Configured rest: ${exercise.restSeconds} sec`, `Primary muscle: ${primary.join(", ") || "—"}`, `Secondary muscles: ${secondary.join(", ") || "—"}`);
      if (sets.length) {
        for (const set of sets) {
          lines.push(`- Set ${set.setNumber}: ${reportLoad(set)} × ${set.actualReps ?? set.targetReps}${set.effort ? ` · Effort: ${effortLabel[set.effort]}` : ""}${set.notes ? ` · Note: ${set.notes}` : ""}`);
          completedSets += 1; const kilograms = set.loadTrackingType === "KILOGRAM" ? set.loadValue : set.loadTrackingType === null ? set.weightKg : null; if (kilograms !== null && set.actualReps !== null) volume += kilograms * set.actualReps * Number(item.loadMultiplierSnapshot ?? 1);
          primary.forEach((muscle) => primaryTotals.set(muscle, (primaryTotals.get(muscle) ?? 0) + 1)); secondary.forEach((muscle) => secondaryTotals.set(muscle, (secondaryTotals.get(muscle) ?? 0) + 1));
        }
      } else lines.push("- No completed sets recorded.");
      const missed = Math.max(0, item.plannedSets - sets.length); if (missed) incomplete += missed; if (!sets.length) skippedExercises += 1;
      lines.push(`Progression: ${exercise.progression}`);
      for (const set of item.setLogs) {
        if (set.restPeriod?.status === "SKIPPED") skippedRests += 1;
        if (set.restPeriod?.status === "COMPLETED" && set.restPeriod.completedAt) {
          completedRests += 1;
          completedRestSeconds += Math.max(0, Math.round((set.restPeriod.completedAt.getTime() - set.restPeriod.startedAt.getTime()) / 1000));
        }
        const adjustments = Array.isArray(set.restPeriod?.adjustments) ? set.restPeriod.adjustments : [];
        for (const adjustment of adjustments) if (typeof adjustment === "object" && adjustment && "seconds" in adjustment && typeof adjustment.seconds === "number") adjustedRestSeconds += adjustment.seconds;
      }
    }
  }
  lines.push("", "## SUMMARY", `Workouts completed: ${sessions.length}`, `Completed working sets: ${completedSets}`, `Recorded training time: ${totalMinutes} min`, `Cardio time: ${Math.floor(cardioSeconds / 60)} min ${cardioSeconds % 60} sec`, `Logged external-load volume: ${volume ? `${volume.toFixed(1)} kg-reps` : "not available"}`, `Incomplete / missed planned sets: ${incomplete}`, `Skipped exercises: ${skippedExercises}`, `Direct working sets by primary muscle: ${[...primaryTotals.entries()].map(([name, count]) => `${name} ${count}`).join(", ") || "none"}`, `Secondary-muscle involvement sets: ${[...secondaryTotals.entries()].map(([name, count]) => `${name} ${count}`).join(", ") || "none"}`);
  if (skippedRests || completedRests || adjustedRestSeconds) lines.push("", "## REST INFORMATION", `Completed rest periods: ${completedRests}${completedRests ? ` · average elapsed ${Math.round(completedRestSeconds / completedRests)} sec` : ""}`, `Skipped rest periods: ${skippedRests}`, `Net manual rest adjustment: ${adjustedRestSeconds >= 0 ? "+" : ""}${adjustedRestSeconds} sec`);
  lines.push("", "## RECENT COMPARABLE HISTORY", "Up to 3 completed exposures per exercise/load type/entry mode from this week and the preceding 12 weeks. Missing ratings/loads/reps remain unknown; current-week exposures may also appear above.");
  const recent = new Map<string, typeof history>();
  for (const item of history) { const key = `${item.exerciseId}:${item.loadTrackingTypeSnapshot}:${item.loadEntryModeSnapshot}`; recent.set(key, [...(recent.get(key) ?? []), item].slice(-3)); }
  for (const entries of recent.values()) for (const item of entries) lines.push(`- ${item.exercise.slug} · ${localDate(item.workoutSession.completedAt!)} · ${item.workoutSession.programVersion.program.slug} v${item.workoutSession.programVersion.versionNumber} · ${item.loadTrackingTypeSnapshot ?? "LEGACY"}/${item.loadEntryModeSnapshot ?? "LEGACY"} · ${item.setLogs.length}/${item.plannedSets} sets · rest ${item.restSeconds}s: ${item.setLogs.map((set) => `S${set.setNumber} ${formatLoad(item.loadTrackingTypeSnapshot as LoadTrackingTypeValue | null, item.loadEntryModeSnapshot as LoadEntryModeValue | null, set.loadValue === null ? null : Number(set.loadValue), { legacyWeightKg: set.weightKg === null ? null : Number(set.weightKg), blank: "unknown load" })} × ${set.actualReps ?? "unknown"}/${set.targetReps} target · ${set.effort ? effortLabel[set.effort] : "unrated"}`).join("; ")}${item.notes ? ` · Notes: ${item.notes}` : ""}`);
  if (!recent.size) lines.push("No recent comparable exposures available. Do not infer a trend.");
  const categories = new Map<string, string[]>();
  for (const exercise of availableExercises) {
    if (exercise.equipment && !exercise.equipment.available) continue;
    const category = exercise.equipment?.type === "DUMBBELL" ? "Dumbbells" : exercise.equipment?.type === "BODYWEIGHT" || !exercise.equipment ? "Bodyweight / no equipment" : exercise.equipment?.type === "STEP" ? "Studio accessories" : "Machines";
    categories.set(category, [...(categories.get(category) ?? []), exercise.slug]);
  }
  lines.push("", "## VALID VICGYM EXERCISES", "Use only these currently available exercise slugs:", ...[...categories.entries()].map(([category, slugs]) => `- ${category}: ${slugs.join(", ")}`), "", ...availableExercises.filter((exercise) => !exercise.equipment || exercise.equipment.available).map((exercise) => `- ${exercise.slug}: ${exercise.name} · primary ${(exercise.muscles ?? []).filter((relation) => relation.role === "PRIMARY").map((relation) => relation.muscle.name).join(", ") || "not recorded"} · ${exercise.equipment?.name ?? "no equipment"} · ${exercise.loadTrackingType}/${exercise.loadEntryMode}`), "", coachReviewGuidance, "", "## VICGYM COACH RESPONSE");
  if (activeProgram && currentVersion) {
    const exampleDay = currentVersion.days[0];
    const exampleItem = exampleDay?.workoutExercises[0];
    const exampleExercise = exampleItem?.exercise.slug ?? availableExercises.find((exercise) => !exercise.equipment || exercise.equipment.available)?.slug;
    if (!exampleDay || !exampleExercise || !exampleItem) throw new Error("ACTIVE_PROGRAMME_IDENTIFIERS_UNAVAILABLE");
    const exampleType = jsonLoadType(exampleItem.exercise.loadTrackingType as LoadTrackingTypeValue);
    const exampleValue = exampleItem.plannedLoadValue === null ? null : Number(exampleItem.plannedLoadValue);
    const exampleLoad = exampleType && exampleValue !== null ? { type: exampleType, value: exampleValue } : null;
    lines.push("After reviewing this week, provide your normal coaching assessment.", "", "If programme changes are recommended, finish your response with a section named VICGYM_IMPORT containing one valid JSON code block.", "Use only the programme, workout-day and exercise slugs listed in this report. Copy program and baseVersion exactly. Do not invent identifiers. Only include items that need changing. If no changes are required, return changes: [].", "", "```json", JSON.stringify({ schemaVersion: 1, program: activeProgram.slug, baseVersion: currentVersion.versionNumber, changes: [] }, null, 2), "```", "", "Supported change shape:", "```json", JSON.stringify({ action: "upsert", day: exampleDay.slug, exercise: exampleExercise, sets: 3, targetReps: 12, load: exampleLoad, restSeconds: 120, autoRest: true, position: 1 }, null, 2), "```", "", "Use load.type machineLevel for selector levels and kg for kilogram exercises. Do not use weightKg for machine-level exercises.", "", "Removal:", "```json", JSON.stringify({ action: "remove", day: exampleDay.slug, exercise: exampleExercise }, null, 2), "```");
    lines.push("", 'To add a workout day, include a change with action "add-day" and a day object containing slug, name, rotationOrder and exercises. This is the only exception to using existing day slugs: choose a new lowercase hyphenated slug and an unused rotationOrder from 1–20. Include at least one exercise with exercise, sets, targetReps, load (null if unknown), restSeconds, autoRest and unique position. Use only listed catalogue exercise slugs. Configure the new day entirely inside add-day. Do not use schemaVersion 2 for additions to this programme.');
  } else {
    lines.push("No active programme is currently confirmed, so programme changes cannot be imported. You may provide a coaching assessment only.");
  }
  return { weekStart: range.startDate, weekEnd: range.endDate, report: lines.join("\n"), isEmpty: !sessions.length, completedSessions: sessions.length, workingSets: completedSets, programSlug: activeProgram?.slug ?? null, versionNumber: currentVersion?.versionNumber ?? null };
}
