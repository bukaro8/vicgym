"use client";

import { useEffect } from "react";

import { getOfflineOutbox, getOfflineWorkout, putOfflineWorkout } from "@/lib/offline-db";
import type { OfflineWorkout } from "@/lib/offline-types";

export function OfflineWorkoutBootstrap({ snapshot }: Readonly<{ snapshot: OfflineWorkout }>) {
  useEffect(() => {
    void (async () => {
      const [local, outbox] = await Promise.all([getOfflineWorkout(snapshot.id), getOfflineOutbox()]);
      if (!local || !outbox.some((mutation) => mutation.sessionId === snapshot.id)) await putOfflineWorkout(snapshot);
      const mediaUrls = snapshot.exercises.flatMap((exercise) => { if (!exercise.imagePath) return []; const stem = exercise.imagePath.replace(/-1280\.webp$/, ""); return [`${stem}-640.avif`, `${stem}-1280.avif`, `${stem}-640.webp`, `${stem}-1280.webp`]; });
      const urls = ["/offline", ...snapshot.exercises.map((exercise) => `/workouts/${snapshot.id}/exercises/${exercise.id}`), ...snapshot.exercises.map((exercise) => `/offline/workout/${snapshot.id}/${exercise.id}`), `/workouts/${snapshot.id}/finish`, `/offline/finish/${snapshot.id}`, `/offline/summary/${snapshot.id}`, ...mediaUrls];
      const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.ready : undefined;
      const worker = navigator.serviceWorker?.controller ?? registration?.active;
      worker?.postMessage({ type: "VICGYM_PREPARE_WORKOUT", urls });
    })().catch(() => undefined);
  }, [snapshot]);
  return null;
}
