import type { PrismaClient } from "@/generated/prisma/client";
import { performanceFromSession, periodStart, progressChange, setVolume, type CompletedExerciseSession, type ProgressPeriod, weeklyBuckets } from "@/server/progress-calculations";

export type ProgressOverview = {
  period: ProgressPeriod;
  totals: { workouts: number; sets: number; minutes: number; volumeKgReps: number | null };
  weekly: Array<{ weekStart: string; workouts: number; sets: number }>;
  primaryMuscles: Array<{ name: string; sets: number }>;
  secondaryMuscles: Array<{ name: string; sets: number }>;
  highlights: Array<{ slug: string; name: string; change: string; current: ReturnType<typeof performanceFromSession>; previous: ReturnType<typeof performanceFromSession> | null }>;
  hasActivity: boolean;
};

function durationMinutes(startedAt: Date, completedAt: Date): number {
  return Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000));
}

function totalVolume(session: CompletedExerciseSession): number | null {
  const volumes = session.sets.map((set) => setVolume(set, session.loadTrackingType, session.loadMultiplier)).filter((value): value is number => value !== null);
  return volumes.length ? volumes.reduce((total, value) => total + value, 0) : null;
}

function toCompletedExerciseSession(item: {
  exerciseId: string; exerciseNameSnapshot: string; loadTrackingTypeSnapshot: string | null; loadEntryModeSnapshot: string | null; loadMultiplierSnapshot: { toString(): string } | null; workoutSession: { completedAt: Date | null; startedAt: Date }; setLogs: Array<{ weightKg: { toString(): string } | null; loadValue: { toString(): string } | null; actualReps: number | null; completedAt: Date | null }>; exercise: { slug: string; muscles: Array<{ role: string; muscle: { name: string } }> };
}): CompletedExerciseSession | null {
  if (!item.workoutSession.completedAt) return null;
  return {
    exerciseId: item.exerciseId, exerciseSlug: item.exercise.slug, exerciseName: item.exerciseNameSnapshot,
    completedAt: item.workoutSession.completedAt, startedAt: item.workoutSession.startedAt,
    loadTrackingType: item.loadTrackingTypeSnapshot as CompletedExerciseSession["loadTrackingType"], loadEntryMode: item.loadEntryModeSnapshot as CompletedExerciseSession["loadEntryMode"], loadMultiplier: item.loadMultiplierSnapshot === null ? 1 : Number(item.loadMultiplierSnapshot),
    primaryMuscles: item.exercise.muscles.filter((relation) => relation.role === "PRIMARY").map((relation) => relation.muscle.name),
    secondaryMuscles: item.exercise.muscles.filter((relation) => relation.role === "SECONDARY").map((relation) => relation.muscle.name),
    sets: item.setLogs.filter((set) => set.completedAt).map((set) => ({ weightKg: set.weightKg === null ? null : Number(set.weightKg), loadValue: set.loadValue === null ? null : Number(set.loadValue), actualReps: set.actualReps })),
  };
}

