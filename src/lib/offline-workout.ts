import { setEffortSchema, type SetEffortValue } from "@/lib/set-effort";
import { adjustedRemainingMilliseconds, remainingMilliseconds } from "@/lib/rest-timer";
import { exerciseSeed } from "@/data/phase-2-catalogue";
import { clearOfflineTimer, commitWorkoutChange, findOfflineWorkoutSessionForSet, getOfflineTimer, putOfflineTimer, queueOfflineMutation, queueWorkoutCompletion, updateOfflineWorkout } from "@/lib/offline-db";
import { cardioDurationSeconds } from "@/lib/cardio";
import type { OfflineCatalogueExercise, OfflineExercise, OfflineSet, OfflineTimer } from "@/lib/offline-types";
import type { RestTimerDto, TimerAction } from "@/server/rest-timers";

export function offlineTimerDto(timer: OfflineTimer): RestTimerDto { return { id: timer.id, sessionId: timer.sessionId ?? null, setLogId: timer.setLogId, status: timer.status, configuredSeconds: timer.configuredSeconds, startedAt: timer.startedAt, endsAt: timer.endsAt, pausedAt: timer.pausedAt, pausedRemainingMs: timer.pausedRemainingMs, updatedAt: timer.updatedAt, exerciseName: timer.exerciseName, completedSetNumber: timer.completedSetNumber, nextSetId: timer.nextSetId }; }

export async function saveSetLocally(input: { sessionId: string; exerciseSessionId: string; setId: string; actualReps: number; loadValue: number | null; completed: boolean; effort?: SetEffortValue | null; notes?: string | null }): Promise<{ set: OfflineSet; timer: RestTimerDto | null }> {
  const now = new Date().toISOString(); const workout = await updateOfflineWorkout(input.sessionId, (current) => current); const exercise = workout?.exercises.find((item) => item.id === input.exerciseSessionId); const old = exercise?.sets.find((set) => set.id === input.setId);
  if (!exercise || !old) throw new Error("LOCAL_SET_NOT_FOUND");
  if (workout?.status !== "IN_PROGRESS") throw new Error("This workout has already finished.");
  if (!Number.isInteger(input.actualReps) || input.actualReps < 0 || input.actualReps > 999) throw new Error("Reps must be a whole number from 0 to 999");
  if (input.loadValue !== null && (!Number.isFinite(input.loadValue) || input.loadValue < 0 || input.loadValue > 9999)) throw new Error("Load must be a number from 0 to 9999");
  if (exercise.loadTrackingType === "MACHINE_LEVEL" && input.loadValue !== null && !Number.isInteger(input.loadValue)) throw new Error("Machine level must be a whole number");
  const effort = setEffortSchema.parse(input.effort);
  const newlyCompleted = input.completed && !old.completedAt; const saved: OfflineSet = { ...old, effort: effort === undefined ? old.effort ?? null : effort, actualReps: input.actualReps, loadValue: exercise.loadTrackingType == null ? null : input.loadValue, weightKg: exercise.loadTrackingType == null ? input.loadValue : null, loadTrackingType: exercise.loadTrackingType ?? null, completedAt: input.completed ? (old.completedAt ?? now) : null, notes: input.notes?.trim() || null };
  const timer: OfflineTimer | null = newlyCompleted && exercise.autoRest && exercise.restSeconds > 0 ? { id: crypto.randomUUID(), sessionId: input.sessionId, setLogId: input.setId, status: "RUNNING", configuredSeconds: exercise.restSeconds, startedAt: now, endsAt: new Date(Date.now() + exercise.restSeconds * 1000).toISOString(), pausedAt: null, pausedRemainingMs: null, exerciseName: exercise.name, completedSetNumber: saved.setNumber, nextSetId: exercise.sets.find((set) => set.setNumber > saved.setNumber && !set.completedAt)?.id ?? null, updatedAt: now } : null;
  await commitWorkoutChange(input.sessionId, (current) => ({ ...current, updatedAt: now, exercises: current.exercises.map((item) => item.id === input.exerciseSessionId ? { ...item, sets: item.sets.map((set) => set.id === input.setId ? saved : set) } : item) }), [
    { type: "UPSERT_SET", sessionId: input.sessionId, targetId: input.setId, payload: { actualReps: saved.actualReps, loadValue: saved.loadValue, weightKg: saved.weightKg, loadTrackingType: saved.loadTrackingType, completedAt: saved.completedAt, notes: saved.notes ?? null, effort: saved.effort ?? null } },
    ...(timer ? [{ type: "UPSERT_TIMER" as const, sessionId: input.sessionId, targetId: timer.id, payload: { ...timer } }] : []),
  ], timer);
  return { set: saved, timer: timer ? offlineTimerDto(timer) : null };
}

