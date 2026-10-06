"use client";
import { useState } from "react";
import type { ActivityBucket } from "@/lib/progress-dashboard";

export function TrainingActivityChart({ buckets, unit }: { buckets: ActivityBucket[]; unit: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = buckets.find((bucket) => bucket.date === selected) ?? [...buckets].reverse().find((bucket) => bucket.workouts > 0) ?? buckets.at(-1);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.sets));
  return <section className="rounded-3xl border bg-card p-4 sm:p-6" aria-labelledby="activity-title">
    <div className="flex items-start justify-between gap-3"><div><h2 id="activity-title" className="text-xl font-semibold">Training activity</h2><p className="mt-1 text-sm text-muted-foreground">Completed sets by {unit}</p></div><span className="text-xs text-muted-foreground">Peak {Math.max(0, ...buckets.map((item) => item.sets))} sets</span></div>
    <div className="mt-6 grid h-44 items-end gap-0.5 border-b sm:h-52 sm:gap-1" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }} role="group" aria-label="Completed sets chart">
      {buckets.map((bucket) => <button type="button" key={bucket.date} aria-label={`${bucket.label}: ${bucket.sets} sets, ${bucket.workouts} workouts`} aria-pressed={current?.date === bucket.date} onClick={() => setSelected(bucket.date)} className="flex h-full min-w-0 items-end rounded-t focus-visible:outline-2 focus-visible:outline-primary" title={`${bucket.label}: ${bucket.sets} sets`}><span className={`w-full rounded-t transition-colors ${current?.date === bucket.date ? "bg-primary" : "bg-primary/40"}`} style={{ height: bucket.sets ? `${bucket.sets / max * 100}%` : "2px" }}/></button>)}
    </div>
    <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground"><span>{buckets[0]?.label}</span><span className="text-right">{buckets.at(-1)?.label}</span></div>
    {current && <div className="mt-4 rounded-2xl bg-background p-3"><label className="block text-xs font-medium text-muted-foreground" htmlFor="activity-period">Tap a bar or choose a date</label><select id="activity-period" value={current.date} onChange={(event) => setSelected(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-card px-2 text-sm font-semibold">{buckets.map((bucket) => <option key={bucket.date} value={bucket.date}>{bucket.label}</option>)}</select><p aria-live="polite" className="mt-2 text-sm"><strong>{current.sets} sets</strong> · {current.workouts} workouts · {current.minutes} min · {current.reps} reps</p></div>}
  </section>;
}

export function MuscleRadar({ muscles }: { muscles: Array<{ name: string; value: number }> }) {
  const max = Math.max(1, ...muscles.map((muscle) => muscle.value));
  const point = (index: number, radius: number) => { const angle = index * 2 * Math.PI / muscles.length - Math.PI / 2; return [180 + Math.cos(angle) * radius, 155 + Math.sin(angle) * radius]; };
  const polygon = (radius: number) => muscles.map((_, index) => point(index, radius).join(",")).join(" ");
  return <section className="rounded-3xl border bg-card p-4 sm:p-6" aria-labelledby="muscle-title"><h2 id="muscle-title" className="text-xl font-semibold">Muscles trained</h2><p className="mt-1 text-sm text-muted-foreground">Where your completed sets add up</p>
    <svg viewBox="0 0 360 310" className="mx-auto mt-3 block w-full max-w-md" role="img" aria-label={`Muscle contribution: ${muscles.map((muscle) => `${muscle.name} ${muscle.value}`).join(", ")}`}>
      {[0.25, 0.5, 0.75, 1].map((fraction) => <polygon key={fraction} points={polygon(100 * fraction)} fill="none" className="stroke-border"/>)}
      {muscles.map((muscle, index) => { const [x, y] = point(index, 100); const [lx, ly] = point(index, 131); return <g key={muscle.name}><line x1="180" y1="155" x2={x} y2={y} className="stroke-border"/><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[12px]">{muscle.name}</text></g>; })}
      <polygon points={muscles.map((muscle, index) => point(index, muscle.value / max * 100).join(",")).join(" ")} className="fill-primary/20 stroke-primary" strokeWidth="2"/>
      {muscles.map((muscle, index) => { const [x, y] = point(index, muscle.value / max * 100); return <circle key={muscle.name} cx={x} cy={y} r="3" className="fill-primary"><title>{muscle.name}: {muscle.value}</title></circle>; })}
    </svg>
    <p className="text-xs leading-5 text-muted-foreground">Primary: 1 per set · Secondary: 0.5. Each group counts once per set, using its strongest involvement. Scale: 0–{max}.</p>
    <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-medium text-primary">View breakdown</summary><ul className="grid grid-cols-2 gap-2">{muscles.map((muscle) => <li key={muscle.name} className="flex justify-between gap-2 rounded-lg bg-background p-2"><span>{muscle.name}</span><strong>{muscle.value}</strong></li>)}</ul><p className="mt-2 text-xs text-muted-foreground">Hips includes hip flexors and adductors. Contributions describe involvement, not training quality or a prescribed balance.</p></details>
  </section>;
}
