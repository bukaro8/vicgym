"use client";

import { CheckCircle2, Clock3, ListChecks } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { FinishWorkout } from "@/components/finish-workout";
import { getOfflineWorkout } from "@/lib/offline-db";
import type { OfflineWorkout } from "@/lib/offline-types";

export function OfflineFinishView({ sessionId }: Readonly<{ sessionId: string }>) {
  const [workout, setWorkout] = useState<OfflineWorkout | null | undefined>(undefined); const [loadedAt, setLoadedAt] = useState<number>();
  useEffect(() => { void getOfflineWorkout(sessionId).then((local) => { setLoadedAt(Date.now()); setWorkout(local); }).catch(() => setWorkout(null)); }, [sessionId]);
  if (!workout) return <AppShell><main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 text-muted-foreground">{workout === undefined ? "Loading locally saved workout…" : "Locally saved workout unavailable. Reconnect and try again."}</main></AppShell>;
  const completedSets = workout.exercises.flatMap((item) => item.sets).filter((set) => set.completedAt).length; const plannedSets = workout.exercises.reduce((sum, item) => sum + item.plannedSets, 0); const completedExercises = workout.exercises.filter((item) => item.sets.filter((set) => set.completedAt).length >= item.plannedSets).length; const minutes = Math.max(0, Math.floor(((loadedAt ?? new Date(workout.startedAt).getTime()) - new Date(workout.startedAt).getTime()) / 60_000));
  return <AppShell><main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:px-8 sm:py-10"><a href={`/offline/workout/${sessionId}/${workout.currentExerciseId ?? workout.exercises[0]?.id}`} className="text-sm font-medium text-muted-foreground">← Back to workout</a><p className="mt-7 text-sm font-semibold text-primary">Finish workout · offline</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Review {workout.workoutDayName}</h1><div className="mt-6 grid grid-cols-3 gap-3"><Metric icon={<CheckCircle2 className="size-5 text-primary"/>} value={`${completedExercises}/${workout.exercises.length}`} label="Exercises"/><Metric icon={<ListChecks className="size-5 text-primary"/>} value={`${completedSets}/${plannedSets}`} label="Planned sets"/><Metric icon={<Clock3 className="size-5 text-primary"/>} value={`${minutes}m`} label="Duration"/></div><section className="mt-6 rounded-3xl border bg-card p-5"><h2 className="text-lg font-semibold">Exercise status</h2><ul className="mt-4 space-y-3">{workout.exercises.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"><span className="font-medium">{item.name}</span><span className="text-sm text-muted-foreground">{item.sets.filter((set) => set.completedAt).length}/{item.plannedSets} planned sets</span></li>)}</ul></section><div className="mt-6"><FinishWorkout sessionId={sessionId} incomplete={completedSets < plannedSets}/></div></main></AppShell>;
}

function Metric({ icon, value, label }: Readonly<{ icon: React.ReactNode; value: string; label: string }>) { return <div className="rounded-2xl border bg-card p-4">{icon}<p className="mt-3 text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>; }
