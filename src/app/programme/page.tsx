import { CircleDashed, FlaskConical, LockKeyhole, TimerReset } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ProgrammeActivation } from "@/components/programme-activation";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProgrammePage() {
  const program = await getPrisma().workoutProgram.findUnique({
    where: { slug: "demo-four-day" },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { days: { orderBy: { rotationOrder: "asc" }, include: { workoutExercises: { orderBy: { position: "asc" }, include: { exercise: true } } } } } } },
  });
  const version = program?.versions[0];
  const active = Boolean(program?.activeVersionId && program.activeVersionId === version?.id);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
        <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-primary"><FlaskConical className="size-5" aria-hidden="true" /></span><div><p className="text-sm font-semibold text-primary">Provisional fixture</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{program?.name ?? "Demo programme"}</h1></div></div>

        {!program || !version ? (
          <div className="mt-7 rounded-3xl border bg-card p-6"><p className="font-semibold">Demo data has not been seeded.</p><p className="mt-2 text-sm text-muted-foreground">Run the Phase 2 setup command to create the catalogue and programme fixture.</p></div>
        ) : (
          <>
            <section className="mt-7 rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{active ? "Confirmed demo" : "Inactive demo"}</span><span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">Version {version.versionNumber}</span></div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">{program.notice}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">This routine is provisional software fixture data. It is not Victor&apos;s programme, makes no health or capability assumptions, and remains visibly marked as demo data even after confirmation.</p>
              <div className="mt-6"><ProgrammeActivation slug={program.slug} version={version.versionNumber} active={active} /></div>
            </section>

            <section className="mt-8" aria-labelledby="programme-days-title">
              <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-primary">Four-day rotation</p><h2 id="programme-days-title" className="mt-1 text-2xl font-semibold tracking-tight">Demo days</h2></div><p className="hidden text-sm text-muted-foreground sm:block">All weights blank</p></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {version.days.map((day) => (
                  <article key={day.id} className="rounded-3xl border bg-card p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-primary">Day {day.rotationOrder}</p><h3 className="mt-1 text-xl font-semibold">{day.name}</h3></div><CircleDashed className="size-6 text-muted-foreground" aria-hidden="true" /></div>
                    <ol className="mt-5 space-y-3">
                      {day.workoutExercises.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 border-t pt-3 first:border-t-0 first:pt-0"><div><p className="text-sm font-medium">{item.exercise.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.sets} sets × {item.targetReps} reps · Weight —</p></div><span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><TimerReset className="size-3.5" aria-hidden="true" />{item.restSeconds}s</span></li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </section>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border bg-muted/60 p-4 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>Programme version 1 is immutable. Any later accepted change must create another version; no editor or import workflow is included in Phase 2.</p></div>
          </>
        )}
      </main>
    </AppShell>
  );
}
