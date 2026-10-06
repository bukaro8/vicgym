"use client";

import { Check, ChevronLeft, ChevronRight, MessageSquareText, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getOfflineWorkout, putOfflineWorkout } from "@/lib/offline-db";
import { syncOfflineMutations } from "@/lib/offline-sync";
import { addSetLocally, saveSetLocally } from "@/lib/offline-workout";
import type { OfflineWorkout } from "@/lib/offline-types";
import { effortValues, effortLabel, type SetEffortValue } from "@/lib/set-effort";
import { isExternalLoad, loadInputLabel, type LoadEntryModeValue, type LoadTrackingTypeValue } from "@/lib/load-tracking";
import type { RestTimerDto } from "@/server/rest-timers";

type SetRow = { effort?: SetEffortValue | null; id: string; setNumber: number; targetReps: number; actualReps: number | null; weightKg: number | null; loadValue?: number | null; loadTrackingType?: LoadTrackingTypeValue | null; loadEntryMode?: LoadEntryModeValue | null; completedAt: string | null; notes?: string | null };
type EditableSet = SetRow & { repsInput: string; weightInput: string; notesInput: string; dirty: boolean; saving: boolean };

function editableSet(set: SetRow): EditableSet {
  const value = (set.loadTrackingType ?? null) === null ? set.weightKg : (set.loadValue ?? null);
  return { ...set, loadValue: set.loadValue ?? null, loadTrackingType: set.loadTrackingType ?? null, repsInput: String(set.actualReps ?? set.targetReps), weightInput: value === null ? "" : String(value), notesInput: set.notes ?? "", dirty: false, saving: false };
}

function compactPrevious(performance: string[] | undefined, setNumber: number): string {
  const previous = performance?.find((entry) => entry.startsWith(`Set ${setNumber}:`));
  return previous?.replace(/^Set \d+:\s*/, "").replace(" kg per dumbbell", " kg/DB") ?? "—";
}

