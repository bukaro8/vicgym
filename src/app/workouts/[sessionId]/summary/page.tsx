import { CheckCircle2, Clock3, HeartPulse, Home, ListChecks } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { formatCardioDuration } from "@/lib/cardio";
import { getPrisma } from "@/lib/prisma";
import { completedWorkoutDurationMinutes } from "@/lib/workout-duration";
import { requireCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function SummaryPage({ params }: PageProps<"/workouts/[sessionId]/summary">) {
  const { sessionId } = await params;
  const user = await requireCurrentUser();
  const session = await getPrisma().workoutSession.findFirst({ where: { id: sessionId, userId: user.id }, include: { exerciseSessions: { orderBy: { position: "asc" }, include: { setLogs: true } } } });
  if (!session) notFound();
  if (session.status === "IN_PROGRESS") redirect(`/workouts/${sessionId}/finish`);
  const completedSets = session.exerciseSessions.flatMap((item) => item.setLogs).filter((set) => set.completedAt).length;
  const completedExercises = session.exerciseSessions.filter((item) => item.setLogs.filter((set) => set.completedAt).length >= item.plannedSets).length;
  const duration = completedWorkoutDurationMinutes(session) ?? 0;

  return <AppShell><main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 text-center sm:px-8">
    <span className="mx-auto grid size-16 place-items-center rounded-full bg-accent text-primary"><CheckCircle2 className="size-8"/></span><p className="mt-5 text-sm font-semibold text-primary">Workout saved</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{session.workoutDayNameSnapshot}</h1><p className="mt-2 text-sm text-muted-foreground">Completed {session.completedAt?.toLocaleString("en-GB")}. Summary values come from the saved session.</p>
    <div className={`mt-7 grid gap-3 text-left ${session.cardioPlanned ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}><div className="rounded-2xl border bg-card p-4"><CheckCircle2 className="size-5 text-primary"/><p className="mt-3 text-2xl font-semibold">{completedExercises}</p><p className="text-xs text-muted-foreground">Exercises complete</p></div><div className="rounded-2xl border bg-card p-4"><ListChecks className="size-5 text-primary"/><p className="mt-3 text-2xl font-semibold">{completedSets}</p><p className="text-xs text-muted-foreground">Completed sets</p></div>{session.cardioPlanned && <div className="rounded-2xl border bg-card p-4"><HeartPulse className="size-5 text-primary"/><p className="mt-3 text-2xl font-semibold">{formatCardioDuration(session.cardioDurationSeconds)}</p><p className="text-xs text-muted-foreground">Cardio</p></div>}<div className="rounded-2xl border bg-card p-4"><Clock3 className="size-5 text-primary"/><p className="mt-3 text-2xl font-semibold">{duration}m</p><p className="text-xs text-muted-foreground">Training time</p></div></div>
    <section className="mt-7 rounded-3xl border bg-card p-5 text-left"><h2 className="text-lg font-semibold">Exercises</h2><ul className="mt-4 space-y-3">{session.exerciseSessions.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"><span className="font-medium">{item.exerciseNameSnapshot}{item.isAdHoc && <span className="ml-2 rounded-full bg-accent px-2 py-1 text-xs text-primary">Extra</span>}</span><span className="text-sm text-muted-foreground">{item.setLogs.filter((set) => set.completedAt).length} completed</span></li>)}</ul></section>
    <Link href="/" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-white"><Home className="size-5"/>Back home</Link>
  </main></AppShell>;
}
