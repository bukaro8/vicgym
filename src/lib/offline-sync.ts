import { getOfflineOutbox, markOfflineMutationFailed, removeOfflineMutations } from "@/lib/offline-db";
import type { SyncState } from "@/lib/offline-types";

let activeSync: Promise<SyncState> | null = null;

function publish(state: SyncState, message?: string) { window.dispatchEvent(new CustomEvent("vicgym:sync-status", { detail: { state, message } })); }

export function syncOfflineMutations(): Promise<SyncState> {
  if (activeSync) return activeSync;
  activeSync = (async () => {
    if (!navigator.onLine) { publish("offline"); return "offline"; }
    publish("syncing");
    try {
      while (true) {
        const mutations = (await getOfflineOutbox()).slice(0, 100);
        if (!mutations.length) { publish("synced"); return "synced"; }
        const response = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schemaVersion: 1, mutations }) });
        const data = await response.json() as { results?: Array<{ id: string; status: "applied" | "duplicate" | "failed"; error?: string }> };
        if (!data.results) throw new Error("Sync endpoint unavailable");
        const successful = data.results.filter((result) => result.status !== "failed").map((result) => result.id); await removeOfflineMutations(successful);
        const failed = data.results.find((result) => result.status === "failed");
        if (failed) { await markOfflineMutationFailed(failed.id, failed.error ?? "Mutation needs attention"); publish("needs-attention", failed.error); return "needs-attention"; }
      }
    } catch (error) {
      const state: SyncState = navigator.onLine ? "saved-local" : "offline"; publish(state, error instanceof Error ? error.message : undefined); return state;
    }
  })().finally(() => { activeSync = null; });
  return activeSync;
}
