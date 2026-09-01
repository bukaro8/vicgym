import { CircleDashed, Dumbbell, FlaskConical, LockKeyhole, TimerReset } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { formatLoad, type LoadEntryModeValue, type LoadTrackingTypeValue } from "@/lib/load-tracking";
import { getPrisma } from "@/lib/prisma";
import { getActiveProgramme } from "@/server/active-programme";

export const dynamic = "force-dynamic";

export default async function ProgrammePage() {
  const program = await getActiveProgramme(getPrisma());
  const version = program?.activeVersion;
  const active = Boolean(program && version);
  const demo = Boolean(program?.isDemo);

  return <AppShell><main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
    <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-primary">{demo ? <FlaskConical className="size-5" aria-hidden="true" /> : <Dumbbell className="size-5" aria-hidden="true" />}</span><div><p className="text-sm font-semibold text-primary">{demo ? "Provisional fixture" : active ? "Active programme" : "Programme"}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{program?.name ?? "No programme created"}</h1></div></div>
    {!program || !version ? <section className="mt-7 rounded-3xl border bg-card p-6"><p className="font-semibold">No active programme</p><p className="mt-2 text-sm text-muted-foreground">Paste schemaVersion 2 programme JSON in Coach Review, validate it, and explicitly confirm creation.</p><Link href="/more/review" className="mt-5 inline-flex font-semibold text-primary">Open Coach Review</Link></section> : <>
      <section className="mt-7 rounded-3xl border bg-card p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${demo ? "bg-amber-100 text-amber-900" : "bg-accent text-accent-foreground"}`}>{active ? demo ? "Active demo" : "Active" : "Inactive demo"}</span><span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">Version {version.versionNumber}</span></div><h2 className="mt-5 text-2xl font-semibold tracking-tight">{program.notice ?? `${program.name} version ${version.versionNumber}`}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{demo ? "This routine is provisional software fixture data. It is not Victor's programme and remains visibly marked as demo data after confirmation." : "This immutable version was created from validated programme JSON. Future Coach Changes create new versions without altering this one or completed workout history."}</p></section>
      <section className="mt-8" aria-labelledby="programme-days-title"><div><p className="text-sm font-semibold text-primary">Workout rotation</p><h2 id="programme-days-title" className="mt-1 text-2xl font-semibold tracking-tight">Programme days</h2></div><div className="mt-4 grid gap-4 md:grid-cols-2">{version.days.map((day) => <article key={day.id} className="rounded-3xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-primary">Rotation {day.rotationOrder}</p><h3 className="mt-1 text-xl font-semibold">{day.name}</h3></div><CircleDashed className="size-6 text-muted-foreground" aria-hidden="true" /></div><ol className="mt-5 space-y-3">{day.workoutExercises.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 border-t pt-3 first:border-t-0 first:pt-0"><div><p className="text-sm font-medium">{item.exercise.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.sets} sets × {item.targetReps} reps · {formatLoad(item.loadTrackingTypeSnapshot as LoadTrackingTypeValue | null, item.loadEntryModeSnapshot as LoadEntryModeValue | null, item.plannedLoadValue === null ? null : Number(item.plannedLoadValue), { blank: "Load —", legacyWeightKg: item.plannedWeightKg === null ? null : Number(item.plannedWeightKg) })}</p></div><span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><TimerReset className="size-3.5" aria-hidden="true" />{item.restSeconds}s</span></li>)}</ol></article>)}</div></section>
      <div className="mt-6 flex items-start gap-3 rounded-2xl border bg-muted/60 p-4 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>This programme version is immutable. Validated Coach Changes create a separate version and preserve completed sessions against the version used.</p></div>
    </>}
  </main></AppShell>;
}
