import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewWorkflow } from "@/components/review-workflow";

describe("ReviewWorkflow", () => {
  afterEach(() => vi.restoreAllMocks());
  it("copies exactly the report displayed in the preview", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const report = "# VicGym weekly review\n\n## WEEK\n2026-08-24 to 2026-08-30";
    render(<ReviewWorkflow initialReview={{ weekStart: "2026-08-24", weekEnd: "2026-08-31", report, isEmpty: false, completedSessions: 1, workingSets: 3, programSlug: "upper-lower", versionNumber: 4 }} />);

    const preview = screen.getByLabelText("Weekly report preview") as HTMLTextAreaElement;
    expect(preview.value).toBe(report);
    await user.click(screen.getByRole("button", { name: "Copy for ChatGPT" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(preview.value));
  });

  it("shows a creation-specific preview and requires explicit confirmation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ preview: { kind: "create", program: "small-gym", programName: "Small Gym Programme", baseVersion: null, nextVersion: 1, days: [{ slug: "upper-a", name: "Upper A", rotationOrder: 1, exerciseCount: 1 }], changes: [{ kind: "added", day: "Upper A", exercise: "Chest Press", details: ["Add to Upper A"] }], changed: [], added: [{ kind: "added", day: "Upper A", exercise: "Chest Press", details: ["Add to Upper A"] }], removed: [], reordered: [] } }) }));
    render(<ReviewWorkflow initialReview={{ weekStart: "2026-08-24", weekEnd: "2026-08-31", report: "No active programme", isEmpty: true, completedSessions: 0, workingSets: 0, programSlug: null, versionNumber: null }} />);
    fireEvent.change(screen.getByLabelText("Coach JSON changes"), { target: { value: "{\"schemaVersion\":2}" } });
    await user.click(screen.getByRole("button", { name: "Validate changes" }));
    expect(await screen.findByText("Create Small Gym Programme [small-gym] · version 1")).toBeVisible();
    const apply = screen.getByRole("button", { name: "Create and activate programme" });
    expect(apply).toBeDisabled();
    await user.click(screen.getByText("I have reviewed this programme and want to create version 1 and activate it."));
    expect(apply).toBeEnabled();
  });
});
