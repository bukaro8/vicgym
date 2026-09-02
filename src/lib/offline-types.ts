export type OfflineSet = {
  id: string;
  setNumber: number;
  targetReps: number;
  actualReps: number | null;
  weightKg: number | null;
  loadValue?: number | null;
  loadTrackingType?: "KILOGRAM" | "MACHINE_LEVEL" | "BODYWEIGHT" | "REPS_ONLY" | null;
  loadEntryMode?: "STACK_TOTAL" | "TOTAL_LOAD" | "PER_DUMBBELL" | "BODYWEIGHT" | "NONE" | null;
  completedAt: string | null;
  notes?: string | null;
};

export type OfflineExercise = {
  id: string;
  exerciseId: string;
  slug: string;
  name: string;
  position: number;
  plannedSets: number;
  targetReps: number;
  restSeconds: number;
  autoRest: boolean;
  loadTrackingType?: "KILOGRAM" | "MACHINE_LEVEL" | "BODYWEIGHT" | "REPS_ONLY" | null;
  loadEntryMode?: "STACK_TOTAL" | "TOTAL_LOAD" | "PER_DUMBBELL" | "BODYWEIGHT" | "NONE" | null;
  equipmentName: string | null;
  imagePath: string | null;
  sets: OfflineSet[];
};

export type OfflineWorkout = {
  schemaVersion: 1 | 2;
  id: string;
  programId: string;
  programSlug: string;
  programName: string;
  programVersionId: string;
  programVersionNumber: number;
  workoutDayId: string;
  workoutDaySlug: string;
  status: "IN_PROGRESS" | "COMPLETED";
  workoutDayName: string;
  startedAt: string;
  completedAt: string | null;
  currentExerciseId: string | null;
  exercises: OfflineExercise[];
  updatedAt: string;
};

export type OfflineTimer = {
  id: string;
  /** Optional only for timers persisted by VicGym versions before timer ownership was recorded. */
  sessionId?: string;
  setLogId: string;
  status: "RUNNING" | "PAUSED";
  configuredSeconds: number;
  startedAt: string;
  endsAt: string | null;
  pausedAt: string | null;
  pausedRemainingMs: number | null;
  exerciseName: string;
  completedSetNumber: number;
  nextSetId: string | null;
  updatedAt: string;
};

export type OfflineMutationType = "ADD_SET" | "UPSERT_SET" | "UPSERT_TIMER" | "FINISH_WORKOUT";
export type OfflineMutation = {
  id: string;
  sequence: number;
  type: OfflineMutationType;
  sessionId: string;
  targetId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError: string | null;
};

export type SyncState = "synced" | "saved-local" | "syncing" | "needs-attention" | "offline";
