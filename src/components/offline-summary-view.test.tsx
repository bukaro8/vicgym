import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OfflineSummaryView } from "@/components/offline-summary-view";
import type { OfflineMutation, OfflineWorkout } from "@/lib/offline-types";

const { getOfflineOutbox, getOfflineWorkout, replace, refresh } = vi.hoisted(() => ({ getOfflineOutbox: vi.fn(), getOfflineWorkout: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/offline-db", () => ({ getOfflineOutbox, getOfflineWorkout }));
vi.mock("next/navigation", () => ({ usePathname: () => "/offline/summary/session-1", useRouter: () => ({ push: vi.fn(), replace, refresh }) }));

const workout: OfflineWorkout = { schemaVersion: 2, id: "session-1", programId: "program-1", programSlug: "small-gym", programName: "Small Gym", programVersionId: "version-1", programVersionNumber: 1, workoutDayId: "day-1", workoutDaySlug: "lower-a", status: "COMPLETED", workoutDayName: "Lower A", startedAt: "2026-09-01T09:00:00.000Z", completedAt: "2026-09-01T10:07:00.000Z", currentExerciseId: null, updatedAt: "2026-09-01T10:07:00.000Z", exercises: [] };
const pending: OfflineMutation = { id: "mutation-1", sequence: 47, type: "FINISH_WORKOUT", sessionId: workout.id, targetId: workout.id, payload: { completedAt: workout.completedAt }, createdAt: workout.completedAt!, attempts: 0, lastError: null };

describe("offline completed-workout summary", () => {
  beforeEach(() => { vi.clearAllMocks(); getOfflineWorkout.mockResolvedValue(workout); getOfflineOutbox.mockResolvedValue([pending]); });

  it("observes acknowledgements and moves to the server summary when its queue clears", async () => {
    render(<OfflineSummaryView sessionId={workout.id} />);
    expect(await screen.findByText("Synchronization pending")).toBeInTheDocument();

    getOfflineOutbox.mockResolvedValue([]);
    act(() => window.dispatchEvent(new Event("vicgym:outbox-changed")));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/workouts/${workout.id}/summary`));
    expect(refresh).toHaveBeenCalled();
  });
});
