"use client";

import { useEffect, useState } from "react";
import { getOfflineOutbox, getOfflineWorkout, retryFailedOfflineMutations, updateOfflineWorkout } from "@/lib/offline-db";
import { syncOfflineMutations } from "@/lib/offline-sync";
import type { OfflineMutation } from "@/lib/offline-types";

export function WorkoutSyncRecovery({ sessionId }: { sessionId: string }) {
  const [failures, setFailures] = useState<OfflineMutation[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const inspect = () => { void getOfflineOutbox().then((items) => setFailures(items.filter((item) => item.sessionId === sessionId && item.lastError))).catch(() => undefined); };
    inspect(); window.addEventListener("vicgym:outbox-changed", inspect);
    return () => window.removeEventListener("vicgym:outbox-changed", inspect);
  }, [sessionId]);
  async function exportData() {
    const workout = await getOfflineWorkout(sessionId);
    const mutations = (await getOfflineOutbox()).filter((item) => item.sessionId === sessionId);
    const url = URL.createObjectURL(new Blob([JSON.stringify({ workout, mutations }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `vicgym-workout-${sessionId}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function review() {
    const workout = await updateOfflineWorkout(sessionId, (item) => {
      if (item.completionReceiptId) throw new Error("This workout is already confirmed by the server.");
      return { ...item, status: "IN_PROGRESS" };
    });
    // A full navigation allows the service worker to serve the prepared shell
    // when the device has no connection.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (workout) window.location.assign(`/offline/workout/${sessionId}/${workout.currentExerciseId ?? workout.exercises[0]?.id}`);
  }
  return <section className="mt-4 rounded-2xl border p-4 text-left text-sm">
    {failures.length > 0 && <><p className="font-semibold">Some changes need review</p><ul className="mt-2 space-y-2">{failures.map((item) => <li key={item.id} className="break-words">{item.lastError}</li>)}</ul></>}
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" className="min-h-11 rounded-xl border px-3" onClick={() => void exportData().catch(() => setMessage("Export could not be created."))}>Export saved workout</button>
      <button type="button" className="min-h-11 rounded-xl border px-3" onClick={() => void retryFailedOfflineMutations().then(() => syncOfflineMutations()).catch(() => setMessage("Retry could not start."))}>Retry upload</button>
      {failures.some((item) => item.type === "COMPLETE_WORKOUT") && <button type="button" className="min-h-11 rounded-xl border px-3" onClick={() => void review().catch((error) => setMessage(error.message))}>Review local workout</button>}
    </div><p className="mt-2 text-muted-foreground">Your saved copy stays on this device until the server confirms completion. Export it before clearing browser data.</p>{message && <p role="status">{message}</p>}
  </section>;
}
