import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StartWorkoutButton } from "@/components/start-workout-button";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("StartWorkoutButton", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ sessionId: "session-1", exerciseSessionId: "exercise-1" }), { status: 200, headers: { "Content-Type": "application/json" } })); });

  it("asks about cardio and records a yes choice without starting the counter", async () => {
    const user = userEvent.setup(); render(<StartWorkoutButton workoutDayId="day-1"/>);
    await user.click(screen.getByRole("button", { name: "Start workout" }));
    expect(screen.getByRole("heading", { name: "Are you doing cardio?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes, add cardio" }));
    expect(fetch).toHaveBeenCalledWith("/api/workouts/start", expect.objectContaining({ body: JSON.stringify({ workoutDayId: "day-1", cardioPlanned: true }) }));
    expect(push).toHaveBeenCalledWith("/workouts/session-1/exercises/exercise-1");
  });

  it("supports starting without cardio", async () => {
    const user = userEvent.setup(); render(<StartWorkoutButton workoutDayId="day-1"/>);
    await user.click(screen.getByRole("button", { name: "Start workout" }));
    await user.click(screen.getByRole("button", { name: "No cardio today" }));
    expect(fetch).toHaveBeenCalledWith("/api/workouts/start", expect.objectContaining({ body: JSON.stringify({ workoutDayId: "day-1", cardioPlanned: false }) }));
  });
});
