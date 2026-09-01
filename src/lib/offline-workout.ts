import { adjustedRemainingMilliseconds, remainingMilliseconds } from "@/lib/rest-timer";
import { clearOfflineTimer, getOfflineTimer, putOfflineTimer, queueOfflineMutation, updateOfflineWorkout } from "@/lib/offline-db";
import type { OfflineSet, OfflineTimer } from "@/lib/offline-types";
import type { RestTimerDto, TimerAction } from "@/server/rest-timers";

export function offlineTimerDto(timer: OfflineTimer): RestTimerDto { return { id: timer.id, setLogId: timer.setLogId, status: timer.status, configuredSeconds: timer.configuredSeconds, startedAt: timer.startedAt, endsAt: timer.endsAt, pausedAt: timer.pausedAt, pausedRemainingMs: timer.pausedRemainingMs, updatedAt: timer.updatedAt, exerciseName: timer.exerciseName, completedSetNumber: timer.completedSetNumber, nextSetId: timer.nextSetId }; }

export async function saveSetLocally(input: { sessionId: string; exerciseSessionId: string; setId: string; actualReps: number; loadValue: number | null; completed: boolean }): Promise<{ set: OfflineSet; timer: RestTimerDto | null }> {
  const now = new Date().toISOString(); const workout = await updateOfflineWorkout(input.sessionId, (current) => current); const exercise = workout?.exercises.find((item) => item.id === input.exerciseSessionId); const old = exercise?.sets.find((set) => set.id === input.setId);
  if (!exercise || !old) throw new Error("LOCAL_SET_NOT_FOUND");
  const newlyCompleted = input.completed && !old.completedAt; const saved: OfflineSet = { ...old, actualReps: input.actualReps, loadValue: exercise.loadTrackingType == null ? null : input.loadValue, weightKg: exercise.loadTrackingType == null ? input.loadValue : null, loadTrackingType: exercise.loadTrackingType ?? null, completedAt: input.completed ? (old.completedAt ?? now) : null };
  await updateOfflineWorkout(input.sessionId, (current) => ({ ...current, updatedAt: now, exercises: current.exercises.map((item) => item.id === input.exerciseSessionId ? { ...item, sets: item.sets.map((set) => set.id === input.setId ? saved : set) } : item) }));
  const timer: OfflineTimer | null = newlyCompleted && exercise.autoRest && exercise.restSeconds > 0 ? { id: crypto.randomUUID(), setLogId: input.setId, status: "RUNNING", configuredSeconds: exercise.restSeconds, startedAt: now, endsAt: new Date(Date.now() + exercise.restSeconds * 1000).toISOString(), pausedAt: null, pausedRemainingMs: null, exerciseName: exercise.name, completedSetNumber: saved.setNumber, nextSetId: exercise.sets.find((set) => set.setNumber > saved.setNumber && !set.completedAt)?.id ?? null, updatedAt: now } : null;
  await queueOfflineMutation({ type: "UPSERT_SET", sessionId: input.sessionId, targetId: input.setId, payload: { actualReps: saved.actualReps, loadValue: saved.loadValue, weightKg: saved.weightKg, loadTrackingType: saved.loadTrackingType, completedAt: saved.completedAt, notes: saved.notes ?? null } });
  if (timer) { await putOfflineTimer(timer); await queueTimerState(input.sessionId, timer, "RUNNING"); }
  return { set: saved, timer: timer ? offlineTimerDto(timer) : null };
}

export async function addSetLocally(sessionId: string, exerciseSessionId: string): Promise<OfflineSet> {
  const now = new Date().toISOString(); const id = crypto.randomUUID(); const workout = await updateOfflineWorkout(sessionId, (current) => current); const exercise = workout?.exercises.find((item) => item.id === exerciseSessionId);
  if (!exercise) throw new Error("LOCAL_EXERCISE_NOT_FOUND");
  const created: OfflineSet = { id, setNumber: Math.max(0, ...exercise.sets.map((item) => item.setNumber)) + 1, targetReps: exercise.targetReps, actualReps: exercise.targetReps, weightKg: null, loadValue: null, loadTrackingType: exercise.loadTrackingType, loadEntryMode: exercise.loadEntryMode, completedAt: null };
  await updateOfflineWorkout(sessionId, (current) => ({ ...current, updatedAt: now, exercises: current.exercises.map((item) => item.id === exerciseSessionId ? { ...item, sets: [...item.sets, created] } : item) }));
  await queueOfflineMutation({ type: "ADD_SET", sessionId, targetId: id, payload: { exerciseSessionId, setNumber: created.setNumber, targetReps: created.targetReps, actualReps: created.actualReps, weightKg: null, loadValue: null, loadTrackingType: created.loadTrackingType } }); return created;
}