export async function addSetLocally(sessionId: string, exerciseSessionId: string): Promise<OfflineSet> {
  const now = new Date().toISOString(); const id = crypto.randomUUID(); const workout = await updateOfflineWorkout(sessionId, (current) => current); const exercise = workout?.exercises.find((item) => item.id === exerciseSessionId);
  if (!exercise) throw new Error("LOCAL_EXERCISE_NOT_FOUND");
  if (workout?.status !== "IN_PROGRESS") throw new Error("This workout has already finished.");
  const created: OfflineSet = { id, setNumber: Math.max(0, ...exercise.sets.map((item) => item.setNumber)) + 1, targetReps: exercise.targetReps, actualReps: exercise.targetReps, weightKg: null, loadValue: null, loadTrackingType: exercise.loadTrackingType, loadEntryMode: exercise.loadEntryMode, completedAt: null };
  await commitWorkoutChange(sessionId, (current) => {
    if (current.exercises.find((item) => item.id === exerciseSessionId)?.sets.some((set) => set.setNumber === created.setNumber)) throw new Error("Another set was added. Refresh and try again.");
    return { ...current, updatedAt: now, exercises: current.exercises.map((item) => item.id === exerciseSessionId ? { ...item, sets: [...item.sets, created] } : item) };
  }, [{ type: "ADD_SET", sessionId, targetId: id, payload: { exerciseSessionId, setNumber: created.setNumber, targetReps: created.targetReps, actualReps: created.actualReps, weightKg: null, loadValue: null, loadTrackingType: created.loadTrackingType } }]); return created;
}

export const AD_HOC_DEFAULT_SETS = 3;
export const AD_HOC_DEFAULT_REST_SECONDS = 90;

export async function addExerciseLocally(sessionId: string, catalogueExercise: OfflineCatalogueExercise): Promise<OfflineExercise> {
  const now = new Date().toISOString();
  const workout = await updateOfflineWorkout(sessionId, (current) => current);
  if (!workout || workout.status !== "IN_PROGRESS") throw new Error("LOCAL_ACTIVE_WORKOUT_NOT_FOUND");
  if (workout.exercises.some((item) => item.exerciseId === catalogueExercise.exerciseId)) throw new Error("This exercise is already in the workout.");
  const id = crypto.randomUUID();
  const position = Math.max(0, ...workout.exercises.map((item) => item.position)) + 1;
  const sets = Array.from({ length: AD_HOC_DEFAULT_SETS }, (_, index): OfflineSet => ({
    id: crypto.randomUUID(), setNumber: index + 1, targetReps: catalogueExercise.defaultTargetReps,
    actualReps: catalogueExercise.defaultTargetReps, weightKg: null, loadValue: null,
    loadTrackingType: catalogueExercise.loadTrackingType, loadEntryMode: catalogueExercise.loadEntryMode,
    completedAt: null, notes: null,
  }));
  const created: OfflineExercise = {
    id, exerciseId: catalogueExercise.exerciseId, slug: catalogueExercise.slug, name: catalogueExercise.name,
    position, plannedSets: AD_HOC_DEFAULT_SETS, targetReps: catalogueExercise.defaultTargetReps,
    restSeconds: exerciseSeed.find((item) => item.slug === catalogueExercise.slug)?.defaultRestSeconds ?? AD_HOC_DEFAULT_REST_SECONDS, autoRest: true, isAdHoc: true,
    loadTrackingType: catalogueExercise.loadTrackingType, loadEntryMode: catalogueExercise.loadEntryMode,
    equipmentName: catalogueExercise.equipmentName, imagePath: catalogueExercise.imagePath, sets,
  };
  await commitWorkoutChange(sessionId, (current) => {
    if (current.exercises.some((item) => item.exerciseId === created.exerciseId || item.position === created.position)) throw new Error("The workout changed. Refresh before adding this exercise.");
    return { ...current, currentExerciseId: id, updatedAt: now, exercises: [...current.exercises, created] };
  }, [{
    type: "ADD_EXERCISE", sessionId, targetId: id,
    payload: {
      exerciseId: catalogueExercise.exerciseId, position, plannedSets: created.plannedSets,
      targetReps: created.targetReps, restSeconds: created.restSeconds, autoRest: created.autoRest,
      sets: sets.map((set) => ({ id: set.id, setNumber: set.setNumber, targetReps: set.targetReps, actualReps: set.actualReps })),
    },
  }]);
  return created;
}

