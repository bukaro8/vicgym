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
    await user.click(second.getByRole("button", { name: "Complete set 1" }));
    await user.click(screen.getByRole("button", { name: "Skip — no rating" }));
    await waitFor(() => expect(screen.getByText("1/2 sets complete")).toBeInTheDocument());
    const local = await getOfflineWorkout("workout");
    expect(local?.exercises[0].sets[0].completedAt).toBeNull();
    expect(local?.exercises[1].sets[0]).toMatchObject({ actualReps: 12, loadValue: 10, loadTrackingType: "KILOGRAM" });
    expect(second.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(second.getByRole("button", { name: "Log sets" })).toHaveAttribute("aria-expanded", "false");
    expect(within(screen.getByRole("article", { name: "First exercise" })).getByRole("button", { name: "Hide sets" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("navigation", { name: "Exercise navigation" })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps drafts when collapsed and restores logged sets on remount", async () => {
    const user = userEvent.setup(); const view = render(<WorkoutList sessionId="workout"/>);
    const first = within(await screen.findByRole("article", { name: "First exercise" }));
    await user.click(first.getByRole("button", { name: "Log sets" }));
    await user.click(first.getByRole("button", { name: "Set 1 notes" }));
    await user.type(first.getByLabelText("Set 1 notes input"), "Good form");
    await user.click(first.getByRole("button", { name: "Hide sets" }));
    await user.click(first.getByRole("button", { name: "Log sets" }));
    expect(first.getByLabelText("Set 1 notes input")).toHaveValue("Good form");
    await user.click(first.getByRole("button", { name: "Complete set 1" }));
    await user.click(screen.getByRole("button", { name: "Skip — no rating" }));
    await waitFor(() => expect(screen.getByText("1/2 sets complete")).toBeInTheDocument());
    view.unmount(); render(<WorkoutList sessionId="workout"/>);
    const restored = within(await screen.findByRole("article", { name: "First exercise" }));
    await user.click(restored.getByRole("button", { name: "Log sets" }));
    await user.click(restored.getByRole("button", { name: "Set 1 notes" }));
    expect(restored.getByLabelText("Set 1 notes input")).toHaveValue("Good form");
    expect(restored.getByRole("link", { name: "First exercise" })).toHaveAttribute("href", "/exercises/exercise-0?workout=workout");
  });

  it("adds an extra exercise without leaving the list and keeps finish available", async () => {
    const user = userEvent.setup(); render(<WorkoutList sessionId="workout"/>);
    await user.click(await screen.findByRole("button", { name: "Add exercise" }));
    await user.click(await screen.findByRole("button", { name: /Extra exercise.*Weight per dumbbell/ }));
    expect(await screen.findByRole("article", { name: "Extra exercise" })).toBeInTheDocument();
    expect((await getOfflineWorkout("workout"))?.exercises[2].isAdHoc).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getAllByRole("link", { name: "Finish workout" }).at(-1)).toHaveAttribute("href", "/workouts/workout/finish");
  });

  it("saves, edits, restores and clears optional effort on the exact set", async () => {
    const user = userEvent.setup(); const view = render(<WorkoutList sessionId="workout"/>);
    let first = within(await screen.findByRole("article", { name: "First exercise" }));
    await user.click(first.getByRole("button", { name: "Log sets" }));
    await user.click(first.getByRole("button", { name: "Complete set 1" }));
    await user.click(screen.getByRole("button", { name: "Easy" }));
    await waitFor(async () => expect((await getOfflineWorkout("workout"))?.exercises[0].sets[0].effort).toBe("EASY"));
    expect((await getOfflineWorkout("workout"))?.exercises[1].sets[0].effort).toBeUndefined();
    await user.click(first.getByRole("button", { name: "Log sets" }));
    await user.click(first.getByRole("button", { name: "Edit set 1 effort" }));
    expect(screen.getByRole("button", { name: "Easy" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Hard" }));
    await waitFor(async () => expect((await getOfflineWorkout("workout"))?.exercises[0].sets[0].effort).toBe("HARD"));
    view.unmount(); render(<WorkoutList sessionId="workout"/>);
    first = within(await screen.findByRole("article", { name: "First exercise" }));
    await user.click(first.getByRole("button", { name: "Log sets" }));
    await user.click(first.getByRole("button", { name: "Edit set 1 effort" }));
    expect(screen.getByRole("button", { name: "Hard" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Clear rating" }));
    await waitFor(async () => expect((await getOfflineWorkout("workout"))?.exercises[0].sets[0].effort).toBeNull());
  });

  it("shows previous values per row and keeps the card open until its final set", async () => {
    const threeSets = structuredClone(snapshot);
    threeSets.exercises[0].plannedSets = 3;
    threeSets.exercises[0].previousPerformance = ["Set 1: 8 kg per dumbbell × 12", "Set 2: 8 kg per dumbbell × 10", "Set 3: 7 kg per dumbbell × 9"];
    threeSets.exercises[0].sets = [1, 2, 3].map((setNumber) => ({ ...threeSets.exercises[0].sets[0], id: `first-set-${setNumber}`, setNumber }));
    await putOfflineWorkout(threeSets);
    const user = userEvent.setup(); render(<WorkoutList sessionId="workout"/>);
    const first = within(await screen.findByRole("article", { name: "First exercise" }));
    await user.click(first.getByRole("button", { name: "Log sets" }));
    expect(first.getByText("8 kg/DB × 12")).toBeInTheDocument();
    expect(first.getByText("8 kg/DB × 10")).toBeInTheDocument();
    await user.click(first.getByRole("button", { name: "Complete set 1" }));
    await user.click(screen.getByRole("button", { name: "Easy" }));
    await waitFor(async () => expect((await getOfflineWorkout("workout"))?.exercises[0].sets[0].effort).toBe("EASY"));
    await user.click(first.getByRole("button", { name: "Complete set 2" }));
    await user.click(screen.getByRole("button", { name: "Moderate" }));
    await waitFor(async () => expect((await getOfflineWorkout("workout"))?.exercises[0].sets[1].effort).toBe("MODERATE"));
    await user.click(first.getByRole("button", { name: "Complete set 3" }));
    await user.click(screen.getByRole("button", { name: "Hard" }));
    await waitFor(() => expect(first.getByRole("button", { name: "Log sets" })).toBeInTheDocument());
    expect((await getOfflineWorkout("workout"))?.exercises[0].sets.map((set) => set.effort)).toEqual(["EASY", "MODERATE", "HARD"]);
  });

  it("starts auto-rest after rated completion and does not restart it when effort is edited", async () => {
    const withRest = structuredClone(snapshot);
    withRest.exercises[0].autoRest = true;
    await putOfflineWorkout(withRest);
    const timerStarted = vi.fn();
    window.addEventListener("vicgym:timer-started", timerStarted);
    try {
      const user = userEvent.setup(); render(<WorkoutList sessionId="workout"/>);
      const first = within(await screen.findByRole("article", { name: "First exercise" }));
      await user.click(first.getByRole("button", { name: "Log sets" }));
      expect(first.queryByRole("button", { name: "Easy" })).not.toBeInTheDocument();
      await user.click(first.getByRole("button", { name: "Complete set 1" }));
      await user.click(screen.getByRole("button", { name: "Moderate" }));
      await waitFor(() => expect(timerStarted).toHaveBeenCalledTimes(1));
      await user.click(first.getByRole("button", { name: "Log sets" }));
      await user.click(first.getByRole("button", { name: "Edit set 1 effort" }));
      await user.click(screen.getByRole("button", { name: "Hard" }));
      await waitFor(async () => expect((await getOfflineWorkout("workout"))?.exercises[0].sets[0].effort).toBe("HARD"));
      expect(timerStarted).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("vicgym:timer-started", timerStarted);
    }
  });
});
