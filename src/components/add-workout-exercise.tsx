"use client";

import { Check, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { getOfflineWorkout, putOfflineWorkout } from "@/lib/offline-db";
import { syncOfflineMutations } from "@/lib/offline-sync";
import type { OfflineCatalogueExercise, OfflineExercise, OfflineWorkout } from "@/lib/offline-types";
import { addExerciseLocally, AD_HOC_DEFAULT_REST_SECONDS, AD_HOC_DEFAULT_SETS } from "@/lib/offline-workout";
import { loadInputLabel } from "@/lib/load-tracking";

export function AddWorkoutExercise({ snapshot }: Readonly<{ snapshot: OfflineWorkout }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(""); const [busyId, setBusyId] = useState<string | null>(null); const [error, setError] = useState("");
  const [includedIds, setIncludedIds] = useState(() => new Set(snapshot.exercises.map((exercise) => exercise.exerciseId)));
  const catalogue = useMemo(() => snapshot.catalogue ?? [], [snapshot.catalogue]);
  const results = useMemo(() => catalogue.filter((exercise) => !includedIds.has(exercise.exerciseId) && `${exercise.name} ${exercise.slug} ${exercise.equipmentName ?? "bodyweight"}`.toLowerCase().includes(query.trim().toLowerCase())), [catalogue, includedIds, query]);

  async function show() {
    const local = await getOfflineWorkout(snapshot.id).catch(() => null);
    if (!local) await putOfflineWorkout(snapshot);
    setIncludedIds(new Set((local ?? snapshot).exercises.map((exercise) => exercise.exerciseId)));
    setError(""); setOpen(true);
  }

  async function add(exercise: OfflineCatalogueExercise) {
    setBusyId(exercise.exerciseId); setError("");
    try {
      const created = await addExerciseLocally(snapshot.id, exercise);
      setIncludedIds((current) => new Set([...current, exercise.exerciseId]));
      window.dispatchEvent(new CustomEvent<OfflineExercise>("vicgym:exercise-added", { detail: created }));
      setOpen(false);
      const status = await syncOfflineMutations();
      router.push(status === "synced" ? `/workouts/${snapshot.id}/exercises/${created.id}` : `/offline/workout/${snapshot.id}/${created.id}`);
      if (status === "synced") router.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : "Exercise could not be added"); }
    finally { setBusyId(null); }
  }

  return <>
    <button type="button" onClick={() => void show()} disabled={!catalogue.length} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-semibold disabled:opacity-50"><Plus className="size-4"/>Add exercise</button>
    {open && <div className="fixed inset-0 z-50 flex items-end bg-foreground/35 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="add-exercise-title">
      <section className="max-h-[88dvh] w-full overflow-hidden rounded-t-3xl border bg-background shadow-xl sm:max-w-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b bg-card p-5"><div><p className="text-sm font-semibold text-primary">Current session only</p><h2 id="add-exercise-title" className="mt-1 text-2xl font-semibold tracking-tight">Add exercise</h2><p className="mt-1 text-sm text-muted-foreground">Adds {AD_HOC_DEFAULT_SETS} sets with {AD_HOC_DEFAULT_REST_SECONDS}s rest. Your programme is unchanged.</p></div><button type="button" aria-label="Close exercise catalogue" onClick={() => setOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-xl border bg-background"><X className="size-4"/></button></div>
        <div className="p-4 sm:p-5"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"/><span className="sr-only">Search exercises</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or equipment" className="min-h-11 w-full rounded-xl border bg-white pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"/></label>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-4 max-h-[58dvh] space-y-2 overflow-y-auto pr-1">{results.map((exercise) => <button key={exercise.exerciseId} type="button" disabled={busyId !== null} onClick={() => void add(exercise)} className="flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border bg-card p-4 text-left disabled:opacity-60"><div><p className="font-semibold">{exercise.name}</p><p className="mt-1 text-xs text-muted-foreground">{exercise.equipmentName ?? "Bodyweight / no equipment"} · {loadInputLabel(exercise.loadTrackingType, exercise.loadEntryMode) ?? "Reps only"}</p></div>{busyId === exercise.exerciseId ? <span className="text-xs font-semibold text-primary">Adding…</span> : <Plus className="size-5 shrink-0 text-primary"/>}</button>)}{!results.length && <div className="rounded-2xl border border-dashed bg-card p-5 text-center text-sm text-muted-foreground"><Check className="mx-auto mb-2 size-5 text-primary"/>{query ? "No available exercises match your search." : "Every available catalogue exercise is already in this workout."}</div>}</div>
        </div>
      </section>
    </div>}
  </>;
}
