"use client";

import { CircleStop, HeartPulse, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { cardioElapsedSeconds, formatCardioDuration } from "@/lib/cardio";
import { getOfflineWorkout, putOfflineWorkout } from "@/lib/offline-db";
import { syncOfflineMutations } from "@/lib/offline-sync";
import { startCardioLocally, stopCardioLocally } from "@/lib/offline-workout";
import type { OfflineWorkout } from "@/lib/offline-types";

type CardioState = { planned: boolean; startedAt: string | null; stoppedAt: string | null; durationSeconds: number };

export function CardioTimer({ sessionId, initial, offlineSnapshot }: Readonly<{ sessionId: string; initial: CardioState; offlineSnapshot?: OfflineWorkout }>) {
  const [cardio, setCardio] = useState(initial);
  const [elapsed, setElapsed] = useState(() => cardioElapsedSeconds(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getOfflineWorkout(sessionId).then((workout) => {
      if (!workout) return;
      const local = { planned: workout.cardioPlanned ?? false, startedAt: workout.cardioStartedAt ?? null, stoppedAt: workout.cardioStoppedAt ?? null, durationSeconds: workout.cardioDurationSeconds ?? 0 };
      setCardio(local); setElapsed(cardioElapsedSeconds(local));
    }).catch(() => undefined);
  }, [sessionId]);

  useEffect(() => {
    if (!cardio.startedAt || cardio.stoppedAt) return;
    const tick = () => setElapsed(cardioElapsedSeconds(cardio));
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [cardio]);

  if (!cardio.planned) return null;

  async function ensureSnapshot() { if (!await getOfflineWorkout(sessionId) && offlineSnapshot) await putOfflineWorkout(offlineSnapshot); }
  async function start() {
    setBusy(true); setError("");
    try { await ensureSnapshot(); const startedAt = await startCardioLocally(sessionId); setCardio((current) => ({ ...current, startedAt, stoppedAt: null, durationSeconds: 0 })); void syncOfflineMutations(); }
    catch (value) { setError(value instanceof Error ? value.message : "Cardio could not be started"); }
    finally { setBusy(false); }
  }
  async function stop() {
    setBusy(true); setError("");
    try { const result = await stopCardioLocally(sessionId); setCardio((current) => ({ ...current, stoppedAt: result.stoppedAt, durationSeconds: result.durationSeconds })); setElapsed(result.durationSeconds); void syncOfflineMutations(); }
    catch (value) { setError(value instanceof Error ? value.message : "Cardio could not be stopped"); }
    finally { setBusy(false); }
  }

  const running = Boolean(cardio.startedAt && !cardio.stoppedAt);
  const completed = Boolean(cardio.stoppedAt);
  return <section className="mt-5 flex items-center gap-4 rounded-2xl border border-primary/20 bg-accent/60 p-4" aria-label="Cardio timer">
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white"><HeartPulse className="size-5"/></span>
    <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Generic cardio</p><p className="mt-0.5 text-2xl font-semibold tabular-nums">{formatCardioDuration(elapsed)}</p><p className="text-xs text-muted-foreground">{completed ? "Cardio completed" : running ? "Cardio in progress" : "Ready when you are"}</p>{error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}</div>
    {!cardio.startedAt && <button type="button" disabled={busy} onClick={() => void start()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60"><Play className="size-4"/>Start cardio</button>}
    {running && <button type="button" disabled={busy} onClick={() => void stop()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-white disabled:opacity-60"><CircleStop className="size-4"/>Stop</button>}
  </section>;
}
