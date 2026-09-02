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
        const body = await response.text();
        let data: { error?: string; results?: Array<{ id: string; type?: string; sequence?: number; status: "applied" | "duplicate" | "failed"; error?: string }> };
        try { data = JSON.parse(body) as typeof data; } catch { data = {}; }
        if (!data.results?.length) throw new Error(`Sync request failed (${response.status}): ${data.error ?? "the server returned no mutation acknowledgements"}`);
        const sent = new Set(mutations.map((mutation) => mutation.id));
        const successful = data.results.filter((result) => result.status !== "failed" && sent.has(result.id)).map((result) => result.id); await removeOfflineMutations(successful);
        const failed = data.results.find((result) => result.status === "failed");
        if (failed) {
          const mutation = mutations.find((item) => item.id === failed.id);
          const type = failed.type ?? mutation?.type ?? "UNKNOWN_MUTATION";
          const sequence = failed.sequence ?? mutation?.sequence;
          const serverError = failed.error ?? "Mutation needs attention";
          const message = `${type}${sequence ? ` #${sequence}` : ""}: ${serverError}`;
          console.error("VicGym synchronization mutation failed", { mutationId: failed.id, mutationType: type, sequence, sessionId: mutation?.sessionId, serverError });
          await markOfflineMutationFailed(failed.id, message); publish("needs-attention", message); return "needs-attention";
        }
        if (!response.ok) throw new Error(`Sync request failed (${response.status}): ${data.error ?? "unknown server error"}`);
      }
    } catch (error) {
      const state: SyncState = navigator.onLine ? "saved-local" : "offline";
      const message = error instanceof Error ? error.message : "Unknown client sync error";
      console.error("VicGym synchronization request failed", { clientError: message, online: navigator.onLine });
      publish(state, message); return state;
    }
  })().finally(() => { activeSync = null; });
  return activeSync;
}
