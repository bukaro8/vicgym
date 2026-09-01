import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FinishWorkout } from "@/components/finish-workout";

const { push, finishWorkoutLocally, syncOfflineMutations } = vi.hoisted(() => ({ push: vi.fn(), finishWorkoutLocally: vi.fn(), syncOfflineMutations: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/offline-workout", () => ({ finishWorkoutLocally }));
vi.mock("@/lib/offline-sync", () => ({ syncOfflineMutations }));

describe("FinishWorkout", () => {
  beforeEach(() => { vi.clearAllMocks(); finishWorkoutLocally.mockResolvedValue("2026-08-31T10:00:00.000Z"); syncOfflineMutations.mockResolvedValue("synced"); });

  it("requires explicit confirmation for incomplete planned sets", async () => {
    const user = userEvent.setup();
    render(<FinishWorkout sessionId="session" incomplete />);
    const button = screen.getByRole("button", { name: "Finish workout" });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    expect(button).toBeEnabled();
  });

  it("finishes a complete workout without an extra checkbox", async () => {
    const user = userEvent.setup();
    render(<FinishWorkout sessionId="session" incomplete={false} />);
    await user.click(screen.getByRole("button", { name: "Finish workout" }));
    expect(finishWorkoutLocally).toHaveBeenCalledWith("session");
    expect(syncOfflineMutations).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/workouts/session/summary");
  });
});