async function queueTimerState(sessionId: string, timer: OfflineTimer, status: "RUNNING" | "PAUSED" | "COMPLETED" | "SKIPPED") {
  await queueOfflineMutation({ type: "UPSERT_TIMER", sessionId, targetId: timer.id, payload: { setLogId: timer.setLogId, status, configuredSeconds: timer.configuredSeconds, startedAt: timer.startedAt, endsAt: timer.endsAt, pausedAt: timer.pausedAt, pausedRemainingMs: timer.pausedRemainingMs, updatedAt: timer.updatedAt } });
}

export async function updateTimerLocally(sessionId: string, action: TimerAction): Promise<RestTimerDto | null> {
  const timer = await getOfflineTimer(); if (!timer) return null; const now = Date.now(); const nowIso = new Date(now).toISOString(); const currentMs = timer.status === "PAUSED" ? (timer.pausedRemainingMs ?? 0) : remainingMilliseconds(timer.endsAt, now); let next: OfflineTimer | null = timer; let finalStatus: "RUNNING" | "PAUSED" | "COMPLETED" | "SKIPPED" = timer.status;
  if (action === "SKIP") { next = { ...timer, endsAt: null, pausedRemainingMs: null, updatedAt: nowIso }; finalStatus = "SKIPPED"; }
  else if (action === "COMPLETE") { if (currentMs > 1000) return offlineTimerDto(timer); next = { ...timer, endsAt: null, pausedRemainingMs: null, updatedAt: nowIso }; finalStatus = "COMPLETED"; }
  else if (action === "PAUSE" && timer.status === "RUNNING") { next = { ...timer, status: "PAUSED", endsAt: null, pausedAt: nowIso, pausedRemainingMs: currentMs, updatedAt: nowIso }; finalStatus = "PAUSED"; }
  else if (action === "RESUME" && timer.status === "PAUSED") { next = { ...timer, status: "RUNNING", endsAt: new Date(now + currentMs).toISOString(), pausedAt: null, pausedRemainingMs: null, updatedAt: nowIso }; finalStatus = "RUNNING"; }
  else if (action === "ADD_15" || action === "SUBTRACT_15") { const remaining = adjustedRemainingMilliseconds(currentMs, action === "ADD_15" ? 15 : -15); if (!remaining) { next = { ...timer, endsAt: null, pausedRemainingMs: null, updatedAt: nowIso }; finalStatus = "COMPLETED"; } else next = timer.status === "PAUSED" ? { ...timer, pausedRemainingMs: remaining, updatedAt: nowIso } : { ...timer, endsAt: new Date(now + remaining).toISOString(), updatedAt: nowIso }; }
  await queueTimerState(sessionId, next, finalStatus);
  if (finalStatus === "COMPLETED" || finalStatus === "SKIPPED") { await clearOfflineTimer(); return null; }
  await putOfflineTimer(next); return offlineTimerDto(next);
}

export async function finishWorkoutLocally(sessionId: string): Promise<string> {
  const completedAt = new Date().toISOString(); const timer = await getOfflineTimer(); if (timer) { await queueTimerState(sessionId, { ...timer, endsAt: null, pausedRemainingMs: null, updatedAt: completedAt }, "SKIPPED"); await clearOfflineTimer(); }
  await updateOfflineWorkout(sessionId, (workout) => ({ ...workout, status: "COMPLETED", completedAt, updatedAt: completedAt })); await queueOfflineMutation({ type: "FINISH_WORKOUT", sessionId, targetId: sessionId, payload: { completedAt, confirmIncomplete: true } }); return completedAt;
}
