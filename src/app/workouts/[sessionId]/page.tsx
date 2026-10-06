import { notFound, redirect } from "next/navigation";
import { WorkoutList } from "@/components/workout-list";
import { getExercisePrimaryMedia } from "@/lib/exercise-media";
import { formatLoad } from "@/lib/load-tracking";
import type { OfflineWorkout } from "@/lib/offline-types";
import { getPrisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";
export default async function WorkoutSessionPage({ params }: PageProps<"/workouts/[sessionId]">) {
  const { sessionId } = await params;
  const user = await requireCurrentUser();
  const prisma = getPrisma();
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: {
      programVersion: { include: { program: true } },
      workoutDay: true,
      exerciseSessions: {
        orderBy: { position: "asc" },
        include: {
          setLogs: { orderBy: { setNumber: "asc" } },
          exercise: { include: { media: { orderBy: { sortOrder: "asc" } }, equipment: { include: { media: { orderBy: { sortOrder: "asc" } } } }, muscles: { include: { muscle: true } } } },
        },
      },
    },
  });
  if (!session) notFound();
  if (session.status === "COMPLETED") redirect(`/workouts/${sessionId}/summary`);
  const history = await prisma.exerciseSession.findMany({
    where: { exerciseId: { in: session.exerciseSessions.map((exercise) => exercise.exerciseId) }, workoutSession: { userId: user.id, status: "COMPLETED" }, NOT: { workoutSessionId: sessionId } },
    orderBy: { workoutSession: { completedAt: "desc" } },
    include: { setLogs: { where: { completedAt: { not: null } }, orderBy: { setNumber: "asc" } } },
  });
  const catalogueExercises = await prisma.exercise.findMany({ where: { active: true, OR: [{ equipmentId: null }, { equipment: { available: true } }] }, orderBy: { name: "asc" }, include: { media: { orderBy: { sortOrder: "asc" } }, equipment: { include: { media: { orderBy: { sortOrder: "asc" } } } } } });
  const snapshot: OfflineWorkout = { schemaVersion: 2, id: session.id, programId: session.programVersion.program.id, programSlug: session.programVersion.program.slug, programName: session.programVersion.program.name, programVersionId: session.programVersionId, programVersionNumber: session.programVersion.versionNumber, workoutDayId: session.workoutDayId, workoutDaySlug: session.workoutDay.slug, status: "IN_PROGRESS", workoutDayName: session.workoutDayNameSnapshot, startedAt: session.startedAt.toISOString(), completedAt: null, cardioPlanned: session.cardioPlanned, cardioStartedAt: session.cardioStartedAt?.toISOString() ?? null, cardioStoppedAt: session.cardioStoppedAt?.toISOString() ?? null, cardioDurationSeconds: session.cardioDurationSeconds, currentExerciseId: session.exerciseSessions[0]?.id ?? null, updatedAt: new Date().toISOString(), exercises: session.exerciseSessions.map((item) => { const image = getExercisePrimaryMedia(item.exercise); return { id: item.id, exerciseId: item.exerciseId, slug: item.exercise.slug, name: item.exerciseNameSnapshot, position: item.position, plannedSets: item.plannedSets, targetReps: item.targetReps, restSeconds: item.restSeconds, autoRest: item.autoRest, isAdHoc: item.isAdHoc, loadTrackingType: item.loadTrackingTypeSnapshot, loadEntryMode: item.loadEntryModeSnapshot, equipmentName: item.exercise.equipment?.name ?? null, imagePath: image?.storagePath ?? null, sets: item.setLogs.map((set) => ({ id: set.id, setNumber: set.setNumber, targetReps: set.targetReps, actualReps: set.actualReps, weightKg: set.weightKg === null ? null : Number(set.weightKg), loadValue: set.loadValue === null ? null : Number(set.loadValue), loadTrackingType: set.loadTrackingType, completedAt: set.completedAt?.toISOString() ?? null, notes: set.notes, effort: set.effort })) }; }), catalogue: catalogueExercises.map((exercise) => { const image = getExercisePrimaryMedia(exercise); return { exerciseId: exercise.id, slug: exercise.slug, name: exercise.name, defaultTargetReps: exercise.defaultTargetReps, loadTrackingType: exercise.loadTrackingType, loadEntryMode: exercise.loadEntryMode, equipmentName: exercise.equipment?.name ?? null, imagePath: image?.storagePath ?? null }; }) };
  for (const exercise of snapshot.exercises) {
    const previous = history.find((item) => item.exerciseId === exercise.exerciseId && item.loadTrackingTypeSnapshot === exercise.loadTrackingType && item.loadEntryModeSnapshot === exercise.loadEntryMode);
    exercise.previousPerformance = previous?.setLogs.map((set) => `Set ${set.setNumber}: ${formatLoad(previous.loadTrackingTypeSnapshot, previous.loadEntryModeSnapshot, set.loadValue === null ? null : Number(set.loadValue), { blank: "—", legacyWeightKg: set.weightKg === null ? null : Number(set.weightKg) })} × ${set.actualReps ?? set.targetReps}`) ?? [];
  }
  return <WorkoutList sessionId={sessionId} snapshot={snapshot} newerProgrammeVersionActive={session.programVersion.program.activeVersionId !== session.programVersionId}/>;
}
