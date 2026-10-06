"use client";

import { WorkoutList } from "@/components/workout-list";

// Keep previously cached/resume URLs usable; every entry point now opens the list.
export function OfflineWorkoutView({ sessionId }: Readonly<{ sessionId: string; exerciseSessionId: string }>) {
  return <WorkoutList sessionId={sessionId}/>;
}
