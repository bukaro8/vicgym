import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { LoadEntryModeValue, LoadTrackingTypeValue } from "@/lib/load-tracking";

export type PreviousSet = { setNumber: number; weightKg: number | null };
export type PreviousTypedSet = { setNumber: number; loadValue: number | null };

export function prefillWeights(setCount: number, previousSets: PreviousSet[]): Array<number | null> {
  const latestWeight = [...previousSets].reverse().find((set) => set.weightKg !== null)?.weightKg ?? null;
  return Array.from({ length: setCount }, (_, index) => previousSets.find((set) => set.setNumber === index + 1)?.weightKg ?? latestWeight);
}

export function prefillLoads(setCount: number, previousSets: PreviousTypedSet[]): Array<number | null> {
  const latestLoad = [...previousSets].reverse().find((set) => set.loadValue !== null)?.loadValue ?? null;
  return Array.from({ length: setCount }, (_, index) => previousSets.find((set) => set.setNumber === index + 1)?.loadValue ?? latestLoad);
}

export async function startWorkout(prisma: PrismaClient, workoutDayId: string, cardioPlanned = false) {
  const existing = await prisma.workoutSession.findFirst({ where: { status: "IN_PROGRESS" }, select: { id: true, exerciseSessions: { orderBy: { position: "asc" }, take: 1, select: { id: true } } } });
  if (existing) return { ...existing, resumed: true };

  try {
    return await prisma.$transaction(async (tx) => {
      const day = await tx.workoutDay.findUnique({
        where: { id: workoutDayId },
        include: {
          programVersion: { include: { program: true } },
          workoutExercises: { orderBy: { position: "asc" }, include: { exercise: true } },
        },
      });
      const settings = await tx.appSettings.findUnique({ where: { id: 1 }, select: { activeProgramId: true } });
      if (!day || settings?.activeProgramId !== day.programVersion.programId || day.programVersion.program.activeVersionId !== day.programVersionId || day.programVersion.program.status !== "ACTIVE") throw new Error("WORKOUT_DAY_NOT_ACTIVE");

      const previousByExercise = new Map<string, PreviousTypedSet[]>();
      await Promise.all(day.workoutExercises.map(async (planned) => {
        const isLegacy = planned.loadTrackingTypeSnapshot === null || planned.loadEntryModeSnapshot === null;
        const trackingType = isLegacy ? null : planned.loadTrackingTypeSnapshot;
        const entryMode = isLegacy ? null : planned.loadEntryModeSnapshot;
        const previous = await tx.exerciseSession.findFirst({
          where: {
            exerciseId: planned.exerciseId,
            workoutSession: { status: "COMPLETED" },
            loadTrackingTypeSnapshot: trackingType,
            loadEntryModeSnapshot: entryMode,
          },
          orderBy: { workoutSession: { completedAt: "desc" } },
          include: { setLogs: { where: { completedAt: { not: null } }, orderBy: { setNumber: "asc" } } },
        });
        previousByExercise.set(planned.exerciseId, previous?.setLogs.map((set) => ({ setNumber: set.setNumber, loadValue: isLegacy ? (set.weightKg === null ? null : Number(set.weightKg)) : (set.loadValue === null ? null : Number(set.loadValue)) })) ?? []);
      }));

      return tx.workoutSession.create({
        data: {
          programVersionId: day.programVersionId,
          workoutDayId: day.id,
          workoutDayNameSnapshot: day.name,
          cardioPlanned,
          exerciseSessions: {
            create: day.workoutExercises.map((planned) => {
              const isLegacy = planned.loadTrackingTypeSnapshot === null || planned.loadEntryModeSnapshot === null;
              const prefilled = prefillLoads(planned.sets, previousByExercise.get(planned.exerciseId) ?? []);
              const trackingType = planned.loadTrackingTypeSnapshot as LoadTrackingTypeValue | null;
              const entryMode = planned.loadEntryModeSnapshot as LoadEntryModeValue | null;
              return {
              exerciseId: planned.exerciseId,
              position: planned.position,
              exerciseNameSnapshot: planned.exercise.name,
              plannedSets: planned.sets,
              targetReps: planned.targetReps,
              restSeconds: planned.restSeconds,
              autoRest: planned.autoRest,
              loadTrackingTypeSnapshot: trackingType,
              loadEntryModeSnapshot: entryMode,
              loadMultiplierSnapshot: isLegacy ? null : planned.exercise.loadMultiplier,
              setLogs: {
                create: prefilled.map((loadValue, index) => ({
                  setNumber: index + 1,
                  targetReps: planned.targetReps,
                  actualReps: planned.targetReps,
                  weightKg: isLegacy ? (loadValue ?? planned.plannedWeightKg) : null,
                  loadValue: isLegacy ? null : (loadValue ?? planned.plannedLoadValue),
                  loadTrackingType: trackingType,
                })),
              },
            };
            }),
          },
        },
        select: { id: true, exerciseSessions: { orderBy: { position: "asc" }, take: 1, select: { id: true } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      const winner = await prisma.workoutSession.findFirst({ where: { status: "IN_PROGRESS" }, select: { id: true, exerciseSessions: { orderBy: { position: "asc" }, take: 1, select: { id: true } } } });
      if (winner) return { ...winner, resumed: true };
    }
    throw error;
  }
}
