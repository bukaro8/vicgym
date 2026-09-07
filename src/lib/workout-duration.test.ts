import { describe, expect, it } from "vitest";

import { completedWorkoutDurationMinutes, completedWorkoutDurationSeconds } from "@/lib/workout-duration";

describe("completed workout duration", () => {
  it("does not count idle time between the last set and delayed completion", () => {
    const session = {
      startedAt: "2026-09-05T09:00:00.000Z",
      completedAt: "2026-09-06T08:00:00.000Z",
      exerciseSessions: [{ setLogs: [{ completedAt: "2026-09-05T10:07:00.000Z" }] }],
    };

    expect(completedWorkoutDurationMinutes(session)).toBe(67);
  });

  it("includes cardio when it ends after the final working set", () => {
    const session = {
      startedAt: "2026-09-05T09:00:00.000Z",
      completedAt: "2026-09-05T10:30:00.000Z",
      cardioStoppedAt: "2026-09-05T10:20:00.000Z",
      exerciseSessions: [{ setLogs: [{ completedAt: "2026-09-05T10:00:00.000Z" }] }],
    };

    expect(completedWorkoutDurationSeconds(session)).toBe(80 * 60);
  });

  it("ignores activity timestamps outside the saved session", () => {
    const session = {
      startedAt: "2026-09-05T09:00:00.000Z",
      completedAt: "2026-09-05T10:00:00.000Z",
      cardioStoppedAt: "2026-09-06T10:00:00.000Z",
      exerciseSessions: [{ setLogs: [{ completedAt: "2026-09-05T08:00:00.000Z" }] }],
    };

    expect(completedWorkoutDurationMinutes(session)).toBe(0);
  });

  it("does not calculate a duration for an incomplete workout", () => {
    expect(completedWorkoutDurationMinutes({ startedAt: "2026-09-05T09:00:00.000Z", completedAt: null })).toBeNull();
  });
});
