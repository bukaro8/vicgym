import { beforeEach, describe, expect, it, vi } from "vitest";

const { apply, preview } = vi.hoisted(() => ({ apply: vi.fn(), preview: vi.fn() }));
vi.mock("@/server/coach-import", () => ({ parseCoachImport: vi.fn(() => ({ schemaVersion: 2 })), previewCoachImport: preview, applyCoachImportInTransaction: apply }));

import { applyRequestProgramme, buildCoachBrief, listProgrammeRequests, normalizeRequestFilter, previewRequestProgramme, questionnaireLabel } from "@/server/admin-programme-requests";

describe("administrator programme request processing", () => {
  beforeEach(() => { vi.clearAllMocks(); preview.mockResolvedValue({ kind: "create" }); apply.mockResolvedValue({ kind: "create", program: "owner-program", versionNumber: 1 }); });
  it("validates schemaVersion 2 against the request owner, not the administrator", async () => {
    const prisma = { programmeRequest: { findFirst: vi.fn().mockResolvedValue({ id: "request-1", userId: "owner-1" }) } };
    await previewRequestProgramme(prisma as never, "request-1", "{}");
    expect(preview).toHaveBeenCalledWith(prisma, "owner-1", "{}", { personalisedRequestId: "request-1" });
  });
  it("claims the pending request, creates for its owner, and completes atomically", async () => {
    const tx = { programmeRequest: { findFirst: vi.fn().mockResolvedValue({ id: "request-1", userId: "owner-1" }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    const result = await applyRequestProgramme(prisma as never, "request-1", "{}");
    expect(apply).toHaveBeenCalledWith(tx, "owner-1", "{}", { personalisedRequestId: "request-1" });
    expect(tx.programmeRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "request-1", status: "PENDING" }, data: expect.objectContaining({ status: "COMPLETED" }) }));
    expect(result.ownerId).toBe("owner-1");
  });
  it("refuses completed, cancelled, missing, or already claimed requests", async () => {
    const tx = { programmeRequest: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn() } };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    await expect(applyRequestProgramme(prisma as never, "processed-request", "{}")).rejects.toThrow("already processed");
    expect(apply).not.toHaveBeenCalled();
  });
  it("defaults invalid or missing filters to Pending and scopes explicit statuses", async () => {
    expect(normalizeRequestFilter(undefined)).toBe("PENDING"); expect(normalizeRequestFilter("unknown")).toBe("PENDING"); expect(normalizeRequestFilter("COMPLETED")).toBe("COMPLETED");
    const findMany = vi.fn().mockResolvedValue([]); await listProgrammeRequests({ programmeRequest: { findMany } } as never, "CANCELLED");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "CANCELLED" } }));
  });
  it("sorts All with pending requests first", async () => {
    const requests = [{ id: "cancelled", status: "CANCELLED", createdAt: new Date("2026-09-09T12:00:00Z") }, { id: "pending", status: "PENDING", createdAt: new Date("2026-09-08T12:00:00Z") }, { id: "completed", status: "COMPLETED", createdAt: new Date("2026-09-10T12:00:00Z") }];
    const result = await listProgrammeRequests({ programmeRequest: { findMany: vi.fn().mockResolvedValue(requests) } } as never, "ALL");
    expect(result.map((request) => request.id)).toEqual(["pending", "completed", "cancelled"]);
  });
  it("exports a compact human-readable Coach Brief with catalogue load rules", async () => {
    const request = { id: "request-1", status: "PENDING", createdAt: new Date(), user: { id: "owner-1", email: "private@example.com", settings: null, onboardingProfile: { goal: "GENERAL_FITNESS", trainingDaysPerWeek: 3, sessionLengthMinutes: 60, experience: "SOME_EXPERIENCE", cardioPreference: "ENJOYS_CARDIO", trainingPreferences: "Machines", hasLimitations: false, limitationsText: null, personalPriorities: "Consistency", additionalNotes: null } } };
    const prisma = { programmeRequest: { findUnique: vi.fn().mockResolvedValue(request) }, exercise: { findMany: vi.fn().mockResolvedValue([{ name: "Chest Press", slug: "chest-press", equipment: { name: "Chest Press" }, loadTrackingType: "MACHINE_LEVEL", loadEntryMode: "STACK_TOTAL" }]) } };
    const result = await buildCoachBrief(prisma as never, "request-1");
    expect(result.markdown).toContain("Goal: Maintain / general fitness"); expect(result.markdown).toContain("Cardio preference: I enjoy cardio"); expect(result.markdown).toContain("Chest Press [chest-press]"); expect(result.markdown).toContain("tracking: Machine level"); expect(result.markdown).toContain('"type":"machineLevel"'); expect(result.markdown).not.toContain("private@example.com");
    expect(questionnaireLabel("SOME_EXPERIENCE")).toBe("Some experience");
  });
});
