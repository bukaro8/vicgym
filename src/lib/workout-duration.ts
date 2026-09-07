type DateValue = Date | string | null | undefined;

export type WorkoutDurationInput = {
  startedAt: DateValue;
  completedAt: DateValue;
  cardioStoppedAt?: DateValue;
  exerciseSessions?: Array<{ setLogs: Array<{ completedAt: DateValue }> }>;
};

function milliseconds(value: DateValue): number | null {
  if (!value) return null;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

/**
 * A completion timestamp is a lifecycle event, not training activity. Offline
 * or forgotten sessions can be completed long after their last exercise, so
 * recorded training ends at the final completed set or stopped cardio period.
 */
export function completedWorkoutDurationSeconds(input: WorkoutDurationInput): number | null {
  const startedAt = milliseconds(input.startedAt);
  const completedAt = milliseconds(input.completedAt);
  if (startedAt === null || completedAt === null) return null;

  const candidates = [
    milliseconds(input.cardioStoppedAt),
    ...(input.exerciseSessions ?? []).flatMap((exercise) => exercise.setLogs.map((set) => milliseconds(set.completedAt))),
  ].filter((value): value is number => value !== null && value >= startedAt && value <= completedAt);

  if (!candidates.length) return 0;
  return Math.max(0, Math.floor((Math.max(...candidates) - startedAt) / 1000));
}

export function completedWorkoutDurationMinutes(input: WorkoutDurationInput): number | null {
  const seconds = completedWorkoutDurationSeconds(input);
  if (seconds === null) return null;
  return seconds === 0 ? 0 : Math.max(1, Math.round(seconds / 60));
}
