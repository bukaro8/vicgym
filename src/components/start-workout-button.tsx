"use client";

import { Dumbbell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartWorkoutButton({ workoutDayId, label = "Start workout" }: Readonly<{ workoutDayId: string; label?: string }>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/workouts/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workoutDayId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start workout");
      router.push(`/workouts/${data.sessionId}/exercises/${data.exerciseSessionId}`);
    } catch (value) { setError(value instanceof Error ? value.message : "Could not start workout"); setPending(false); }
  }
  return <div><button type="button" disabled={pending} onClick={start} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"><Dumbbell className="size-4" />{pending ? "Starting…" : label}</button>{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}</div>;
}