export function ActiveExercise({ sessionId, exerciseSessionId, initialSets, loadTrackingType: suppliedLoadTrackingType, loadEntryMode: suppliedLoadEntryMode, previousId, nextId, offlineSnapshot, previousPerformance, onSetSaved, showNavigation = true }: Readonly<{ sessionId: string; exerciseSessionId: string; initialSets: SetRow[]; loadTrackingType?: LoadTrackingTypeValue | null; loadEntryMode?: LoadEntryModeValue | null; previousId: string | null; nextId: string | null; offlineSnapshot?: OfflineWorkout; previousPerformance?: string[]; onSetSaved?: (newlyCompleted: boolean) => void; showNavigation?: boolean }>) {
  const loadTrackingType = suppliedLoadTrackingType ?? initialSets[0]?.loadTrackingType ?? null;
  const loadEntryMode = suppliedLoadEntryMode ?? initialSets[0]?.loadEntryMode ?? null;
  const [sets, setSets] = useState<EditableSet[]>(() => initialSets.map(editableSet));
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [ratingSetId, setRatingSetId] = useState<string | null>(null);

  useEffect(() => { void getOfflineWorkout(sessionId).then((workout) => { const local = workout?.exercises.find((exercise) => exercise.id === exerciseSessionId); if (local) setSets(local.sets.map(editableSet)); }).catch(() => undefined); }, [exerciseSessionId, sessionId]);

  function change(id: string, field: "repsInput" | "weightInput" | "notesInput", value: string) { setSets((current) => current.map((set) => set.id === id ? { ...set, [field]: value, dirty: true } : set)); }
  async function ensureLocalSnapshot() { if (!await getOfflineWorkout(sessionId) && offlineSnapshot) await putOfflineWorkout(offlineSnapshot); }
  async function save(id: string, effortOverride?: SetEffortValue | null) {
    const row = sets.find((set) => set.id === id); if (!row || row.saving) return;
    const effort = effortOverride === undefined ? row.effort ?? null : effortOverride;
    const newlyCompleted = !row.completedAt;
    setError(""); setSets((current) => current.map((set) => set.id === id ? { ...set, effort, saving: true } : set));
    try {
      await ensureLocalSnapshot();
      const data = await saveSetLocally({ sessionId, exerciseSessionId, setId: id, actualReps: Number(row.repsInput), loadValue: row.weightInput === "" ? null : Number(row.weightInput), completed: true, notes: row.notesInput, effort });
      setSets((current) => current.map((set) => set.id === id ? { ...editableSet(data.set), saving: false } : set));
      setRatingSetId(null);
      if (data.timer) window.dispatchEvent(new CustomEvent<{ timer: RestTimerDto }>("vicgym:timer-started", { detail: { timer: data.timer } }));
      onSetSaved?.(newlyCompleted);
      void syncOfflineMutations();
    } catch (value) { setError(value instanceof Error ? value.message : "Set could not be saved"); setSets((current) => current.map((set) => set.id === id ? { ...set, saving: false } : set)); }
  }
  async function addSet() {
    setAdding(true); setError("");
    try { await ensureLocalSnapshot(); const set = await addSetLocally(sessionId, exerciseSessionId); setSets((current) => [...current, editableSet(set)]); void syncOfflineMutations(); }
    catch (value) { setError(value instanceof Error ? value.message : "Set could not be added"); } finally { setAdding(false); }
  }
  const loadLabel = loadInputLabel(loadTrackingType, loadEntryMode);
  const showLoad = isExternalLoad(loadTrackingType) && loadLabel !== null;
  const loadHeading = loadTrackingType === "MACHINE_LEVEL" ? "LEVEL" : loadEntryMode === "PER_DUMBBELL" ? "KG/DB" : "KG";
  const columns = showLoad ? "2rem minmax(0,1fr) 2.75rem 2.75rem 4.5rem" : "2rem minmax(0,1fr) 2.75rem 4.5rem";
  const ratingSet = sets.find((set) => set.id === ratingSetId);
  const effortDescriptions: Record<SetEffortValue, string> = { EASY: "Could have done several more reps", MODERATE: "Challenging but controlled", HARD: "Very difficult with good form" };
  const inputClass = "h-10 w-full min-w-0 rounded-lg border bg-white px-0.5 text-center text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
  function offlineNavigation(event: React.MouseEvent<HTMLAnchorElement>, target: string) { if (navigator.onLine) return; event.preventDefault(); window.location.assign(target); }

  return <>
    <div className="mt-3 min-w-0">
      <div className="grid items-center gap-0.5 px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: columns }}><span>Set</span><span>Previous</span>{showLoad && <span title={loadLabel ?? undefined} className="text-center">{loadHeading}</span>}<span className="text-center">Reps</span><span className="text-center">Complete</span></div>
      <div className="space-y-1.5">{sets.map((set) => {
        const previous = compactPrevious(previousPerformance, set.setNumber);
        return <div key={set.id} className={`rounded-xl border px-1 py-1.5 ${set.completedAt ? "border-primary/25 bg-accent/45" : "bg-background"}`}>
          <div className="grid min-w-0 items-center gap-0.5" style={{ gridTemplateColumns: columns }}>
            <div className="flex min-w-0 flex-col items-center gap-0.5"><span className={`text-xs font-semibold tabular-nums ${set.completedAt ? "text-primary" : ""}`}>{set.setNumber}</span><button type="button" aria-label={`Set ${set.setNumber} notes`} title={set.notesInput ? "Edit set notes" : "Add set notes"} aria-expanded={Boolean(notesOpen[set.id])} onClick={() => setNotesOpen((current) => ({ ...current, [set.id]: !current[set.id] }))} className={`grid size-7 place-items-center rounded-md ${set.notesInput ? "text-primary" : "text-muted-foreground"}`}><MessageSquareText className="size-4"/></button></div>
            <span title={previous} className="min-w-0 break-words text-[11px] leading-tight text-muted-foreground">{previous}</span>
            {showLoad && <input aria-label={`Set ${set.setNumber} ${loadLabel?.toLowerCase()}`} inputMode={loadTrackingType === "MACHINE_LEVEL" ? "numeric" : "decimal"} min="0" type="number" step={loadTrackingType === "MACHINE_LEVEL" ? "1" : "0.25"} value={set.weightInput} onChange={(event) => change(set.id, "weightInput", event.target.value)} className={inputClass}/>}
            <input aria-label={`Set ${set.setNumber} reps`} inputMode="numeric" min="0" type="number" value={set.repsInput} onChange={(event) => change(set.id, "repsInput", event.target.value)} className={inputClass}/>
            <button type="button" aria-label={set.completedAt ? `Edit set ${set.setNumber} effort` : `Complete set ${set.setNumber}`} title={set.completedAt ? "Review set and effort" : "Complete set"} disabled={set.saving || !set.repsInput} onClick={() => { setError(""); setRatingSetId(set.id); }} className={`grid h-10 w-full place-items-center rounded-lg border text-xs font-semibold disabled:opacity-50 ${set.completedAt ? "border-primary bg-primary text-white" : "border-primary/40 bg-white text-primary"}`}>{set.saving ? "…" : <Check className="size-5"/>}</button>
          </div>
          {notesOpen[set.id] && <label className="mt-1.5 block text-xs font-medium text-muted-foreground">Set {set.setNumber} notes<input aria-label={`Set ${set.setNumber} notes input`} value={set.notesInput} onChange={(event) => change(set.id, "notesInput", event.target.value)} maxLength={500} placeholder="Add a brief set note" className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm text-foreground outline-none focus:border-primary"/></label>}
        </div>;
      })}</div>
    </div>
    <button type="button" disabled={adding} onClick={() => void addSet()} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border bg-card text-sm font-semibold"><Plus className="size-4"/>{adding ? "Adding…" : "Add set"}</button>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {ratingSet && <div className="fixed inset-0 z-[70] grid place-items-center bg-foreground/55 p-4 backdrop-blur-sm" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="effort-title" className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 id="effort-title" className="text-lg font-semibold">Set {ratingSet.setNumber} effort</h2><p className="mt-1 text-sm text-muted-foreground">How did that set feel? Rating is optional.</p></div><button type="button" aria-label="Close effort rating" disabled={ratingSet.saving} onClick={() => setRatingSetId(null)} className="grid size-10 shrink-0 place-items-center rounded-full bg-muted"><X className="size-5"/></button></div><div className="mt-4 space-y-2">{effortValues.map((effort) => <button key={effort} type="button" aria-label={effortLabel[effort]} aria-pressed={ratingSet.effort === effort} disabled={ratingSet.saving} onClick={() => void save(ratingSet.id, effort)} className={`w-full rounded-2xl border px-4 py-3 text-left disabled:opacity-50 ${ratingSet.effort === effort ? "border-primary bg-accent" : "bg-white"}`}><span className="block text-base font-semibold">{effortLabel[effort]}</span><span className="mt-0.5 block text-xs text-muted-foreground">{effortDescriptions[effort]}</span></button>)}</div><button type="button" disabled={ratingSet.saving} onClick={() => void save(ratingSet.id, null)} className="mt-3 min-h-11 w-full rounded-xl border bg-white px-4 text-sm font-semibold disabled:opacity-50">{ratingSet.effort ? "Clear rating" : "Skip — no rating"}</button>{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}</section></div>}
    {showNavigation && <nav className="mt-6 grid grid-cols-2 gap-3" aria-label="Exercise navigation">{previousId ? <Link onClick={(event) => offlineNavigation(event, `/offline/workout/${sessionId}/${previousId}`)} href={`/workouts/${sessionId}/exercises/${previousId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border bg-card font-semibold"><ChevronLeft/>Previous</Link> : <span className="inline-flex min-h-12 items-center justify-center rounded-2xl border bg-muted text-muted-foreground">First exercise</span>}{nextId ? <Link onClick={(event) => offlineNavigation(event, `/offline/workout/${sessionId}/${nextId}`)} href={`/workouts/${sessionId}/exercises/${nextId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-foreground text-white font-semibold">Next<ChevronRight/></Link> : <Link onClick={(event) => offlineNavigation(event, `/offline/finish/${sessionId}`)} href={`/workouts/${sessionId}/finish`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-white font-semibold">Review finish<ChevronRight/></Link>}</nav>}
  </>;
}
