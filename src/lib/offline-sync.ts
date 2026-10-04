import { getOfflineOwner, getOfflineOutbox, getPendingOfflineOutbox, markOfflineMutationFailed, removeOfflineMutations, recordCompletionReceipt } from "@/lib/offline-db";
import type { SyncState } from "@/lib/offline-types";

let activeSync: Promise<SyncState> | null = null;

function publish(state: SyncState, message?: string) { window.dispatchEvent(new CustomEvent("vicgym:sync-status", { detail: { state, message } })); }

export function syncOfflineMutations(): Promise<SyncState> {
  if (activeSync) return activeSync;
  const owner = getOfflineOwner();
  const run = async (): Promise<SyncState> => {
    const checkOwner = () => { if (!owner || getOfflineOwner() !== owner) throw new Error("Account changed during synchronization; the original queue is preserved."); };
    if (!navigator.onLine) { publish("offline"); return "offline"; }
    publish("syncing");
    try {
      while (true) {
        checkOwner();
        const mutations = (await getPendingOfflineOutbox()).slice(0, 100);
        checkOwner();
        if (!mutations.length) {
          const failed = (await getOfflineOutbox()).find((mutation) => mutation.lastError);
          checkOwner();
          if (failed?.lastError) { publish("needs-attention", failed.lastError); return "needs-attention"; }
          publish("synced"); return "synced";
        }
        const response = await fetch("/api/sync", { method: "POST", signal: AbortSignal.timeout(45000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schemaVersion: 1, mutations }) });
        const body = await response.text();
        checkOwner();
        if (response.status === 401) { publish("needs-attention", "Sign in again to upload your saved workout. Do not clear local data."); return "needs-attention"; }
        let data: { error?: string; results?: Array<{ id: string; type?: string; sequence?: number; status: "applied" | "duplicate" | "acknowledged" | "failed"; error?: string; retryable?: boolean }> };
        try { data = JSON.parse(body) as typeof data; } catch { data = {}; }
        if (!data.results?.length) throw new Error(`Sync request failed (${response.status}): ${data.error ?? "the server returned no mutation acknowledgements"}`);
        const sent = new Set(mutations.map((mutation) => mutation.id));
        for (const result of data.results) {
          checkOwner();
          const mutation = mutations.find((item) => item.id === result.id);
          if (mutation?.type === "COMPLETE_WORKOUT" && (result.status === "applied" || result.status === "duplicate")) await recordCompletionReceipt(mutation);
        }
        checkOwner();
        const successful = data.results.filter((result) => (result.status === "applied" || result.status === "duplicate") && sent.has(result.id)).map((result) => result.id); await removeOfflineMutations(successful);
        checkOwner();
        const failures = data.results.filter((result) => (result.status === "failed" || result.status === "acknowledged") && sent.has(result.id));
        if (!successful.length && !failures.length) throw new Error("Server returned no recognized acknowledgements; local data was preserved.");
        for (const failed of failures) {
          checkOwner();
          const mutation = mutations.find((item) => item.id === failed.id);
          const type = failed.type ?? mutation?.type ?? "UNKNOWN_MUTATION";
          const sequence = failed.sequence ?? mutation?.sequence;
          const serverError = failed.error ?? "Mutation needs attention";
          const message = `${type}${sequence ? ` #${sequence}` : ""}: ${serverError}`;
          console.error("VicGym synchronization mutation failed", { mutationId: failed.id, mutationType: type, sequence, sessionId: mutation?.sessionId, targetId: mutation?.targetId, serverError });
          if (!failed.retryable) await markOfflineMutationFailed(failed.id, message);
        }
        if (failures.some((result) => result.retryable)) { publish("saved-local", "Temporary server problem. Your workout is saved on this device."); return "saved-local"; }
        if (!response.ok && !failures.length) throw new Error(`Sync request failed (${response.status}): ${data.error ?? "unknown server error"}`);
      }
    } catch (error) {
      const state: SyncState = navigator.onLine ? "saved-local" : "offline";
      const message = error instanceof Error ? error.message : "Unknown client sync error";
      console.error("VicGym synchronization request failed", { clientError: message, online: navigator.onLine });
      if (getOfflineOwner() === owner) publish(state, message);
      return state;
    }
  };
  activeSync = (async () => navigator.locks ? await navigator.locks.request(`vicgym-sync-${owner}`, run) : await run())().finally(() => { activeSync = null; });
  return activeSync;
}
