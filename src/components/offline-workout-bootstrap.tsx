"use client";

import { useEffect } from "react";

import { getOfflineOutbox, getOfflineWorkout, putOfflineWorkout } from "@/lib/offline-db";
import type { OfflineWorkout } from "@/lib/offline-types";

export function OfflineWorkoutBootstrap({ snapshot, onReady, onError }: Readonly<{ snapshot: OfflineWorkout; onReady?: (workout: OfflineWorkout) => void; onError?: (message: string) => void }>) {
  useEffect(() => {
    void (async () => {
      const [local, outbox] = await Promise.all([getOfflineWorkout(snapshot.id), getOfflineOutbox()]);
      if (!local || (local.status !== "COMPLETED" && !outbox.some((mutation) => mutation.sessionId === snapshot.id))) await putOfflineWorkout(snapshot);
      onReady?.((await getOfflineWorkout(snapshot.id)) ?? snapshot);
      const mediaUrls = snapshot.exercises.flatMap((exercise) => { if (!exercise.imagePath) return []; const stem = exercise.imagePath.replace(/-1280\.webp$/, ""); return [`${stem}-640.avif`, `${stem}-1280.avif`, `${stem}-640.webp`, `${stem}-1280.webp`]; });
      const urls = ["/offline", ...snapshot.exercises.map((exercise) => `/offline/workout/${snapshot.id}/${exercise.id}`), `/offline/finish/${snapshot.id}`, `/offline/summary/${snapshot.id}`, ...mediaUrls];
      const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.ready : undefined;
      const worker = navigator.serviceWorker?.controller ?? registration?.active;
      worker?.postMessage({ type: "VICGYM_PREPARE_WORKOUT", urls });
    })().catch(() => onError?.("Local workout storage is unavailable. Reopen VicGym before logging sets."));
  }, [snapshot, onReady, onError]);
  return null;
}
