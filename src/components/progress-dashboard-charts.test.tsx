import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MuscleRadar, TrainingActivityChart } from "./progress-dashboard-charts";

describe("progress charts", () => {
  it("exposes bar details by touch and through the date selector", () => {
    render(<TrainingActivityChart unit="day" buckets={[{ date: "2026-10-05", label: "5 Oct", sets: 3, workouts: 1, minutes: 30, reps: 36 }, { date: "2026-10-06", label: "6 Oct", sets: 6, workouts: 2, minutes: 70, reps: 72 }]}/>);
    fireEvent.click(screen.getByRole("button", { name: "5 Oct: 3 sets, 1 workouts" }));
    expect(screen.getByText(/1 workouts · 30 min · 36 reps/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tap a bar or choose a date"), { target: { value: "2026-10-06" } });
    expect(screen.getByText(/2 workouts · 70 min · 72 reps/)).toBeInTheDocument();
  });
  it("provides an accessible muscle description and collapsed numerical detail", () => {
    render(<MuscleRadar muscles={[{ name: "Chest", value: 3 }, { name: "Arms", value: 1.5 }, { name: "Back", value: 0 }]}/>);
    expect(screen.getByRole("img")).toHaveAccessibleName("Muscle contribution: Chest 3, Arms 1.5, Back 0");
    expect(screen.getByText("View breakdown").closest("details")).not.toHaveAttribute("open");
  });
});
