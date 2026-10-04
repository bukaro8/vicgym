import type { OfflineMutation, OfflineTimer, OfflineWorkout } from "@/lib/offline-types";
import { cardioDurationSeconds } from "@/lib/cardio";

const DB_PREFIX = "vicgym-offline";
const DB_VERSION = 1;
const WORKOUTS = "workouts";
const OUTBOX = "outbox";
const TIMERS = "timers";
const META = "metadata";

type StoreName = typeof WORKOUTS | typeof OUTBOX | typeof TIMERS | typeof META;
let ownerKey: string | null = process.env.NODE_ENV === "test" ? "test-user" : null;

export function configureOfflineOwner(userId: string | null): void { ownerKey = userId; }
export function getOfflineOwner(): string | null { return ownerKey; }
function databaseName(): string { if (!ownerKey) throw new Error("OFFLINE_OWNER_REQUIRED"); return `${DB_PREFIX}-${ownerKey}`; }

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
}

export function openOfflineDb(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) return Promise.reject(new Error("INDEXEDDB_UNAVAILABLE"));
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(databaseName(), DB_VERSION);
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
export async function findOfflineWorkoutSessionForSet(setLogId: string): Promise<string | null> {
  const workout = (await getAll<OfflineWorkout>(WORKOUTS)).find((item) => item.exercises.some((exercise) => exercise.sets.some((set) => set.id === setLogId)));
  if (workout) return workout.id;
  const mutation = (await getAll<OfflineMutation>(OUTBOX)).find((item) => (item.type === "ADD_SET" || item.type === "UPSERT_SET") && item.targetId === setLogId);
  return mutation?.sessionId ?? null;
}
export async function updateOfflineWorkout(id: string, update: (workout: OfflineWorkout) => OfflineWorkout): Promise<OfflineWorkout | null> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction(WORKOUTS, "readwrite"); const done = transactionDone(tx);
    const current = await request(tx.objectStore(WORKOUTS).get(id)) as OfflineWorkout | undefined;
    if (!current) { await done; return null; }
    let next: OfflineWorkout;
    try { next = update(current); } catch (error) { tx.abort(); await done.catch(() => undefined); throw error; }
    tx.objectStore(WORKOUTS).put(next); await done; return next;
  } finally { db.close(); }
}

type MutationInput = Pick<OfflineMutation, "type" | "sessionId" | "targetId" | "payload">;
export async function commitWorkoutChange(sessionId: string, update: (workout: OfflineWorkout) => OfflineWorkout, mutations: MutationInput[], timer?: OfflineTimer | null): Promise<OfflineWorkout> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction([WORKOUTS, OUTBOX, META, TIMERS], "readwrite"); const done = transactionDone(tx);
    const store = tx.objectStore(WORKOUTS);
    const current = await request(store.get(sessionId)) as OfflineWorkout | undefined;
    if (!current || current.status !== "IN_PROGRESS") { await done; throw new Error("This workout is unavailable or already finished."); }
    let next: OfflineWorkout;
    try { next = update(current); } catch (error) { tx.abort(); await done.catch(() => undefined); throw error; }
    const meta = tx.objectStore(META);
    const counter = await request(meta.get("outbox-sequence")) as { value: number } | undefined;
    let sequence = counter?.value ?? 0;
    for (const input of mutations) tx.objectStore(OUTBOX).put({ ...input, id: crypto.randomUUID(), sequence: ++sequence, createdAt: new Date().toISOString(), attempts: 0, lastError: null });
    meta.put({ key: "outbox-sequence", value: sequence });
    store.put(next);
    if (timer) { tx.objectStore(TIMERS).clear(); tx.objectStore(TIMERS).put(timer); }
    await done; window.dispatchEvent(new Event("vicgym:outbox-changed")); return next;
  } finally { db.close(); }
}

export async function putOfflineTimer(timer: OfflineTimer): Promise<void> { const existing = await getAll<OfflineTimer>(TIMERS); const db = await openOfflineDb(); const transaction = db.transaction(TIMERS, "readwrite"); const store = transaction.objectStore(TIMERS); existing.forEach((item) => store.delete(item.id)); store.put(timer); await transactionDone(transaction); db.close(); }
export async function getOfflineTimer(): Promise<OfflineTimer | null> { return (await getAll<OfflineTimer>(TIMERS))[0] ?? null; }
export async function clearOfflineTimer(): Promise<void> { const db = await openOfflineDb(); const transaction = db.transaction(TIMERS, "readwrite"); transaction.objectStore(TIMERS).clear(); await transactionDone(transaction); db.close(); }

export async function queueOfflineMutation(input: Omit<OfflineMutation, "id" | "sequence" | "createdAt" | "attempts" | "lastError"> & { id?: string; createdAt?: string }): Promise<OfflineMutation> {
  const db = await openOfflineDb(); const transaction = db.transaction([OUTBOX, META], "readwrite"); const meta = transaction.objectStore(META); const current = await request(meta.get("outbox-sequence")) as { key: string; value: number } | undefined; const sequence = (current?.value ?? 0) + 1;
  const mutation: OfflineMutation = { ...input, id: input.id ?? crypto.randomUUID(), sequence, createdAt: input.createdAt ?? new Date().toISOString(), attempts: 0, lastError: null };
  meta.put({ key: "outbox-sequence", value: sequence }); transaction.objectStore(OUTBOX).put(mutation); await transactionDone(transaction); db.close(); window.dispatchEvent(new Event("vicgym:outbox-changed"));
  void (async () => { try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const backgroundSync = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } } | undefined)?.sync;
    await backgroundSync?.register("vicgym-outbox");
  } catch { /* Background Sync is best-effort; foreground triggers remain authoritative. */ } })();
  return mutation;
}

