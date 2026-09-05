"use client";

import { Dumbbell, HeartPulse, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartWorkoutButton({ workoutDayId, label = "Start workout" }: Readonly<{ workoutDayId: string; label?: string }>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);
  async function start(cardioPlanned: boolean) {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/workouts/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workoutDayId, cardioPlanned }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start workout");
      router.push(`/workouts/${data.sessionId}/exercises/${data.exerciseSessionId}`);
    } catch (value) { setError(value instanceof Error ? value.message : "Could not start workout"); setPending(false); }
  }
  return <div><button type="button" disabled={pending} onClick={() => setAsking(true)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"><Dumbbell className="size-4" />{pending ? "Starting…" : label}</button>{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}{asking && <div className="fixed inset-0 z-[70] grid place-items-center bg-foreground/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cardio-question"><section className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-accent text-primary"><HeartPulse className="size-6"/></span><button type="button" disabled={pending} onClick={() => setAsking(false)} className="grid size-10 place-items-center rounded-full bg-muted" aria-label="Cancel"><X className="size-5"/></button></div><h2 id="cardio-question" className="mt-5 text-2xl font-semibold">Are you doing cardio?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Choosing yes adds a separate generic cardio counter. It will wait until you press Start cardio.</p><button type="button" disabled={pending} onClick={() => void start(true)} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-white disabled:opacity-60"><HeartPulse className="size-5"/>{pending ? "Starting…" : "Yes, add cardio"}</button><button type="button" disabled={pending} onClick={() => void start(false)} className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border bg-card px-5 font-semibold disabled:opacity-60">No cardio today</button></section></div>}</div>;
}
