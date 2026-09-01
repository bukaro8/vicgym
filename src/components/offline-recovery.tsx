"use client";

import { CloudOff, Dumbbell, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { getActiveOfflineWorkout } from "@/lib/offline-db";
import type { OfflineWorkout } from "@/lib/offline-types";

export function OfflineRecovery() {
  const [workout, setWorkout] = useState<OfflineWorkout | null | undefined>(undefined);
  useEffect(() => { void getActiveOfflineWorkout().then(setWorkout).catch(() => setWorkout(null)); }, []);
  return <main className="mx-auto grid min-h-dvh w-full max-w-lg place-items-center px-5 py-10"><section className="w-full rounded-3xl border bg-card p-6 text-center shadow-sm"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-primary"><CloudOff className="size-7"/></span><h1 className="mt-5 text-3xl font-semibold tracking-tight">VicGym is offline</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Your active workout, sets, and rest timer are stored on this device. They will synchronize when the connection returns.</p>{workout && <a href={`/offline/workout/${workout.id}/${workout.currentExerciseId ?? workout.exercises[0]?.id}`} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-white"><Dumbbell className="size-5"/>Resume {workout.workoutDayName}</a>}<button type="button" onClick={() => window.location.reload()} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border bg-card px-5 font-semibold"><RefreshCw className="size-4"/>Try again</button>{workout === null && <p className="mt-4 text-xs text-muted-foreground">No locally saved active workout was found.</p>}</section></main>;
}
