import { Prisma, type PrismaClient } from "@/generated/prisma/client";

export type PreviousSet = { setNumber: number; weightKg: number | null };

export function prefillWeights(setCount: number, previousSets: PreviousSet[]): Array<number | null> {
  const latestWeight = [...previousSets].reverse().find((set) => set.weightKg !== null)?.weightKg ?? null;
  return Array.from({ length: setCount }, (_, index) => previousSets.find((set) => set.setNumber === index + 1)?.weightKg ?? latestWeight);
}

export async function startWorkout(prisma: PrismaClient, workoutDayId: string) {
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
      if (!day || day.programVersion.program.activeVersionId !== day.programVersionId || day.programVersion.program.status !== "ACTIVE") throw new Error("WORKOUT_DAY_NOT_ACTIVE");

      const previousByExercise = new Map<string, PreviousSet[]>();
      await Promise.all(day.workoutExercises.map(async (planned) => {
        const previous = await tx.exerciseSession.findFirst({
          where: { exerciseId: planned.exerciseId, workoutSession: { status: "COMPLETED" } },
          orderBy: { workoutSession: { completedAt: "desc" } },
          include: { setLogs: { where: { completedAt: { not: null } }, orderBy: { setNumber: "asc" } } },
        });
        previousByExercise.set(planned.exerciseId, previous?.setLogs.map((set) => ({ setNumber: set.setNumber, weightKg: set.weightKg === null ? null : Number(set.weightKg) })) ?? []);
      }));

      return tx.workoutSession.create({
        data: {
          programVersionId: day.programVersionId,
          workoutDayId: day.id,
          workoutDayNameSnapshot: day.name,
          exerciseSessions: {
            create: day.workoutExercises.map((planned) => ({
              exerciseId: planned.exerciseId,
              position: planned.position,
              exerciseNameSnapshot: planned.exercise.name,
              plannedSets: planned.sets,
              targetReps: planned.targetReps,
              restSeconds: planned.restSeconds,
              autoRest: planned.autoRest,
              setLogs: {
                create: prefillWeights(planned.sets, previousByExercise.get(planned.exerciseId) ?? []).map((weightKg, index) => ({
                  setNumber: index + 1,
                  targetReps: planned.targetReps,
                  actualReps: planned.targetReps,
                  weightKg,
                })),
              },
            })),
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
