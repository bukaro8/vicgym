import { ArrowRight, CalendarDays, CircleDashed, Clock3, Dumbbell, FlaskConical, History } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { greetingFor } from "@/lib/display";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfLondonWeek(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(values.weekday);
  const localMidnight = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`);
  localMidnight.setUTCDate(localMidnight.getUTCDate() - Math.max(dayIndex, 0));
  return localMidnight;
}

export default async function Home() {
  const prisma = getPrisma();
  const now = new Date();
  const [settings, program, weeklySessions, lastWorkout] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.workoutProgram.findUnique({
      where: { slug: "demo-four-day" },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { days: { orderBy: { rotationOrder: "asc" } } } } },
    }),
    prisma.workoutSession.count({ where: { status: "COMPLETED", completedAt: { gte: startOfLondonWeek(now) } } }),
    prisma.workoutSession.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, select: { workoutDayNameSnapshot: true, completedAt: true } }),
  ]);
  const version = program?.versions[0];
  const active = Boolean(program?.activeVersionId && program.activeVersionId === version?.id);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
        <div><p className="text-sm font-semibold text-primary">{greetingFor(now, settings?.timezone)}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-5xl">Your VicGym home</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">The verified catalogue is ready. The four-day routine below is demo data and is inactive unless you explicitly confirm it.</p></div>

        <section className="mt-7 overflow-hidden rounded-3xl border bg-card shadow-sm" aria-labelledby="programme-card-title">
          <div className="border-b bg-accent/70 p-5 sm:p-7"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-accent-foreground"><FlaskConical className="size-3.5" aria-hidden="true" />Demo/test data</span><span className="rounded-full border border-primary/20 bg-white/60 px-3 py-1 text-xs font-medium text-muted-foreground">{active ? "Confirmed" : "Inactive"}</span></div><h2 id="programme-card-title" className="mt-4 text-2xl font-semibold tracking-tight">{program?.name ?? "Demo programme not seeded"}</h2><p className="mt-2 text-sm font-medium text-accent-foreground">{program?.notice ?? "Run the Phase 2 seed to add the provisional fixture."}</p></div>
          <div className="p-5 sm:p-7"><button type="button" disabled className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground opacity-50 sm:w-auto"><Dumbbell className="size-4" aria-hidden="true" />Start workout</button><p className="mt-3 text-xs text-muted-foreground">{active ? "Workout logging arrives in Phase 3." : "Confirm the demo programme before workout start can become available."}</p><Link href="/programme" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">Review programme<ArrowRight className="size-4" aria-hidden="true" /></Link></div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="rotation-title">
            <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-primary">Upcoming rotation</p><h2 id="rotation-title" className="mt-1 text-xl font-semibold tracking-tight">Demo workout order</h2></div><CalendarDays className="size-5 text-muted-foreground" aria-hidden="true" /></div>
            {version ? <ol className="mt-5 grid gap-3 sm:grid-cols-2">{version.days.map((day, index) => <li key={day.id} className="flex items-center gap-3 rounded-2xl border bg-background p-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">{day.rotationOrder}</span><div><p className="font-medium">{day.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{index === 0 ? "First in demo rotation" : "Provisional order"}</p></div></li>)}</ol> : <p className="mt-5 text-sm text-muted-foreground">No programme version is available.</p>}
          </section>

          <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="week-title"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-primary">This week</p><h2 id="week-title" className="mt-1 text-xl font-semibold tracking-tight">Weekly summary</h2></div><Clock3 className="size-5 text-muted-foreground" aria-hidden="true" /></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-background p-4"><p className="text-2xl font-semibold">{weeklySessions}</p><p className="mt-1 text-xs text-muted-foreground">Completed sessions</p></div><div className="rounded-2xl bg-background p-4"><p className="text-2xl font-semibold">—</p><p className="mt-1 text-xs text-muted-foreground">Working sets</p></div></div>{weeklySessions === 0 && <p className="mt-4 text-sm text-muted-foreground">No real sessions have been logged.</p>}</section>
        </div>

        <section className="mt-6 rounded-3xl border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="last-workout-title"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-muted text-muted-foreground"><History className="size-5" aria-hidden="true" /></span><div><p className="text-sm font-semibold text-primary">History</p><h2 id="last-workout-title" className="text-xl font-semibold tracking-tight">Last workout</h2></div></div>{lastWorkout ? <p className="mt-5 text-sm">{lastWorkout.workoutDayNameSnapshot} · {lastWorkout.completedAt?.toLocaleDateString("en-GB")}</p> : <div className="mt-5 flex items-start gap-3 rounded-2xl bg-background p-4"><CircleDashed className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><div><p className="font-medium">No completed workouts yet</p><p className="mt-1 text-sm text-muted-foreground">This empty state will use real session history in a later phase.</p></div></div>}</section>
      </main>
    </AppShell>
  );
}
