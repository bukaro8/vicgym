"use client";

import { AlertTriangle, Check, CloudOff, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getActiveOfflineWorkout, getOfflineOutbox } from "@/lib/offline-db";
import { syncOfflineMutations } from "@/lib/offline-sync";
import type { SyncState } from "@/lib/offline-types";

const labels: Record<SyncState, string> = { synced: "Synced", "saved-local": "Saved locally", syncing: "Syncing…", "needs-attention": "Needs attention", offline: "Offline" };

export function OfflineProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [state, setState] = useState<SyncState>("synced"); const [active, setActive] = useState(false); const [message, setMessage] = useState("");
  const inspect = useCallback(async () => { const [workout, outbox] = await Promise.all([getActiveOfflineWorkout(), getOfflineOutbox()]); setActive(Boolean(workout) || outbox.length > 0); if (!navigator.onLine) setState("offline"); else if (outbox.some((mutation) => mutation.lastError)) setState("needs-attention"); else if (outbox.length) setState("saved-local"); else setState("synced"); }, []);
  const retry = useCallback(() => { void syncOfflineMutations().then((next) => { setState(next); void inspect(); }); }, [inspect]);
  useEffect(() => {
    const status = (event: Event) => { const detail = (event as CustomEvent<{ state: SyncState; message?: string }>).detail; setState(detail.state); setMessage(detail.message ?? ""); };
    const changed = () => void inspect(); const online = () => retry(); const offline = () => setState("offline"); const focus = () => retry();
    const serviceWorkerMessage = (event: MessageEvent<{ type?: string }>) => { if (event.data?.type === "VICGYM_SYNC_REQUESTED") retry(); };
    window.addEventListener("vicgym:sync-status", status); window.addEventListener("vicgym:outbox-changed", changed); window.addEventListener("online", online); window.addEventListener("offline", offline); window.addEventListener("focus", focus); navigator.serviceWorker?.addEventListener("message", serviceWorkerMessage);
    const startup = window.setTimeout(() => { void inspect().then(() => retry()).catch(() => undefined); }, 0);
    return () => { window.clearTimeout(startup); window.removeEventListener("vicgym:sync-status", status); window.removeEventListener("vicgym:outbox-changed", changed); window.removeEventListener("online", online); window.removeEventListener("offline", offline); window.removeEventListener("focus", focus); navigator.serviceWorker?.removeEventListener("message", serviceWorkerMessage); };
  }, [inspect, retry]);
  const Icon = state === "synced" ? Check : state === "offline" ? CloudOff : state === "needs-attention" ? AlertTriangle : state === "syncing" ? RefreshCw : Save;
  return <>{children}{active && <aside className="fixed right-3 bottom-20 z-50 flex items-center gap-2 rounded-full border bg-card/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur sm:bottom-4" title={message || labels[state]}><Icon className={`size-3.5 text-primary ${state === "syncing" ? "animate-spin" : ""}`} /><span>{labels[state]}</span>{state === "needs-attention" && <button type="button" onClick={retry} className="ml-1 text-primary underline">Retry</button>}</aside>}</>;
}
