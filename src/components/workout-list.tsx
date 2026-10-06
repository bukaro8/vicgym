"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AddWorkoutExercise } from "@/components/add-workout-exercise";
import { CardioTimer } from "@/components/cardio-timer";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { OfflineWorkoutBootstrap } from "@/components/offline-workout-bootstrap";
import { WorkoutExerciseCard } from "@/components/workout-exercise-card";
import { getOfflineWorkout } from "@/lib/offline-db";
import type { OfflineWorkout } from "@/lib/offline-types";

export function WorkoutList({ sessionId, snapshot, newerProgrammeVersionActive = false }: Readonly<{ sessionId: string; snapshot?: OfflineWorkout; newerProgrammeVersionActive?: boolean }>) {
  const [workout, setWorkout] = useState<OfflineWorkout | null>();
  const [error, setError] = useState("");
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    const refresh = () => { void getOfflineWorkout(sessionId).then((local) => { if (mounted && local) setWorkout(local); else if (mounted && !snapshot) setWorkout(null); }).catch(() => { if (mounted) setError("Local workout storage is unavailable. Reopen VicGym before logging sets."); }); };
    if (!snapshot) refresh();
    window.addEventListener("vicgym:outbox-changed", refresh);
    window.addEventListener("vicgym:exercise-added", refresh);
    return () => { mounted = false; window.removeEventListener("vicgym:outbox-changed", refresh); window.removeEventListener("vicgym:exercise-added", refresh); };
  }, [sessionId, snapshot]);
  const exercises = [...(workout?.exercises ?? [])].sort((a, b) => a.position - b.position);
  const sets = exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) => set.completedAt).length;
  async function afterSetSaved(exerciseId: string, newlyCompleted: boolean) {
    if (!newlyCompleted) return;
    const local = await getOfflineWorkout(sessionId).catch(() => null);
    if (!local) return;
    setWorkout(local);
    const ordered = [...local.exercises].sort((a, b) => a.position - b.position);
    const currentIndex = ordered.findIndex((exercise) => exercise.id === exerciseId);
    const current = ordered[currentIndex];
    if (!current || current.sets.filter((set) => set.completedAt).length < current.plannedSets || current.sets.some((set) => !set.completedAt)) return;
    const next = [...ordered.slice(currentIndex + 1), ...ordered.slice(0, currentIndex)].find((exercise) => exercise.sets.filter((set) => set.completedAt).length < exercise.plannedSets || exercise.sets.some((set) => !set.completedAt));
    setExpandedExerciseId((selected) => selected === exerciseId ? next?.id ?? null : selected);
  }
  return <AppShell>
    {snapshot && <OfflineWorkoutBootstrap snapshot={snapshot} onReady={setWorkout} onError={setError}/>}
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 sm:px-8 sm:py-8">
      {!workout ? <p role="status" className="text-sm text-muted-foreground">{error || (workout === null ? "Local workout unavailable. Reconnect to reload this workout." : "Loading locally saved workout…")}</p> : workout.status === "COMPLETED" ? <section className="rounded-2xl border bg-card p-5"><h1 className="text-xl font-semibold">Workout saved</h1><OfflineAwareLink href={`/offline/summary/${sessionId}`} offlineHref={`/offline/summary/${sessionId}`} className="mt-4 inline-flex min-h-11 items-center text-primary">View workout summary</OfflineAwareLink></section> : <>
        <p className="text-xs font-semibold text-primary">Programme version {workout.programVersionNumber}</p>
        <h1 className="mt-1 text-2xl font-semibold">{workout.workoutDayName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Train in any order. Open a card to log your sets.</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><AddWorkoutExercise snapshot={workout} stayOnWorkout/><OfflineAwareLink href={`/workouts/${sessionId}/finish`} offlineHref={`/offline/finish/${sessionId}`} className="inline-flex min-h-11 items-center rounded-xl border bg-card px-4 text-sm font-semibold">Finish workout</OfflineAwareLink></div>
        {newerProgrammeVersionActive && <p className="mt-4 rounded-xl border bg-accent p-3 text-sm">This session keeps its original programme settings. New programme changes apply to your next workout.</p>}
        <p className="mt-5 text-sm font-medium" aria-live="polite">{completed}/{sets.length} sets complete</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${sets.length ? completed / sets.length * 100 : 0}%` }}/></div>
        <CardioTimer sessionId={sessionId} initial={{ planned: workout.cardioPlanned ?? false, startedAt: workout.cardioStartedAt ?? null, stoppedAt: workout.cardioStoppedAt ?? null, durationSeconds: workout.cardioDurationSeconds ?? 0 }}/>
        <div className="mt-5 space-y-3">{exercises.map((exercise) => <WorkoutExerciseCard key={exercise.id} sessionId={sessionId} exercise={exercise} expanded={expandedExerciseId === exercise.id} onToggle={() => setExpandedExerciseId((current) => current === exercise.id ? null : exercise.id)} onSetSaved={(newlyCompleted) => void afterSetSaved(exercise.id, newlyCompleted)}/>)}</div>
        <OfflineAwareLink href={`/workouts/${sessionId}/finish`} offlineHref={`/offline/finish/${sessionId}`} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-white">Finish workout</OfflineAwareLink>
      </>}
    </main>
  </AppShell>;
}
