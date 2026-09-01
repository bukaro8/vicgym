"use client";

import { Check, ChevronLeft, ChevronRight, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getOfflineWorkout, putOfflineWorkout } from "@/lib/offline-db";
import { syncOfflineMutations } from "@/lib/offline-sync";
import { addSetLocally, saveSetLocally } from "@/lib/offline-workout";
import type { OfflineWorkout } from "@/lib/offline-types";
import type { RestTimerDto } from "@/server/rest-timers";
import { isExternalLoad, loadInputLabel, type LoadEntryModeValue, type LoadTrackingTypeValue } from "@/lib/load-tracking";

type SetRow = { id: string; setNumber: number; targetReps: number; actualReps: number | null; weightKg: number | null; loadValue?: number | null; loadTrackingType?: LoadTrackingTypeValue | null; loadEntryMode?: LoadEntryModeValue | null; completedAt: string | null };

export function ActiveExercise({ sessionId, exerciseSessionId, initialSets, loadTrackingType: suppliedLoadTrackingType, loadEntryMode: suppliedLoadEntryMode, previousId, nextId, offlineSnapshot }: Readonly<{ sessionId: string; exerciseSessionId: string; initialSets: SetRow[]; loadTrackingType?: LoadTrackingTypeValue | null; loadEntryMode?: LoadEntryModeValue | null; previousId: string | null; nextId: string | null; offlineSnapshot?: OfflineWorkout }>) {
  const loadTrackingType = suppliedLoadTrackingType ?? initialSets[0]?.loadTrackingType ?? null;
  const loadEntryMode = suppliedLoadEntryMode ?? initialSets[0]?.loadEntryMode ?? null;
  const displayedLoad = (set: SetRow) => (set.loadTrackingType ?? null) === null ? set.weightKg : (set.loadValue ?? null);
  const [sets, setSets] = useState(initialSets.map((set) => ({ ...set, repsInput: String(set.actualReps ?? set.targetReps), weightInput: displayedLoad(set) === null ? "" : String(displayedLoad(set)), dirty: false, saving: false })));
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => { void getOfflineWorkout(sessionId).then((workout) => { const local = workout?.exercises.find((exercise) => exercise.id === exerciseSessionId); if (local) setSets(local.sets.map((set) => { const value = (set.loadTrackingType ?? null) === null ? set.weightKg : (set.loadValue ?? null); return { ...set, loadValue: set.loadValue ?? null, loadTrackingType: set.loadTrackingType ?? null, repsInput: String(set.actualReps ?? set.targetReps), weightInput: value === null ? "" : String(value), dirty: false, saving: false }; })); }).catch(() => undefined); }, [exerciseSessionId, sessionId]);

  function change(id: string, field: "repsInput" | "weightInput", value: string) { setSets((current) => current.map((set) => set.id === id ? { ...set, [field]: value, dirty: true } : set)); }
  async function ensureLocalSnapshot() { if (!await getOfflineWorkout(sessionId) && offlineSnapshot) await putOfflineWorkout(offlineSnapshot); }
  async function save(id: string) {
    const row = sets.find((set) => set.id === id); if (!row) return;
    setError(""); setSets((current) => current.map((set) => set.id === id ? { ...set, saving: true } : set));
    try {
      await ensureLocalSnapshot();
      const data = await saveSetLocally({ sessionId, exerciseSessionId, setId: id, actualReps: Number(row.repsInput), loadValue: row.weightInput === "" ? null : Number(row.weightInput), completed: true });
      setSets((current) => current.map((set) => set.id === id ? { ...set, actualReps: data.set.actualReps, weightKg: data.set.weightKg, loadValue: data.set.loadValue ?? null, loadTrackingType: data.set.loadTrackingType ?? null, completedAt: data.set.completedAt, dirty: false, saving: false } : set));
      if (data.timer) window.dispatchEvent(new CustomEvent<{ timer: RestTimerDto }>("vicgym:timer-started", { detail: { timer: data.timer } }));
      void syncOfflineMutations();
    } catch (value) { setError(value instanceof Error ? value.message : "Set could not be saved"); setSets((current) => current.map((set) => set.id === id ? { ...set, saving: false } : set)); }
  }
  async function addSet() {
    setAdding(true); setError("");
    try { await ensureLocalSnapshot(); const set = await addSetLocally(sessionId, exerciseSessionId); setSets((current) => [...current, { ...set, loadValue: set.loadValue ?? null, loadTrackingType: set.loadTrackingType ?? null, repsInput: String(set.actualReps), weightInput: "", dirty: false, saving: false }]); void syncOfflineMutations(); }
    catch (value) { setError(value instanceof Error ? value.message : "Set could not be added"); } finally { setAdding(false); }
  }
  const inputClass = "min-h-11 w-full rounded-xl border bg-white px-3 text-center text-base tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
  function offlineNavigation(event: React.MouseEvent<HTMLAnchorElement>, target: string) { if (navigator.onLine) return; event.preventDefault(); window.location.assign(target); }
  const loadLabel = loadInputLabel(loadTrackingType, loadEntryMode);
  const showLoad = isExternalLoad(loadTrackingType) && loadLabel !== null;
  return <><div className="mt-5 space-y-3">{sets.map((set) => <article key={set.id} className={`rounded-2xl border p-4 transition-colors ${set.completedAt ? "border-primary/30 bg-accent/55" : "bg-background"}`}><div className="flex items-center justify-between"><p className="font-semibold">Set {set.setNumber}</p>{set.completedAt && <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Check className="size-3.5"/>Completed</span>}</div><div className={`mt-3 grid gap-3 ${showLoad ? "grid-cols-2" : "grid-cols-1"}`}>{showLoad && <label className="text-xs font-medium text-muted-foreground">{loadLabel}<input aria-label={`Set ${set.setNumber} ${loadLabel.toLowerCase()}`} inputMode={loadTrackingType === "MACHINE_LEVEL" ? "numeric" : "decimal"} min="0" type="number" step={loadTrackingType === "MACHINE_LEVEL" ? "1" : "0.25"} value={set.weightInput} onChange={(event) => change(set.id, "weightInput", event.target.value)} className={`${inputClass} mt-1.5`}/></label>}<label className="text-xs font-medium text-muted-foreground">Reps<input aria-label={`Set ${set.setNumber} reps`} inputMode="numeric" min="0" type="number" value={set.repsInput} onChange={(event) => change(set.id, "repsInput", event.target.value)} className={`${inputClass} mt-1.5`}/></label></div><button type="button" disabled={set.saving || !set.repsInput} onClick={() => void save(set.id)} className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ${set.completedAt ? "border bg-white text-primary" : "bg-primary text-white"}`}>{set.saving ? "Saving…" : set.completedAt ? <><Save className="size-4"/>Save changes</> : <><Check className="size-4"/>Complete set</>}</button></article>)}</div>
    <button type="button" disabled={adding} onClick={() => void addSet()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border bg-card text-sm font-semibold"><Plus className="size-4"/>{adding ? "Adding…" : "Add set"}</button>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <nav className="mt-6 grid grid-cols-2 gap-3" aria-label="Exercise navigation">{previousId ? <Link onClick={(event) => offlineNavigation(event, `/offline/workout/${sessionId}/${previousId}`)} href={`/workouts/${sessionId}/exercises/${previousId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border bg-card font-semibold"><ChevronLeft/>Previous</Link> : <span className="inline-flex min-h-12 items-center justify-center rounded-2xl border bg-muted text-muted-foreground">First exercise</span>}{nextId ? <Link onClick={(event) => offlineNavigation(event, `/offline/workout/${sessionId}/${nextId}`)} href={`/workouts/${sessionId}/exercises/${nextId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-foreground text-white font-semibold">Next<ChevronRight/></Link> : <Link onClick={(event) => offlineNavigation(event, `/offline/finish/${sessionId}`)} href={`/workouts/${sessionId}/finish`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-white font-semibold">Review finish<ChevronRight/></Link>}</nav>
  </>;
}
