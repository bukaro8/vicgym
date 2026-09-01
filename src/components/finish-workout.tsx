"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { syncOfflineMutations } from "@/lib/offline-sync";
import { finishWorkoutLocally } from "@/lib/offline-workout";

export function FinishWorkout({ sessionId, incomplete }: Readonly<{ sessionId: string; incomplete: boolean }>) {
  const router = useRouter(); const [confirmed, setConfirmed] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function finish() { setPending(true); setError(""); try { await finishWorkoutLocally(sessionId); const status = await syncOfflineMutations(); router.push(status === "synced" ? `/workouts/${sessionId}/summary` : `/offline/summary/${sessionId}`); router.refresh(); } catch (value) { setError(value instanceof Error ? value.message : "Workout could not be finished"); setPending(false); } }
  return <div>{incomplete && <label className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-5 accent-[var(--primary)]"/><span><strong className="block">Finish with incomplete planned sets</strong><span className="mt-1 block text-amber-800">Incomplete sets stay in raw history as incomplete. Nothing is fabricated or deleted.</span></span></label>}<button type="button" disabled={pending || (incomplete && !confirmed)} onClick={() => void finish()} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-white disabled:opacity-50"><CheckCircle2 className="size-5"/>{pending ? "Finishing…" : "Finish workout"}</button>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</div>;
}