export async function getOfflineOutbox(): Promise<OfflineMutation[]> { return (await getAll<OfflineMutation>(OUTBOX)).sort((a, b) => a.sequence - b.sequence); }

/** Freeze the snapshot and queue completion together, including across tabs. */
export async function queueWorkoutCompletion(sessionId: string): Promise<string> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction([WORKOUTS, OUTBOX, META], "readwrite");
    const done = transactionDone(tx);
    const workouts = tx.objectStore(WORKOUTS);
    const workout = await request(workouts.get(sessionId)) as OfflineWorkout | undefined;
    if (!workout) { await done; throw new Error("Workout is not saved on this device. Reopen the workout before finishing."); }
    const queued = await request(tx.objectStore(OUTBOX).getAll()) as OfflineMutation[];
    if (workout.completionReceiptId || queued.some((item) => item.sessionId === sessionId && item.type === "COMPLETE_WORKOUT" && !item.lastError)) { await done; return workout.completedAt!; }
    const completedAt = workout.status === "COMPLETED" && workout.completedAt ? workout.completedAt : new Date().toISOString();
    const snapshot: OfflineWorkout = { ...workout, status: "COMPLETED", completedAt, updatedAt: completedAt,
      cardioStoppedAt: workout.cardioStartedAt ? (workout.cardioStoppedAt ?? completedAt) : null,
      cardioDurationSeconds: workout.cardioStartedAt ? cardioDurationSeconds(workout.cardioStartedAt, workout.cardioStoppedAt ?? completedAt) : 0 };
    const meta = tx.objectStore(META);
    const current = await request(meta.get("outbox-sequence")) as { value: number } | undefined;
    const sequence = (current?.value ?? 0) + 1;
    workouts.put(snapshot);
    meta.put({ key: "outbox-sequence", value: sequence });
    tx.objectStore(OUTBOX).put({ id: crypto.randomUUID(), sequence, type: "COMPLETE_WORKOUT", sessionId, targetId: sessionId,
      payload: { snapshot }, createdAt: completedAt, attempts: 0, lastError: null } satisfies OfflineMutation);
    await done;
    window.dispatchEvent(new Event("vicgym:outbox-changed"));
    return completedAt;
  } finally { db.close(); }
}

export async function recordCompletionReceipt(mutation: OfflineMutation): Promise<void> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction([WORKOUTS, OUTBOX], "readwrite");
    const done = transactionDone(tx);
    const workout = await request(tx.objectStore(WORKOUTS).get(mutation.sessionId)) as OfflineWorkout | undefined;
    if (workout) tx.objectStore(WORKOUTS).put({ ...workout, completionReceiptId: mutation.id });
    const outbox = await request(tx.objectStore(OUTBOX).getAll()) as OfflineMutation[];
    // The accepted snapshot contains the final set/cardio values. Unresolved
    // timer events remain visible because the snapshot does not replace them.
    for (const item of outbox) if (item.sessionId === mutation.sessionId && item.sequence <= mutation.sequence && item.type !== "UPSERT_TIMER") tx.objectStore(OUTBOX).delete(item.id);
    await done;
    window.dispatchEvent(new Event("vicgym:outbox-changed"));
  } finally { db.close(); }
}

export async function retryFailedOfflineMutations(): Promise<void> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction(OUTBOX, "readwrite"); const done = transactionDone(tx);
    const items = await request(tx.objectStore(OUTBOX).getAll()) as OfflineMutation[];
    for (const item of items) if (item.lastError) tx.objectStore(OUTBOX).put({ ...item, lastError: null });
    await done;
  } finally { db.close(); }
}
/** Failed validation mutations stay visible for recovery, but must not replay forever. */
export async function getPendingOfflineOutbox(): Promise<OfflineMutation[]> {
  return (await getOfflineOutbox()).filter((mutation) => !mutation.lastError);
}
export async function removeOfflineMutations(ids: string[]): Promise<void> { if (!ids.length) return; const db = await openOfflineDb(); const transaction = db.transaction(OUTBOX, "readwrite"); const store = transaction.objectStore(OUTBOX); ids.forEach((id) => store.delete(id)); await transactionDone(transaction); db.close(); window.dispatchEvent(new Event("vicgym:outbox-changed")); }
export async function markOfflineMutationFailed(id: string, message: string): Promise<void> { const mutation = await getValue<OfflineMutation>(OUTBOX, id); if (!mutation) return; await putValue(OUTBOX, { ...mutation, attempts: mutation.attempts + 1, lastError: message }); window.dispatchEvent(new Event("vicgym:outbox-changed")); }

export async function clearOfflineRuntimeCaches(): Promise<void> {
  if ("caches" in globalThis) for (const name of await caches.keys()) if (name.startsWith("vicgym-")) await caches.delete(name);
  navigator.serviceWorker?.controller?.postMessage({ type: "VICGYM_CLEAR_PRIVATE_CACHES" });
}

export async function clearPrivateOfflineData(): Promise<void> {
  const name = databaseName();
  await new Promise<void>((resolve, reject) => { const deletion = indexedDB.deleteDatabase(name); deletion.onsuccess = () => resolve(); deletion.onerror = () => reject(deletion.error); deletion.onblocked = () => reject(new Error("INDEXEDDB_BLOCKED")); });
  await clearOfflineRuntimeCaches();
  window.dispatchEvent(new Event("vicgym:outbox-changed"));
}
