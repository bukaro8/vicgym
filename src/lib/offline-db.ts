import type { OfflineMutation, OfflineTimer, OfflineWorkout } from "@/lib/offline-types";

const DB_NAME = "vicgym-offline";
const DB_VERSION = 1;
const WORKOUTS = "workouts";
const OUTBOX = "outbox";
const TIMERS = "timers";
const META = "metadata";

type StoreName = typeof WORKOUTS | typeof OUTBOX | typeof TIMERS | typeof META;

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
}

export function openOfflineDb(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) return Promise.reject(new Error("INDEXEDDB_UNAVAILABLE"));
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(WORKOUTS)) db.createObjectStore(WORKOUTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: "id" });
      if (!db.objectStoreNames.contains(TIMERS)) db.createObjectStore(TIMERS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "key" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error("INDEXEDDB_BLOCKED"));
  });
}

async function getValue<T>(store: StoreName, key: IDBValidKey): Promise<T | null> {
  const db = await openOfflineDb();
  try { return (await request(db.transaction(store).objectStore(store).get(key)) as T | undefined) ?? null; } finally { db.close(); }
}

async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openOfflineDb();
  try { return await request(db.transaction(store).objectStore(store).getAll()) as T[]; } finally { db.close(); }
}

async function putValue(store: StoreName, value: unknown): Promise<void> {
  const db = await openOfflineDb(); const transaction = db.transaction(store, "readwrite"); transaction.objectStore(store).put(value); await transactionDone(transaction); db.close();
}

export async function putOfflineWorkout(workout: OfflineWorkout): Promise<void> { await putValue(WORKOUTS, workout); }
export async function getOfflineWorkout(id: string): Promise<OfflineWorkout | null> { return getValue(WORKOUTS, id); }
export async function getActiveOfflineWorkout(): Promise<OfflineWorkout | null> { return (await getAll<OfflineWorkout>(WORKOUTS)).filter((item) => item.status === "IN_PROGRESS").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null; }
export async function updateOfflineWorkout(id: string, update: (workout: OfflineWorkout) => OfflineWorkout): Promise<OfflineWorkout | null> { const current = await getOfflineWorkout(id); if (!current) return null; const next = update(current); await putOfflineWorkout(next); return next; }

export async function putOfflineTimer(timer: OfflineTimer): Promise<void> { const existing = await getAll<OfflineTimer>(TIMERS); const db = await openOfflineDb(); const transaction = db.transaction(TIMERS, "readwrite"); const store = transaction.objectStore(TIMERS); existing.forEach((item) => store.delete(item.id)); store.put(timer); await transactionDone(transaction); db.close(); }
export async function getOfflineTimer(): Promise<OfflineTimer | null> { return (await getAll<OfflineTimer>(TIMERS))[0] ?? null; }
export async function clearOfflineTimer(): Promise<void> { const db = await openOfflineDb(); const transaction = db.transaction(TIMERS, "readwrite"); transaction.objectStore(TIMERS).clear(); await transactionDone(transaction); db.close(); }

export async function queueOfflineMutation(input: Omit<OfflineMutation, "id" | "sequence" | "createdAt" | "attempts" | "lastError"> & { id?: string; createdAt?: string }): Promise<OfflineMutation> {
  const db = await openOfflineDb(); const transaction = db.transaction([OUTBOX, META], "readwrite"); const meta = transaction.objectStore(META); const current = await request(meta.get("outbox-sequence")) as { key: string; value: number } | undefined; const sequence = (current?.value ?? 0) + 1;
  const mutation: OfflineMutation = { ...input, id: input.id ?? crypto.randomUUID(), sequence, createdAt: input.createdAt ?? new Date().toISOString(), attempts: 0, lastError: null };
  meta.put({ key: "outbox-sequence", value: sequence }); transaction.objectStore(OUTBOX).put(mutation); await transactionDone(transaction); db.close(); window.dispatchEvent(new Event("vicgym:outbox-changed"));
  try {
    const registration = await navigator.serviceWorker?.ready;
    const backgroundSync = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } } | undefined)?.sync;
    await backgroundSync?.register("vicgym-outbox");
  } catch { /* Background Sync is best-effort; foreground triggers remain authoritative. */ }
  return mutation;
}

export async function getOfflineOutbox(): Promise<OfflineMutation[]> { return (await getAll<OfflineMutation>(OUTBOX)).sort((a, b) => a.sequence - b.sequence); }
export async function removeOfflineMutations(ids: string[]): Promise<void> { if (!ids.length) return; const db = await openOfflineDb(); const transaction = db.transaction(OUTBOX, "readwrite"); const store = transaction.objectStore(OUTBOX); ids.forEach((id) => store.delete(id)); await transactionDone(transaction); db.close(); window.dispatchEvent(new Event("vicgym:outbox-changed")); }
export async function markOfflineMutationFailed(id: string, message: string): Promise<void> { const mutation = await getValue<OfflineMutation>(OUTBOX, id); if (!mutation) return; await putValue(OUTBOX, { ...mutation, attempts: mutation.attempts + 1, lastError: message }); window.dispatchEvent(new Event("vicgym:outbox-changed")); }

export async function clearPrivateOfflineData(): Promise<void> {
  await new Promise<void>((resolve, reject) => { const deletion = indexedDB.deleteDatabase(DB_NAME); deletion.onsuccess = () => resolve(); deletion.onerror = () => reject(deletion.error); deletion.onblocked = () => reject(new Error("INDEXEDDB_BLOCKED")); });
  if ("caches" in globalThis) for (const name of await caches.keys()) if (name.startsWith("vicgym-")) await caches.delete(name);
  navigator.serviceWorker?.controller?.postMessage({ type: "VICGYM_CLEAR_PRIVATE_CACHES" });
  window.dispatchEvent(new Event("vicgym:outbox-changed"));
}
