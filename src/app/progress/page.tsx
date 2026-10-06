import Link from "next/link";
import { Activity, CalendarCheck, Clock3, Dumbbell } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MuscleRadar, TrainingActivityChart } from "@/components/progress-dashboard-charts";
import { dashboardRange, dashboardRanges } from "@/lib/progress-dashboard";
import { getPrisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/server/auth";
import { getProgressDashboard } from "@/server/progress-dashboard";

export const dynamic = "force-dynamic";

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  const user = await requireCurrentUser();
  const range = dashboardRange((await searchParams).range);
  const data = await getProgressDashboard(getPrisma(), user.id, range);
  const { completed, target } = data.consistency;
  const hours = Math.floor(data.totals.minutes / 60); const minutes = data.totals.minutes % 60;
  return <AppShell><main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
    <p className="text-sm font-semibold text-primary">Your training, at a glance</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Progress</h1>
    <nav aria-label="Progress time range" className="mt-5 grid grid-cols-4 gap-1 rounded-2xl border bg-card p-1">{dashboardRanges.map((item) => <Link key={item.value} href={`/progress?range=${item.value}`} aria-current={range === item.value ? "page" : undefined} className={`flex min-h-11 items-center justify-center rounded-xl px-1 text-sm font-semibold ${range === item.value ? "bg-primary text-white" : "text-muted-foreground"}`}>{item.label}</Link>)}</nav>
    <p className="mt-2 text-xs text-muted-foreground">{range === "week" ? "This Monday–Sunday week" : range === "month" ? "Last 30 days" : range === "6months" ? "Last 26 weeks" : "All completed history"} · Europe/London</p>
    <section aria-label="Training summary" className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
      <article className="rounded-2xl border bg-card p-3 sm:p-4"><CalendarCheck className="size-5 text-primary"/><p className="mt-3 text-xl font-semibold tabular-nums">{completed}{target ? <span className="text-sm text-muted-foreground"> / {target}</span> : ""}</p><p className="mt-1 text-xs text-muted-foreground">Workouts this week</p>{target && <><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, completed / target * 100)}%` }}/></div><p className="mt-1 text-[10px] text-muted-foreground">Your weekly goal</p></>}</article>
      <article className="rounded-2xl border bg-card p-3 sm:p-4"><Dumbbell className="size-5 text-primary"/><p className="mt-3 text-xl font-semibold tabular-nums">{data.totals.workouts}</p><p className="mt-1 text-xs text-muted-foreground">Workouts completed</p></article>
      <article className="rounded-2xl border bg-card p-3 sm:p-4"><Clock3 className="size-5 text-primary"/><p className="mt-3 text-lg font-semibold tabular-nums">{hours ? `${hours}h ${minutes}m` : `${minutes}m`}</p><p className="mt-1 text-xs text-muted-foreground">Training time</p></article>
    </section>
    {!data.totals.workouts && <section className="mt-5 rounded-2xl border border-dashed bg-card p-5 text-center"><Activity className="mx-auto size-6 text-primary"/><h2 className="mt-2 font-semibold">No completed workouts in this range</h2><p className="mt-1 text-sm text-muted-foreground">Your charts will fill in as you finish workouts. Try a longer range to see earlier training.</p></section>}
    <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2"><TrainingActivityChart key={range} buckets={data.activity} unit={data.unit}/><MuscleRadar muscles={data.muscles}/></div>
    <p className="mt-4 text-xs leading-5 text-muted-foreground">Only completed workouts and completed sets are included. Training time runs from workout start to the last recorded set or stopped cardio.</p>
    <Link href="/exercises" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary">Browse exercises and individual history →</Link>
  </main></AppShell>;
}
