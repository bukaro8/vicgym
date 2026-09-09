import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgrammePreview } from "@/components/admin-programme-request-workflow";

describe("administrator programme preview", () => {
  it("renders the owner, days, and validated ordered exercise settings", () => {
    const preview = { kind: "create" as const, program: "starter", programName: "Starter Programme", baseVersion: null, nextVersion: 1, days: [{ slug: "upper-a", name: "Upper A", rotationOrder: 1, exerciseCount: 2, exercises: [{ slug: "chest-press", name: "Chest Press", position: 1, sets: 3, targetReps: 12, plannedLoad: "L8", restSeconds: 90, autoRest: true }, { slug: "push-up", name: "Push-up", position: 2, sets: 2, targetReps: 12, plannedLoad: "Bodyweight", restSeconds: 60, autoRest: false }] }], changes: [], changed: [], added: [], removed: [], reordered: [] };
    render(<ProgrammePreview ownerEmail="owner@example.com" preview={preview}/>);
    expect(screen.getByText("Starter Programme")).toBeInTheDocument();
    expect(screen.getByText(/creates version 1 for owner@example.com/)).toBeInTheDocument();
    expect(screen.getByText("1. Upper A")).toBeInTheDocument();
    expect(screen.getByText("1. Chest Press")).toBeInTheDocument();
    expect(screen.getByText(/3 sets × 12 reps · L8 · 90s rest · auto rest/)).toBeInTheDocument();
    expect(screen.getByText("2. Push-up")).toBeInTheDocument();
  });
});
