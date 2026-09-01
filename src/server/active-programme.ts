import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const activeProgrammeInclude = {
  activeVersion: {
    include: {
      days: {
        orderBy: { rotationOrder: "asc" as const },
        include: {
          workoutExercises: {
            orderBy: { position: "asc" as const },
            include: { exercise: true },
          },
        },
      },
    },
  },
} satisfies Prisma.WorkoutProgramInclude;

export async function getActiveProgramme(db: Db) {
  const settings = await db.appSettings.findUnique({
    where: { id: 1 },
    select: {
      activeProgram: { include: activeProgrammeInclude },
    },
  });
  const program = settings?.activeProgram ?? null;
  if (!program || program.status !== "ACTIVE" || !program.activeVersion) return null;
  return program;
}

export async function setActiveProgramme(db: Db, programId: string, versionId: string) {
  await db.workoutProgram.updateMany({
    where: { status: "ACTIVE", id: { not: programId }, isDemo: false },
    data: { status: "DRAFT" },
  });
  await db.workoutProgram.updateMany({
    where: { status: "ACTIVE", id: { not: programId }, isDemo: true },
    data: { status: "DEMO" },
  });
  const program = await db.workoutProgram.update({
    where: { id: programId },
    data: { activeVersionId: versionId, status: "ACTIVE", activatedAt: new Date() },
  });
  await db.appSettings.upsert({
    where: { id: 1 },
    create: { id: 1, activeProgramId: programId },
    update: { activeProgramId: programId },
  });
  return program;
}
