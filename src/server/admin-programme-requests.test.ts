import { beforeEach, describe, expect, it, vi } from "vitest";

const { apply, preview } = vi.hoisted(() => ({ apply: vi.fn(), preview: vi.fn() }));
vi.mock("@/server/coach-import", () => ({ parseCoachImport: vi.fn(() => ({ schemaVersion: 2 })), previewCoachImport: preview, applyCoachImportInTransaction: apply }));

import { applyRequestProgramme, previewRequestProgramme } from "@/server/admin-programme-requests";

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
});
