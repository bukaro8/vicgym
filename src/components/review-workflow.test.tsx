import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewWorkflow } from "@/components/review-workflow";

describe("ReviewWorkflow", () => {
  it("revalidates selected operations and applies only the reviewed subset", async () => {
    const user = userEvent.setup();
    const changes = [{ action: "upsert", day: "upper-a", exercise: "chest-press", restSeconds: 60 }, { action: "remove", day: "upper-a", exercise: "biceps-curl" }];
    const input = { schemaVersion: 1, program: "small-gym", baseVersion: 1, changes };
    const preview = { kind: "patch", program: "small-gym", programName: "Small Gym", baseVersion: 1, nextVersion: 2, days: [], changes: [], changed: [], added: [], removed: [], reordered: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ preview, versionNumber: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReviewWorkflow initialReview={{ weekStart: "2026-08-24", weekEnd: "2026-08-31", report: "Report", isEmpty: false, completedSessions: 1, workingSets: 3, programSlug: "small-gym", versionNumber: 1 }} />);
    fireEvent.change(screen.getByLabelText("Coach JSON changes"), { target: { value: JSON.stringify(input) } });
    await user.click(screen.getByRole("button", { name: "Validate changes" }));
    const remove = await screen.findByRole("checkbox", { name: /Remove: biceps-curl/ });
    const confirm = screen.getByRole("checkbox", { name: /I have reviewed/ });
    await user.click(confirm);
    await user.click(remove);
    expect(confirm).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Apply changes and activate" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Update preview" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const subset = JSON.parse(JSON.parse(fetchMock.mock.calls[1][1].body).json);
    expect(subset).toEqual({ ...input, changes: [changes[0]] });
    await user.click(await screen.findByRole("checkbox", { name: /I have reviewed/ }));
    await user.click(screen.getByRole("button", { name: "Apply changes and activate" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).json).toBe(JSON.parse(fetchMock.mock.calls[1][1].body).json);
  });

  it("keeps apply blocked when subset validation fails and when everything is deselected", async () => {
    const user = userEvent.setup();
    const input = { schemaVersion: 1, program: "small-gym", baseVersion: 1, changes: [{ action: "add-day", day: { slug: "extra", name: "Extra", rotationOrder: 2, exercises: [] } }, { day: "upper-a", exercise: "chest-press", position: 2 }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ preview: { kind: "patch", baseVersion: 1, nextVersion: 2, days: [], changed: [], added: [], removed: [], reordered: [] } }) }).mockResolvedValue({ ok: false, json: async () => ({ error: "Duplicate final position" }) }));
    render(<ReviewWorkflow initialReview={{ weekStart: "2026-08-24", weekEnd: "2026-08-31", report: "Report", isEmpty: true, completedSessions: 0, workingSets: 0, programSlug: "small-gym", versionNumber: 1 }} />);
    fireEvent.change(screen.getByLabelText("Coach JSON changes"), { target: { value: JSON.stringify(input) } });
    await user.click(screen.getByRole("button", { name: "Validate changes" }));
    await user.click(await screen.findByRole("checkbox", { name: /Add day: Extra/ }));
    await user.click(screen.getByRole("button", { name: "Update preview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Duplicate final position");
    expect(screen.queryByRole("button", { name: "Apply changes and activate" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Update: chest-press/ }));
    expect(screen.getByRole("button", { name: "Update preview" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Coach JSON changes"), { target: { value: "{}" } });
    expect(screen.queryByText("Choose changes to include")).not.toBeInTheDocument();
  });
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