export async function startCardioLocally(sessionId: string, now = new Date()): Promise<string> {
  const startedAt = now.toISOString();
  const workout = await commitWorkoutChange(sessionId, (current) => {
    if (!current.cardioPlanned) throw new Error("CARDIO_NOT_PLANNED");
    if (current.status !== "IN_PROGRESS") throw new Error("This workout has already finished.");
    if (current.cardioStoppedAt) throw new Error("CARDIO_ALREADY_COMPLETED");
    return current.cardioStartedAt ? current : { ...current, cardioStartedAt: startedAt, cardioStoppedAt: null, cardioDurationSeconds: 0, updatedAt: startedAt };
  }, [{ type: "UPDATE_CARDIO", sessionId, targetId: sessionId, payload: { action: "START", at: startedAt } }]);
  if (!workout) throw new Error("LOCAL_WORKOUT_NOT_FOUND");
  const effectiveStartedAt = workout.cardioStartedAt ?? startedAt;
  return effectiveStartedAt;
}

export async function stopCardioLocally(sessionId: string, now = new Date()): Promise<{ stoppedAt: string; durationSeconds: number }> {
  const stoppedAt = now.toISOString();
  let durationSeconds = 0;
  const workout = await commitWorkoutChange(sessionId, (current) => {
    if (!current.cardioStartedAt) throw new Error("CARDIO_NOT_STARTED");
    if (current.status !== "IN_PROGRESS") throw new Error("This workout has already finished.");
    if (current.cardioStoppedAt) {
      durationSeconds = current.cardioDurationSeconds ?? cardioDurationSeconds(current.cardioStartedAt, current.cardioStoppedAt);
      return current;
    }
    durationSeconds = cardioDurationSeconds(current.cardioStartedAt, stoppedAt);
    return { ...current, cardioStoppedAt: stoppedAt, cardioDurationSeconds: durationSeconds, updatedAt: stoppedAt };
  }, [{ type: "UPDATE_CARDIO", sessionId, targetId: sessionId, payload: { action: "STOP", at: stoppedAt } }]);
  if (!workout) throw new Error("LOCAL_WORKOUT_NOT_FOUND");
  const effectiveStoppedAt = workout.cardioStoppedAt ?? stoppedAt;
  return { stoppedAt: effectiveStoppedAt, durationSeconds: workout.cardioDurationSeconds ?? durationSeconds };
}

async function queueTimerState(sessionId: string, timer: OfflineTimer, status: "RUNNING" | "PAUSED" | "COMPLETED" | "SKIPPED") {
  const ownerSessionId = timer.sessionId ?? await findOfflineWorkoutSessionForSet(timer.setLogId) ?? sessionId;
  await queueOfflineMutation({ type: "UPSERT_TIMER", sessionId: ownerSessionId, targetId: timer.id, payload: { setLogId: timer.setLogId, status, configuredSeconds: timer.configuredSeconds, startedAt: timer.startedAt, endsAt: timer.endsAt, pausedAt: timer.pausedAt, pausedRemainingMs: timer.pausedRemainingMs, updatedAt: timer.updatedAt } });
}

export async function updateTimerLocally(sessionId: string, action: TimerAction): Promise<RestTimerDto | null> {
  const storedTimer = await getOfflineTimer(); if (!storedTimer) return null;
  const ownerSessionId = storedTimer.sessionId ?? await findOfflineWorkoutSessionForSet(storedTimer.setLogId) ?? sessionId;
  const timer = { ...storedTimer, sessionId: ownerSessionId };
  const now = Date.now(); const nowIso = new Date(now).toISOString(); const currentMs = timer.status === "PAUSED" ? (timer.pausedRemainingMs ?? 0) : remainingMilliseconds(timer.endsAt, now); let next: OfflineTimer | null = timer; let finalStatus: "RUNNING" | "PAUSED" | "COMPLETED" | "SKIPPED" = timer.status;
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
  const completedAt = await queueWorkoutCompletion(sessionId);
  void getOfflineTimer().then(async (timer) => { if (timer?.sessionId === sessionId) await clearOfflineTimer(); }).catch(() => undefined);
  return completedAt;
}
