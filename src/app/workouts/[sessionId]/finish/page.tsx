import { ArrowLeft, CheckCircle2, Clock3, ListChecks } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CardioTimer } from "@/components/cardio-timer";
import { FinishWorkout } from "@/components/finish-workout";
import { elapsedMinutes } from "@/lib/display";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FinishPage({ params }: PageProps<"/workouts/[sessionId]/finish">) {
  const { sessionId } = await params;
  const session = await getPrisma().workoutSession.findUnique({ where: { id: sessionId }, include: { exerciseSessions: { orderBy: { position: "asc" }, include: { setLogs: true } } } });
  if (!session) notFound();
  if (session.status === "COMPLETED") redirect(`/workouts/${sessionId}/summary`);
  const completedSets = session.exerciseSessions.flatMap((item) => item.setLogs).filter((set) => set.completedAt).length;
  const plannedSets = session.exerciseSessions.reduce((sum, item) => sum + item.plannedSets, 0);
  const completedExercises = session.exerciseSessions.filter((item) => item.setLogs.filter((set) => set.completedAt).length >= item.plannedSets).length;
  const incomplete = completedSets < plannedSets;
  const minutes = elapsedMinutes(session.startedAt);

  return <AppShell><main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
    <Link href={`/workouts/${sessionId}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><ArrowLeft className="size-4"/>Back to workout</Link>
    <p className="mt-7 text-sm font-semibold text-primary">Finish workout</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Review {session.workoutDayNameSnapshot}</h1>
    <div className="mt-6 grid grid-cols-3 gap-3"><div className="rounded-2xl border bg-card p-4"><CheckCircle2 className="size-5 text-primary"/><p className="mt-3 text-2xl font-semibold">{completedExercises}/{session.exerciseSessions.length}</p><p className="text-xs text-muted-foreground">Exercises</p></div><div className="rounded-2xl border bg-card p-4"><ListChecks className="size-5 text-primary"/><p className="mt-3 text-2xl font-semibold">{completedSets}/{plannedSets}</p><p className="text-xs text-muted-foreground">Planned sets</p></div><div className="rounded-2xl border bg-card p-4"><Clock3 className="size-5 text-primary"/><p className="mt-3 text-2xl font-semibold">{minutes}m</p><p className="text-xs text-muted-foreground">Duration</p></div></div>
    <CardioTimer sessionId={sessionId} initial={{ planned: session.cardioPlanned, startedAt: session.cardioStartedAt?.toISOString() ?? null, stoppedAt: session.cardioStoppedAt?.toISOString() ?? null, durationSeconds: session.cardioDurationSeconds }}/>
    <section className="mt-6 rounded-3xl border bg-card p-5"><h2 className="text-lg font-semibold">Exercise status</h2><ul className="mt-4 space-y-3">{session.exerciseSessions.map((item) => { const count = item.setLogs.filter((set) => set.completedAt).length; return <li key={item.id} className="flex items-center justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"><span className="font-medium">{item.exerciseNameSnapshot}</span><span className="text-sm text-muted-foreground">{count}/{item.plannedSets} planned sets</span></li>; })}</ul></section>
    <div className="mt-6"><FinishWorkout sessionId={sessionId} incomplete={incomplete}/></div>
  </main></AppShell>;
}
