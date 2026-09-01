import { Clock3, Dumbbell, History, ListChecks } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { ActiveExercise } from "@/components/active-exercise";
import { AppShell } from "@/components/app-shell";
import { OfflineWorkoutBootstrap } from "@/components/offline-workout-bootstrap";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { ResponsiveEquipmentImage } from "@/components/responsive-equipment-image";
import { getExercisePrimaryMedia } from "@/lib/exercise-media";
import { formatLoad, type LoadEntryModeValue, type LoadTrackingTypeValue } from "@/lib/load-tracking";
import type { OfflineWorkout } from "@/lib/offline-types";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function ActiveExercisePage({ params }: PageProps<"/workouts/[sessionId]/exercises/[exerciseSessionId]">) {
  const { sessionId, exerciseSessionId } = await params;
  const prisma = getPrisma();
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
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
  const exerciseSession = session.exerciseSessions.find((item) => item.id === exerciseSessionId);
  if (!exerciseSession) notFound();
  if (session.status === "COMPLETED") redirect(`/workouts/${sessionId}/summary`);
  const siblings = session.exerciseSessions;
  const index = siblings.findIndex((item) => item.id === exerciseSessionId);
  const previousPerformance = await prisma.exerciseSession.findFirst({
    where: { exerciseId: exerciseSession.exerciseId, loadTrackingTypeSnapshot: exerciseSession.loadTrackingTypeSnapshot, loadEntryModeSnapshot: exerciseSession.loadEntryModeSnapshot, workoutSession: { status: "COMPLETED" }, NOT: { workoutSessionId: sessionId } },
    orderBy: { workoutSession: { completedAt: "desc" } },
    include: { setLogs: { where: { completedAt: { not: null } }, orderBy: { setNumber: "asc" } }, workoutSession: { select: { completedAt: true, workoutDayNameSnapshot: true } } },
  });
  const primaryPhoto = getExercisePrimaryMedia(exerciseSession.exercise);
  const primary = exerciseSession.exercise.muscles.find((item) => item.role === "PRIMARY")?.muscle.name;
  const secondary = exerciseSession.exercise.muscles.filter((item) => item.role === "SECONDARY").map((item) => item.muscle.name);
  const snapshot: OfflineWorkout = { schemaVersion: 2, id: session.id, programId: session.programVersion.program.id, programSlug: session.programVersion.program.slug, programName: session.programVersion.program.name, programVersionId: session.programVersionId, programVersionNumber: session.programVersion.versionNumber, workoutDayId: session.workoutDayId, workoutDaySlug: session.workoutDay.slug, status: "IN_PROGRESS", workoutDayName: session.workoutDayNameSnapshot, startedAt: session.startedAt.toISOString(), completedAt: null, currentExerciseId: exerciseSession.id, updatedAt: new Date().toISOString(), exercises: session.exerciseSessions.map((item) => { const image = getExercisePrimaryMedia(item.exercise); return { id: item.id, exerciseId: item.exerciseId, slug: item.exercise.slug, name: item.exerciseNameSnapshot, position: item.position, plannedSets: item.plannedSets, targetReps: item.targetReps, restSeconds: item.restSeconds, autoRest: item.autoRest, loadTrackingType: item.loadTrackingTypeSnapshot, loadEntryMode: item.loadEntryModeSnapshot, equipmentName: item.exercise.equipment?.name ?? null, imagePath: image?.storagePath ?? null, sets: item.setLogs.map((set) => ({ id: set.id, setNumber: set.setNumber, targetReps: set.targetReps, actualReps: set.actualReps, weightKg: set.weightKg === null ? null : Number(set.weightKg), loadValue: set.loadValue === null ? null : Number(set.loadValue), loadTrackingType: set.loadTrackingType, completedAt: set.completedAt?.toISOString() ?? null, notes: set.notes })) }; }) };
  return <AppShell><OfflineWorkoutBootstrap snapshot={snapshot}/><main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-8 sm:py-8"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-primary">{session.workoutDayNameSnapshot}</p><p className="mt-1 text-sm font-medium">Exercise {index + 1} of {siblings.length}</p></div><OfflineAwareLink href={`/workouts/${sessionId}/finish`} offlineHref={`/offline/finish/${sessionId}`} className="rounded-xl border bg-card px-3 py-2 text-sm font-semibold">Finish workout</OfflineAwareLink></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${((index + 1) / siblings.length) * 100}%` }}/></div>
    <article className="mt-5 overflow-hidden rounded-3xl border bg-card shadow-sm"><div className="max-h-[25rem] overflow-hidden border-b bg-muted"><ResponsiveEquipmentImage image={primaryPhoto} priority className="max-h-[25rem] object-cover" sizes="(max-width: 1024px) 100vw, 900px"/></div><div className="p-5 sm:p-7"><p className="text-sm font-semibold text-primary">{exerciseSession.exercise.equipment?.name ?? "Bodyweight / no equipment"}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{exerciseSession.exerciseNameSnapshot}</h1><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-accent px-3 py-1.5 font-medium text-accent-foreground">Primary: {primary ?? "—"}</span>{secondary.length > 0 && <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">Secondary: {secondary.join(", ")}</span>}</div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-background p-3"><ListChecks className="size-4 text-primary"/><p className="mt-2 text-xs text-muted-foreground">Plan</p><p className="font-semibold">{exerciseSession.plannedSets} × {exerciseSession.targetReps}</p></div><div className="rounded-xl bg-background p-3"><Clock3 className="size-4 text-primary"/><p className="mt-2 text-xs text-muted-foreground">Rest</p><p className="font-semibold">{exerciseSession.restSeconds}s</p></div><div className="rounded-xl bg-background p-3"><Dumbbell className="size-4 text-primary"/><p className="mt-2 text-xs text-muted-foreground">Timer</p><p className="font-semibold">{exerciseSession.autoRest ? "Auto" : "Manual"}</p></div></div>
      <section className="mt-6 rounded-2xl border bg-background p-4" aria-labelledby="previous-performance"><div className="flex items-center gap-2"><History className="size-4 text-primary"/><h2 id="previous-performance" className="font-semibold">Previous performance</h2></div>{previousPerformance ? <><p className="mt-2 text-xs text-muted-foreground">{previousPerformance.workoutSession.workoutDayNameSnapshot} · {previousPerformance.workoutSession.completedAt?.toLocaleDateString("en-GB")}</p><div className="mt-3 flex flex-wrap gap-2">{previousPerformance.setLogs.map((set) => <span key={set.id} className="rounded-lg bg-card px-2.5 py-1.5 text-xs">Set {set.setNumber}: {formatLoad(previousPerformance.loadTrackingTypeSnapshot as LoadTrackingTypeValue | null, previousPerformance.loadEntryModeSnapshot as LoadEntryModeValue | null, set.loadValue === null ? null : Number(set.loadValue), { blank: "—", legacyWeightKg: set.weightKg === null ? null : Number(set.weightKg) })} × {set.actualReps ?? set.targetReps}</span>)}</div></> : <p className="mt-2 text-sm text-muted-foreground">No completed history with compatible load units for this exercise.</p>}</section>
      <ActiveExercise sessionId={sessionId} exerciseSessionId={exerciseSessionId} loadTrackingType={exerciseSession.loadTrackingTypeSnapshot as LoadTrackingTypeValue | null} loadEntryMode={exerciseSession.loadEntryModeSnapshot as LoadEntryModeValue | null} initialSets={exerciseSession.setLogs.map((set) => ({ id: set.id, setNumber: set.setNumber, targetReps: set.targetReps, actualReps: set.actualReps, weightKg: set.weightKg === null ? null : Number(set.weightKg), loadValue: set.loadValue === null ? null : Number(set.loadValue), loadTrackingType: set.loadTrackingType as LoadTrackingTypeValue | null, completedAt: set.completedAt?.toISOString() ?? null }))} previousId={siblings[index - 1]?.id ?? null} nextId={siblings[index + 1]?.id ?? null} offlineSnapshot={snapshot}/>
    </div></article></main></AppShell>;
}
