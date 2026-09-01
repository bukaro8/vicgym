import { ArrowRight, CirclePlay, FlaskConical, RotateCcw } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { StartWorkoutButton } from "@/components/start-workout-button";
import { getPrisma } from "@/lib/prisma";
import { getActiveProgramme } from "@/server/active-programme";

export const dynamic = "force-dynamic";

export default async function WorkoutsPage() {
  const prisma = getPrisma();
  const [activeSession, program] = await Promise.all([
    prisma.workoutSession.findFirst({ where: { status: "IN_PROGRESS" }, include: { exerciseSessions: { orderBy: { position: "asc" }, take: 1 } } }),
    getActiveProgramme(prisma),
  ]);
  return <AppShell><main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-8 sm:py-10"><p className="text-sm font-semibold text-primary">Active workout</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-5xl">Choose a workout</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Sessions use immutable snapshots from the active programme version.{program?.isDemo ? " This programme remains demo/test data." : ""}</p>
    {activeSession ? <section className="mt-7 rounded-3xl border border-primary/25 bg-accent p-5 sm:p-7"><div className="flex items-center gap-2 text-sm font-semibold text-primary"><RotateCcw className="size-4"/>In progress</div><h2 className="mt-3 text-2xl font-semibold">{activeSession.workoutDayNameSnapshot}</h2><p className="mt-2 text-sm text-muted-foreground">Started {activeSession.startedAt.toLocaleString("en-GB")}. Only one workout can be active.</p><Link href={`/workouts/${activeSession.id}/exercises/${activeSession.exerciseSessions[0]?.id}`} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-white">Resume workout<ArrowRight className="size-4"/></Link></section>
    : !program?.activeVersion ? <section className="mt-7 rounded-3xl border bg-card p-6"><FlaskConical className="size-6 text-primary"/><h2 className="mt-4 text-xl font-semibold">No active programme</h2><p className="mt-2 text-sm text-muted-foreground">Create and explicitly activate a programme through validated Coach Changes JSON before starting a session.</p><Link href="/more/review" className="mt-5 inline-flex items-center gap-2 font-semibold text-primary">Import programme JSON<ArrowRight className="size-4"/></Link></section>
    : <div className="mt-7 grid gap-4 md:grid-cols-2">{program.activeVersion.days.map((day) => <article key={day.id} className="rounded-3xl border bg-card p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-primary">Rotation {day.rotationOrder}</p><h2 className="mt-1 text-xl font-semibold">{day.name}</h2></div><CirclePlay className="size-6 text-muted-foreground"/></div><p className="mt-3 text-sm text-muted-foreground">{day.workoutExercises.length} exercises{program.isDemo ? " · demo/test data" : ""}</p><div className="mt-5"><StartWorkoutButton workoutDayId={day.id}/></div></article>)}</div>}
  </main></AppShell>;
}