export async function getProgressOverview(prisma: PrismaClient, period: ProgressPeriod = "8"): Promise<ProgressOverview> {
  const start = periodStart(period);
  const sessions = await prisma.workoutSession.findMany({
    where: { status: "COMPLETED", completedAt: { not: null, ...(start ? { gte: start } : {}) } },
    orderBy: { completedAt: "asc" },
    include: { exerciseSessions: { include: { setLogs: { where: { completedAt: { not: null } } }, exercise: { include: { muscles: { include: { muscle: true } } } } } } },
  });
  const raw = sessions.flatMap((session) => session.exerciseSessions.map((item) => toCompletedExerciseSession({ ...item, workoutSession: session })).filter((item): item is CompletedExerciseSession => item !== null));
  const totals = { workouts: sessions.length, sets: raw.reduce((total, item) => total + item.sets.length, 0), minutes: sessions.reduce((total, session) => total + durationMinutes(session.startedAt, session.completedAt!), 0), volumeKgReps: null as number | null };
  const volumes = raw.map(totalVolume).filter((value): value is number => value !== null); totals.volumeKgReps = volumes.length ? volumes.reduce((total, value) => total + value, 0) : null;
  const primary = new Map<string, number>(); const secondary = new Map<string, number>();
  for (const item of raw) for (let index = 0; index < item.sets.length; index += 1) { item.primaryMuscles.forEach((name) => primary.set(name, (primary.get(name) ?? 0) + 1)); item.secondaryMuscles.forEach((name) => secondary.set(name, (secondary.get(name) ?? 0) + 1)); }
  const weekly = weeklyBuckets(sessions.filter((session): session is typeof session & { completedAt: Date } => session.completedAt !== null), period).map((bucket) => ({ weekStart: bucket.weekStart, workouts: bucket.items.length, sets: bucket.items.reduce((total, session) => total + session.exerciseSessions.reduce((exerciseTotal, exercise) => exerciseTotal + exercise.setLogs.length, 0), 0) }));
  const byExercise = new Map<string, CompletedExerciseSession[]>();
  for (const item of raw) { const key = `${item.exerciseId}:${item.loadTrackingType ?? "LEGACY"}:${item.loadEntryMode ?? "LEGACY"}`; byExercise.set(key, [...(byExercise.get(key) ?? []), item]); }
  const highlights = [...byExercise.values()].map((history) => {
    const ordered = [...history].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime()); const current = performanceFromSession(ordered[0]); const previous = ordered[1] ? performanceFromSession(ordered[1]) : null;
    return { slug: ordered[0].exerciseSlug, name: ordered[0].exerciseName, change: progressChange(current, previous ?? undefined), current, previous };
  }).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8);
  return { period, totals, weekly, primaryMuscles: [...primary.entries()].map(([name, sets]) => ({ name, sets })).sort((a, b) => b.sets - a.sets), secondaryMuscles: [...secondary.entries()].map(([name, sets]) => ({ name, sets })).sort((a, b) => b.sets - a.sets), highlights, hasActivity: sessions.length > 0 };
}

export async function getExerciseHistory(prisma: PrismaClient, slug: string) {
  const exercise = await prisma.exercise.findUnique({ where: { slug, active: true }, include: { media: { orderBy: { sortOrder: "asc" } }, equipment: { include: { media: { orderBy: { sortOrder: "asc" } } } }, muscles: { include: { muscle: true } } } });
  if (!exercise) return null;
  const entries = await prisma.exerciseSession.findMany({ where: { exerciseId: exercise.id, workoutSession: { status: "COMPLETED", completedAt: { not: null } } }, orderBy: { workoutSession: { completedAt: "desc" } }, include: { workoutSession: { select: { completedAt: true, startedAt: true } }, setLogs: { where: { completedAt: { not: null } }, orderBy: { setNumber: "asc" } } } });
  const history = entries.map((entry) => toCompletedExerciseSession({ ...entry, exercise: { slug: exercise.slug, muscles: exercise.muscles } })).filter((item): item is CompletedExerciseSession => item !== null);
  const performances = history.map(performanceFromSession);
  const comparable = performances.filter((performance) => performance.loadTrackingType === exercise.loadTrackingType && performance.loadEntryMode === exercise.loadEntryMode);
  const loaded = comparable.filter((performance) => performance.highestLoadValue !== null);
  return { exercise, history: performances, comparableHistory: comparable, current: comparable[0] ?? null, previous: comparable[1] ?? null, highestLoadValue: loaded.length ? Math.max(...loaded.map((performance) => performance.highestLoadValue!)) : null, highestWeightKg: exercise.loadTrackingType === "KILOGRAM" && loaded.length ? Math.max(...loaded.map((performance) => performance.highestLoadValue!)) : null, highestMachineLevel: exercise.loadTrackingType === "MACHINE_LEVEL" && loaded.length ? Math.max(...loaded.map((performance) => performance.highestLoadValue!)) : null, highestVolumeKgReps: comparable.reduce<number | null>((best, performance) => performance.volumeKgReps !== null && (best === null || performance.volumeKgReps > best) ? performance.volumeKgReps : best, null) };
}
