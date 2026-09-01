import { ArrowLeft, BarChart3, Dumbbell, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ProgressChart } from "@/components/progress-chart";
import { ResponsiveEquipmentImage } from "@/components/responsive-equipment-image";
import { getExercisePrimaryMedia } from "@/lib/exercise-media";
import { getPrisma } from "@/lib/prisma";
import { getExerciseHistory } from "@/server/progress";

export const dynamic = "force-dynamic";
function formatted(value: number) { return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value); }

export default async function ExerciseProgressPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getExerciseHistory(getPrisma(), slug);
  if (!data) notFound();
  const primary = data.exercise.muscles.filter((relation) => relation.role === "PRIMARY").map((relation) => relation.muscle.name);
  const secondary = data.exercise.muscles.filter((relation) => relation.role === "SECONDARY").map((relation) => relation.muscle.name);
  const image = getExercisePrimaryMedia(data.exercise);
  const machineLevel = data.exercise.loadTrackingType === "MACHINE_LEVEL";
  const chartHistory = data.comparableHistory.filter((item) => item.highestLoadValue !== null);

  return <AppShell><main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
    <Link href="/progress" className="inline-flex items-center gap-2 rounded-xl py-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Progress</Link>
    <div className="mt-3 overflow-hidden rounded-3xl border bg-card shadow-sm"><div className="overflow-hidden border-b bg-muted"><ResponsiveEquipmentImage image={image} sizes="(max-width: 1024px) 100vw, 960px" className="max-h-96 object-cover" /></div><div className="p-5 sm:p-7"><p className="text-sm font-semibold text-primary">Exercise history</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{data.exercise.name}</h1><p className="mt-2 text-sm text-muted-foreground">Primary: {primary.join(", ") || "—"} · Secondary: {secondary.join(", ") || "None recorded"}</p></div></div>
    {!data.current ? <section className="mt-7 rounded-3xl border border-dashed bg-card p-6 text-center"><Dumbbell className="mx-auto size-7 text-primary" /><h2 className="mt-3 text-lg font-semibold">No compatible completed history yet</h2><p className="mt-2 text-sm text-muted-foreground">Legacy records with different load semantics remain preserved but are not compared with this catalogue tracking type.</p></section> : <>
      <section className="mt-7 grid gap-3 sm:grid-cols-2"><PerformanceCard title="Most recent performance" performance={data.current} /><PerformanceCard title="Previous session" performance={data.previous} /></section>
      <section className="mt-8 grid gap-3 sm:grid-cols-2"><Best label={machineLevel ? "Highest completed machine level" : "Highest completed working weight"} value={data.highestLoadValue === null ? (machineLevel ? "No machine level recorded" : "No kilogram load recorded") : machineLevel ? `L${formatted(data.highestLoadValue)}` : `${formatted(data.highestLoadValue)}kg`} /><Best label="Highest meaningful session volume" value={data.highestVolumeKgReps === null ? "No kilogram volume recorded" : `${formatted(data.highestVolumeKgReps)} kg-reps`} /></section>
      {chartHistory.length ? <section className="mt-8 rounded-3xl border bg-card p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold tracking-tight">{machineLevel ? "Machine level over time" : "Working weight over time"}</h2><p className="mt-1 text-sm text-muted-foreground">Only sessions with compatible load type and entry semantics appear in this series.</p><div className="mt-5"><ProgressChart label={machineLevel ? "Highest machine level by session" : "Highest completed working-set weight by session"} unit={machineLevel ? "level" : "kg"} points={[...chartHistory].reverse().map((item) => ({ label: item.dateLabel, value: item.highestLoadValue! }))} /></div></section> : <section className="mt-8 rounded-3xl border bg-card p-5 text-sm text-muted-foreground">A load chart appears when compatible completed external-load sets exist. Machine levels and kilograms are never combined.</section>}
      <section className="mt-8"><h2 className="text-xl font-semibold tracking-tight">Historical sessions</h2><div className="mt-4 space-y-3">{data.history.map((performance) => <article key={`${performance.date}-${performance.totalReps}-${performance.loadTrackingType ?? "legacy"}`} className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{performance.dateLabel}</h3><p className="mt-1 text-sm text-muted-foreground">{performanceLoad(performance)}</p></div><BarChart3 className="size-5 text-primary" /></div><p className="mt-4 text-sm">{performance.completedSets} completed set{performance.completedSets === 1 ? "" : "s"} · Reps: {performance.reps.join(" / ")}</p>{performance.volumeKgReps !== null && <p className="mt-1 text-sm text-muted-foreground">Volume: {formatted(performance.volumeKgReps)} kg-reps</p>}</article>)}</div></section>
    </>}
  </main></AppShell>;
}

type Performance = { dateLabel: string; completedSets: number; reps: number[]; loadTrackingType: string | null; highestLoadValue: number | null; volumeKgReps: number | null };
function performanceLoad(performance: Performance) {
  if (performance.highestLoadValue === null) return performance.loadTrackingType === "BODYWEIGHT" ? "Bodyweight" : performance.loadTrackingType === null ? "Legacy load not available" : "No external load";
  if (performance.loadTrackingType === "MACHINE_LEVEL") return `L${formatted(performance.highestLoadValue)} highest set`;
  return `${formatted(performance.highestLoadValue)}kg highest set${performance.loadTrackingType === null ? " (legacy)" : ""}`;
}
function PerformanceCard({ title, performance }: Readonly<{ title: string; performance: Performance | null }>) { return <section className="rounded-3xl border bg-card p-5 shadow-sm"><p className="text-sm font-semibold text-primary">{title}</p>{performance ? <><h2 className="mt-2 text-xl font-semibold">{performance.dateLabel}</h2><p className="mt-3 text-sm">{performanceLoad(performance)}</p><p className="mt-1 text-sm text-muted-foreground">{performance.completedSets} sets · {performance.reps.join(" / ")} reps{performance.volumeKgReps !== null ? ` · ${formatted(performance.volumeKgReps)} kg-reps` : ""}</p></> : <p className="mt-3 text-sm text-muted-foreground">No earlier compatible completed session.</p>}</section>; }
function Best({ label, value }: Readonly<{ label: string; value: string }>) { return <section className="rounded-2xl border bg-card p-4 shadow-sm"><Trophy className="size-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></section>; }
