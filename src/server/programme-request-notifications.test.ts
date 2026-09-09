import { beforeEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/server/resend", () => ({ sendResendEmail: send }));
vi.mock("@/lib/env", () => ({ getAuthEmailEnv: () => ({ APP_ORIGIN: "https://gym.example.com", RESEND_API_KEY: "secret", RESEND_FROM_EMAIL: "VicGym <login@example.com>", ADMIN_EMAIL: "admin@example.com" }) }));

import { notifyAdminOfProgrammeRequest, notifyUserProgrammeReady } from "@/server/programme-request-notifications";

const pending = { id: "request-1", status: "PENDING", createdAt: new Date("2026-09-09T12:00:00Z"), user: { email: "user@example.com", onboardingProfile: { goal: "GENERAL_FITNESS", trainingDaysPerWeek: 3, sessionLengthMinutes: 60 } } };
const completed = { id: "request-1", status: "COMPLETED", user: { email: "user@example.com" } };

describe("personalised programme notifications", () => {
  beforeEach(() => { vi.clearAllMocks(); send.mockResolvedValue(undefined); });
  it("notifies the administrator after submission using a stable idempotency key", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 }); const prisma = { programmeRequest: { findFirst: vi.fn().mockResolvedValue(pending), updateMany } };
    expect(await notifyAdminOfProgrammeRequest(prisma as never, "request-1")).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "admin@example.com", idempotencyKey: "programme-request-request-1-submitted", text: expect.stringContaining("user@example.com") }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { submittedNotificationSentAt: expect.any(Date) } }));
  });
  it("does not send a duplicate after the notification timestamp is present", async () => {
    const prisma = { programmeRequest: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn() } };
    expect(await notifyAdminOfProgrammeRequest(prisma as never, "request-1")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
  it("notifies the user only after successful completion and never for cancellation", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 }); const findFirst = vi.fn().mockResolvedValueOnce(completed).mockResolvedValueOnce(null); const prisma = { programmeRequest: { findFirst, updateMany } };
    expect(await notifyUserProgrammeReady(prisma as never, "request-1")).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "user@example.com", subject: "Your VicGym programme is ready", idempotencyKey: "programme-request-request-1-completed" }));
    vi.clearAllMocks();
    expect(await notifyUserProgrammeReady(prisma as never, "cancelled-request")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
  it("logs provider failure without breaking the completed main operation", async () => {
    send.mockRejectedValue(new Error("provider unavailable")); const error = vi.fn(); const prisma = { programmeRequest: { findFirst: vi.fn().mockResolvedValue(completed), updateMany: vi.fn() } };
    await expect(notifyUserProgrammeReady(prisma as never, "request-1", { error, info: vi.fn() })).resolves.toBe(false);
    expect(error).toHaveBeenCalledWith("Personalised programme completion notification failed", expect.objectContaining({ requestId: "request-1", error: "provider unavailable" }));
    expect(prisma.programmeRequest.updateMany).not.toHaveBeenCalled();
  });
});
