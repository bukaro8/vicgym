import "fake-indexeddb/auto";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkoutList } from "@/components/workout-list";
import { clearPrivateOfflineData, configureOfflineOwner, getOfflineWorkout, putOfflineWorkout } from "@/lib/offline-db";
import type { OfflineWorkout } from "@/lib/offline-types";

vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/cardio-timer", () => ({ CardioTimer: () => <div>Cardio controls</div> }));
vi.mock("@/lib/offline-sync", () => ({ syncOfflineMutations: vi.fn().mockResolvedValue("saved-local") }));
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const snapshot: OfflineWorkout = {
  schemaVersion: 2, id: "workout", programId: "program", programSlug: "small-gym", programName: "Small Gym", programVersionId: "version", programVersionNumber: 3,
  workoutDayId: "day", workoutDaySlug: "upper-a", workoutDayName: "Upper A", status: "IN_PROGRESS", startedAt: "2026-10-06T10:00:00Z", completedAt: null, updatedAt: "2026-10-06T10:00:00Z", currentExerciseId: "first",
  exercises: ["First exercise", "Second exercise"].map((name, i) => ({ id: `exercise-${i}`, exerciseId: `catalogue-${i}`, name, slug: `exercise-${i}`, position: i + 1, plannedSets: 1, targetReps: 12, restSeconds: 60, autoRest: false, loadTrackingType: "KILOGRAM", loadEntryMode: "PER_DUMBBELL", equipmentName: "Dumbbells", imagePath: null, sets: [{ id: `set-${i}`, setNumber: 1, targetReps: 12, actualReps: null, weightKg: null, loadValue: null, loadTrackingType: "KILOGRAM", completedAt: null }] })),
  catalogue: [{ exerciseId: "extra", slug: "extra", name: "Extra exercise", defaultTargetReps: 12, loadTrackingType: "KILOGRAM", loadEntryMode: "PER_DUMBBELL", equipmentName: "Dumbbells", imagePath: null }],
};

describe("single-page workout", () => {
  beforeEach(async () => { vi.clearAllMocks(); configureOfflineOwner("test-user"); await clearPrivateOfflineData(); await putOfflineWorkout(snapshot); });

  it("logs the second exercise first and keeps completed cards visible", async () => {
    const user = userEvent.setup(); render(<WorkoutList sessionId="workout"/>);
    const second = within(await screen.findByRole("article", { name: "Second exercise" }));
    await user.click(second.getByRole("button", { name: "Log sets" }));
    await user.type(second.getByLabelText("Set 1 weight per dumbbell (kg)"), "10");
    await user.click(second.getByRole("button", { name: "Complete set" }));
    await waitFor(() => expect(screen.getByText("1/2 sets complete")).toBeInTheDocument());
    const local = await getOfflineWorkout("workout");
    expect(local?.exercises[0].sets[0].completedAt).toBeNull();
    expect(local?.exercises[1].sets[0]).toMatchObject({ actualReps: 12, loadValue: 10, loadTrackingType: "KILOGRAM" });
    expect(second.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.queryByRole("navigation", { name: "Exercise navigation" })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps drafts when collapsed and restores logged sets on remount", async () => {
    const user = userEvent.setup(); const view = render(<WorkoutList sessionId="workout"/>);
    const first = within(await screen.findByRole("article", { name: "First exercise" }));
    await user.click(first.getByRole("button", { name: "Log sets" }));
    await user.type(first.getByLabelText("Set 1 notes"), "Good form");
    await user.click(first.getByRole("button", { name: "Hide sets" }));
    await user.click(first.getByRole("button", { name: "Log sets" }));
    expect(first.getByLabelText("Set 1 notes")).toHaveValue("Good form");
    await user.click(first.getByRole("button", { name: "Complete set" }));
    await waitFor(() => expect(screen.getByText("1/2 sets complete")).toBeInTheDocument());
    view.unmount(); render(<WorkoutList sessionId="workout"/>);
    const restored = within(await screen.findByRole("article", { name: "First exercise" }));
    await user.click(restored.getByRole("button", { name: "Log sets" }));
    expect(restored.getByLabelText("Set 1 notes")).toHaveValue("Good form");
    expect(restored.getByRole("link", { name: "First exercise" })).toHaveAttribute("href", "/exercises/exercise-0?workout=workout");
  });

  it("adds an extra exercise without leaving the list and keeps finish available", async () => {
    const user = userEvent.setup(); render(<WorkoutList sessionId="workout"/>);
    await user.click(await screen.findByRole("button", { name: "Add exercise" }));
    await user.click(await screen.findByRole("button", { name: /Extra exercise.*Weight per dumbbell/ }));
    expect(await screen.findByRole("article", { name: "Extra exercise" })).toBeInTheDocument();
    expect((await getOfflineWorkout("workout"))?.exercises[2].isAdHoc).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Finish workout" })).toHaveAttribute("href", "/workouts/workout/finish");
  });

  it("saves, edits, restores and clears optional effort on the exact set", async () => {
    const user = userEvent.setup(); const view = render(<WorkoutList sessionId="workout"/>);
    let first = within(await screen.findByRole("article", { name: "First exercise" }));
    await user.click(first.getByRole("button", { name: "Log sets" }));
    await user.click(first.getByRole("button", { name: "Set 1 effort Easy" }));
    await user.click(first.getByRole("button", { name: "Complete set" }));
    await waitFor(async () => expect((await getOfflineWorkout("workout"))?.exercises[0].sets[0].effort).toBe("EASY"));
    expect((await getOfflineWorkout("workout"))?.exercises[1].sets[0].effort).toBeUndefined();
    await user.click(first.getByRole("button", { name: "Set 1 effort Hard" }));
    await user.click(first.getByRole("button", { name: "Save changes" }));
    await waitFor(async () => expect((await getOfflineWorkout("workout"))?.exercises[0].sets[0].effort).toBe("HARD"));
    view.unmount(); render(<WorkoutList sessionId="workout"/>);
    first = within(await screen.findByRole("article", { name: "First exercise" }));
    await user.click(first.getByRole("button", { name: "Log sets" }));
    expect(first.getByRole("button", { name: "Set 1 effort Hard" })).toHaveAttribute("aria-pressed", "true");
    await user.click(first.getByRole("button", { name: "Set 1 effort Hard" }));
    await user.click(first.getByRole("button", { name: "Save changes" }));
    await waitFor(async () => expect((await getOfflineWorkout("workout"))?.exercises[0].sets[0].effort).toBeNull());
  });
});
