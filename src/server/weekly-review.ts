import type { PrismaClient } from "@/generated/prisma/client";
import { formatLoad, jsonLoadType, type LoadEntryModeValue, type LoadTrackingTypeValue } from "@/lib/load-tracking";
import { getActiveProgramme } from "@/server/active-programme";

const LONDON = "Europe/London";

export type WeekRange = { start: Date; end: Date; startDate: string; endDate: string };

type ReportSet = { setNumber: number; actualReps: number | null; targetReps: number; weightKg: number | null; loadValue: number | null; loadTrackingType: LoadTrackingTypeValue | null; loadEntryMode: LoadEntryModeValue | null; notes: string | null };
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
    startDate = addDays(`${today.year}-${today.month}-${today.day}`, -offset);
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
function durationMinutes(startedAt: Date, completedAt: Date | null): number | null { return completedAt ? Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000)) : null; }

export async function getWeeklyReview(prisma: PrismaClient, requestedWeek?: string): Promise<WeeklyReview> {
  const range = londonWeekRange(requestedWeek);
  const sessions = await prisma.workoutSession.findMany({
    where: { status: "COMPLETED", completedAt: { gte: range.start, lt: range.end } },
    orderBy: { completedAt: "asc" },
    include: {
      programVersion: { include: { program: true } },
      workoutDay: { select: { slug: true } },
      exerciseSessions: { orderBy: { position: "asc" }, include: { setLogs: { orderBy: { setNumber: "asc" }, include: { restPeriod: true } }, exercise: { include: { muscles: { include: { muscle: true } } } } } },
    },
  });
  const activeProgram = await getActiveProgramme(prisma);
  const availableExercises = await prisma.exercise.findMany({
    where: { active: true },
    orderBy: [{ equipment: { type: "asc" } }, { name: "asc" }],
    include: { equipment: { select: { available: true, type: true } } },
  });
  const currentVersion = activeProgram?.activeVersion ?? null;
  const lines = ["# VicGym weekly review", "", "## CURRENT PROGRAMME"];

  if (activeProgram && currentVersion) {
    lines.push(`Programme: ${activeProgram.name} [${activeProgram.slug}]`, `Programme version: ${currentVersion.versionNumber}`, "", "Workout days:", ...currentVersion.days.map((day) => `- ${day.name} [${day.slug}]`), "", "Default target reps: 12");
  } else {
    lines.push("No active programme is currently confirmed.", "Weekly schemaVersion 1 changes cannot be imported until a programme is active.", "An initial programme may be created with validated schemaVersion 2 JSON.");
  }
  lines.push("", "## WEEK", `${range.startDate} to ${addDays(range.endDate, -1)}`, `Timezone: ${LONDON}`, "", "## TRAINING");

  const historyCache = new Map<string, ReportSet[]>();
  const exerciseIds = [...new Set(sessions.flatMap((session) => session.exerciseSessions.map((exercise) => exercise.exerciseId)))];
  await Promise.all(exerciseIds.map(async (exerciseId) => {
    const history = await prisma.exerciseSession.findMany({ where: { exerciseId, workoutSession: { status: "COMPLETED" } }, orderBy: { workoutSession: { completedAt: "asc" } }, include: { workoutSession: { select: { completedAt: true } }, setLogs: { where: { completedAt: { not: null } }, orderBy: { setNumber: "asc" } } } });
    for (let index = 0; index < history.length; index += 1) {
      const item = history[index];
      const prior = history.slice(0, index).reverse().find((candidate) => candidate.loadTrackingTypeSnapshot === item.loadTrackingTypeSnapshot && candidate.loadEntryModeSnapshot === item.loadEntryModeSnapshot);
      historyCache.set(item.id, prior ? prior.setLogs.map((set) => ({ setNumber: set.setNumber, actualReps: set.actualReps, targetReps: set.targetReps, weightKg: set.weightKg === null ? null : Number(set.weightKg), loadValue: set.loadValue === null ? null : Number(set.loadValue), loadTrackingType: prior.loadTrackingTypeSnapshot as LoadTrackingTypeValue | null, loadEntryMode: prior.loadEntryModeSnapshot as LoadEntryModeValue | null, notes: set.notes })) : []);
    }
  }));

  let completedSets = 0; let totalMinutes = 0; let cardioSeconds = 0; let volume = 0; let incomplete = 0; let skippedExercises = 0; let skippedRests = 0; let completedRests = 0; let completedRestSeconds = 0; let adjustedRestSeconds = 0;
  const primaryTotals = new Map<string, number>(); const secondaryTotals = new Map<string, number>();
  if (!sessions.length) lines.push("No completed workouts in this week.");

  for (const session of sessions) {
    lines.push("", `### ${session.workoutDayNameSnapshot} [${session.workoutDay.slug}]`, `Completed: ${localDate(session.completedAt!)} · Programme version ${session.programVersion.versionNumber}`);
    const minutes = durationMinutes(session.startedAt, session.completedAt); if (minutes) totalMinutes += minutes;
    if (session.cardioPlanned) { cardioSeconds += session.cardioDurationSeconds; lines.push(`Cardio: ${session.cardioDurationSeconds ? `${Math.floor(session.cardioDurationSeconds / 60)} min ${session.cardioDurationSeconds % 60} sec` : "planned but not recorded"}`); }
    for (const item of session.exerciseSessions) {
      const sets: ReportSet[] = item.setLogs.filter((set) => set.completedAt).map((set) => ({ setNumber: set.setNumber, actualReps: set.actualReps, targetReps: set.targetReps, weightKg: set.weightKg === null ? null : Number(set.weightKg), loadValue: set.loadValue === null ? null : Number(set.loadValue), loadTrackingType: item.loadTrackingTypeSnapshot as LoadTrackingTypeValue | null, loadEntryMode: item.loadEntryModeSnapshot as LoadEntryModeValue | null, notes: set.notes }));
      const primary = item.exercise.muscles.filter((muscle) => muscle.role === "PRIMARY").map((muscle) => muscle.muscle.name);
      const secondary = item.exercise.muscles.filter((muscle) => muscle.role === "SECONDARY").map((muscle) => muscle.muscle.name);
      const exercise: ReportExercise = { slug: item.exercise.slug, name: item.exerciseNameSnapshot, targetReps: item.targetReps, restSeconds: item.restSeconds, notes: item.notes, sets, primary, secondary, progression: comparePerformance(sets, historyCache.get(item.id)) };
      lines.push("", `${exercise.name} [${exercise.slug}]`, `Target reps: ${exercise.targetReps}`, `Configured rest: ${exercise.restSeconds} sec`, `Primary muscle: ${primary.join(", ") || "—"}`, `Secondary muscles: ${secondary.join(", ") || "—"}`);
      if (sets.length) {
        for (const set of sets) {
          lines.push(`- Set ${set.setNumber}: ${reportLoad(set)} × ${set.actualReps ?? set.targetReps}${set.notes ? ` · Note: ${set.notes}` : ""}`);
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
  lines.push("", "## SUMMARY", `Workouts completed: ${sessions.length}`, `Completed working sets: ${completedSets}`, `Whole-session duration: ${totalMinutes} min`, `Cardio time: ${Math.floor(cardioSeconds / 60)} min ${cardioSeconds % 60} sec`, `Logged external-load volume: ${volume ? `${volume.toFixed(1)} kg-reps` : "not available"}`, `Incomplete / missed planned sets: ${incomplete}`, `Skipped exercises: ${skippedExercises}`, `Direct working sets by primary muscle: ${[...primaryTotals.entries()].map(([name, count]) => `${name} ${count}`).join(", ") || "none"}`, `Secondary-muscle involvement sets: ${[...secondaryTotals.entries()].map(([name, count]) => `${name} ${count}`).join(", ") || "none"}`);
  if (skippedRests || completedRests || adjustedRestSeconds) lines.push("", "## REST INFORMATION", `Completed rest periods: ${completedRests}${completedRests ? ` · average elapsed ${Math.round(completedRestSeconds / completedRests)} sec` : ""}`, `Skipped rest periods: ${skippedRests}`, `Net manual rest adjustment: ${adjustedRestSeconds >= 0 ? "+" : ""}${adjustedRestSeconds} sec`);
  const categories = new Map<string, string[]>();
  for (const exercise of availableExercises) {
    if (exercise.equipment && !exercise.equipment.available) continue;
    const category = exercise.equipment?.type === "DUMBBELL" ? "Dumbbells" : exercise.equipment?.type === "BODYWEIGHT" || !exercise.equipment ? "Bodyweight / no equipment" : exercise.equipment?.type === "STEP" ? "Studio accessories" : "Machines";
    categories.set(category, [...(categories.get(category) ?? []), exercise.slug]);
  }
  lines.push("", "## VALID VICGYM EXERCISES", "Use only these currently available exercise slugs:", ...[...categories.entries()].map(([category, slugs]) => `- ${category}: ${slugs.join(", ")}`), "", "## VICGYM COACH RESPONSE");
  if (activeProgram && currentVersion) {
    const exampleDay = currentVersion.days[0];
    const exampleItem = exampleDay?.workoutExercises[0];
    const exampleExercise = exampleItem?.exercise.slug ?? availableExercises.find((exercise) => !exercise.equipment || exercise.equipment.available)?.slug;
    if (!exampleDay || !exampleExercise || !exampleItem) throw new Error("ACTIVE_PROGRAMME_IDENTIFIERS_UNAVAILABLE");
    const exampleType = jsonLoadType(exampleItem.exercise.loadTrackingType as LoadTrackingTypeValue);
    const exampleValue = exampleItem.plannedLoadValue === null ? null : Number(exampleItem.plannedLoadValue);
    const exampleLoad = exampleType && exampleValue !== null ? { type: exampleType, value: exampleValue } : null;
    lines.push("After reviewing this week, provide your normal coaching assessment.", "", "If programme changes are recommended, finish your response with a section named VICGYM_IMPORT containing one valid JSON code block.", "Use only the programme, workout-day and exercise slugs listed in this report. Copy program and baseVersion exactly. Do not invent identifiers. Only include items that need changing. If no changes are required, return changes: [].", "", "```json", JSON.stringify({ schemaVersion: 1, program: activeProgram.slug, baseVersion: currentVersion.versionNumber, changes: [] }, null, 2), "```", "", "Supported change shape:", "```json", JSON.stringify({ action: "upsert", day: exampleDay.slug, exercise: exampleExercise, sets: 3, targetReps: 12, load: exampleLoad, restSeconds: 120, autoRest: true, position: 1 }, null, 2), "```", "", "Use load.type machineLevel for selector levels and kg for kilogram exercises. Do not use weightKg for machine-level exercises.", "", "Removal:", "```json", JSON.stringify({ action: "remove", day: exampleDay.slug, exercise: exampleExercise }, null, 2), "```");
  } else {
    lines.push("No active programme is currently confirmed, so programme changes cannot be imported. You may provide a coaching assessment only.");
  }
  return { weekStart: range.startDate, weekEnd: range.endDate, report: lines.join("\n"), isEmpty: !sessions.length, completedSessions: sessions.length, workingSets: completedSets, programSlug: activeProgram?.slug ?? null, versionNumber: currentVersion?.versionNumber ?? null };
}
