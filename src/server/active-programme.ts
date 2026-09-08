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

export async function getActiveProgramme(db: Db, userId: string) {
  const settings = await db.appSettings.findUnique({
    where: { userId },
    select: {
      activeProgram: { include: activeProgrammeInclude },
    },
  });
  const program = settings?.activeProgram ?? null;
  if (!program || program.status !== "ACTIVE" || !program.activeVersion) return null;
  return program;
}

export async function setActiveProgramme(db: Db, userId: string, programId: string, versionId: string) {
  await db.workoutProgram.updateMany({
    where: { userId, status: "ACTIVE", id: { not: programId }, isDemo: false },
    data: { status: "DRAFT" },
  });
  await db.workoutProgram.updateMany({
    where: { userId, status: "ACTIVE", id: { not: programId }, isDemo: true },
    data: { status: "DEMO" },
  });
  const [owned, ownedVersion] = await Promise.all([
    db.workoutProgram.findFirst({ where: { id: programId, userId }, select: { id: true } }),
    db.programVersion.findFirst({ where: { id: versionId, programId, program: { userId } }, select: { id: true } }),
  ]);
  if (!owned || !ownedVersion) throw new Error("PROGRAMME_NOT_FOUND");
  const program = await db.workoutProgram.update({
    where: { id: owned.id },
    data: { activeVersionId: versionId, status: "ACTIVE", activatedAt: new Date() },
  });
  await db.appSettings.upsert({
    where: { userId },
    create: { userId, activeProgramId: programId },
    update: { activeProgramId: programId },
  });
  return program;
}
