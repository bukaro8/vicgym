import { beforeEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/server/resend", () => ({ sendResendEmail: send }));
vi.mock("@/lib/env", () => ({ getAuthEmailEnv: () => ({ APP_ORIGIN: "https://gym.example.com", RESEND_API_KEY: "secret", RESEND_FROM_EMAIL: "VicGym <login@example.com>", ADMIN_EMAIL: "admin@example.com" }) }));

import { buildProgrammeReadyEmail, notifyAdminOfProgrammeRequest, notifyUserProgrammeReady, sendProgrammeWelcomeEmail } from "@/server/programme-request-notifications";

const pending = { id: "request-1", status: "PENDING", createdAt: new Date("2026-09-09T12:00:00Z"), user: { email: "user@example.com", onboardingProfile: { goal: "GENERAL_FITNESS", trainingDaysPerWeek: 3, sessionLengthMinutes: 60 } } };
const completed = { id: "request-1", status: "COMPLETED", user: { email: "user@example.com", onboardingProfile: { goal: "BUILD_MUSCLE", trainingDaysPerWeek: 4, sessionLengthMinutes: 60, cardioPreference: "SOME", limitationsText: "Private limitation details must never appear" }, settings: { activeProgram: { name: "Four-day Strength", activeVersion: { _count: { days: 4 } } } } } };

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
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "user@example.com", subject: "Your VicGym programme is ready", idempotencyKey: "programme-request-request-1-completed", text: expect.stringContaining("Four-day Strength"), html: expect.stringContaining("Four-day Strength") }));
    const message = send.mock.calls[0][0];
    expect(message.text).toContain("Goal: build muscle");
    expect(message.text).toContain("Training frequency: 4 days per week");
    expect(message.text).toContain("Preferred session length: 60 minutes");
    expect(message.text).toContain("Cardio preference: some cardio");
    expect(message.text).toContain("It contains 4 training days");
    expect(message.text).toContain("future Coach Reviews");
    expect(`${message.text}${message.html}`).not.toContain("Private limitation details");
    expect(JSON.stringify(findFirst.mock.calls[0][0])).not.toContain("limitationsText");
    vi.clearAllMocks();
    expect(await notifyUserProgrammeReady(prisma as never, "cancelled-request")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
  it("does not send a duplicate completion email after its notification timestamp is recorded", async () => {
    const prisma = { programmeRequest: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn() } };
    expect(await notifyUserProgrammeReady(prisma as never, "request-1")).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(prisma.programmeRequest.updateMany).not.toHaveBeenCalled();
  });
  it("logs provider failure without throwing or affecting the completed programme operation", async () => {
    send.mockRejectedValue(new Error("provider unavailable")); const error = vi.fn(); const prisma = { programmeRequest: { findFirst: vi.fn().mockResolvedValue(completed), updateMany: vi.fn() } };
    await expect(notifyUserProgrammeReady(prisma as never, "request-1", { error, info: vi.fn() })).resolves.toBe(false);
    expect(error).toHaveBeenCalledWith("Personalised programme completion notification failed", expect.objectContaining({ requestId: "request-1", error: "provider unavailable" }));
    expect(prisma.programmeRequest.updateMany).not.toHaveBeenCalled();
  });
  it("builds supportive deterministic copy without medical or technical terminology", () => {
    const email = buildProgrammeReadyEmail({ programmeName: "Starter Routine", trainingDayCount: 3, goal: "GENERAL_FITNESS", trainingDaysPerWeek: 3, sessionLengthMinutes: 45, cardioPreference: "MINIMAL", url: "https://gym.example.com/" });
    expect(email.text).toContain("Starter Routine");
    expect(email.text).toContain("comfortable working loads");
    expect(email.text).toContain("actual reps and loads");
    expect(email.text).not.toMatch(/database|ProgramVersion|injury/i);
  });
  it("sends an explicitly reviewed welcome email once to the request owner", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const request = { id: "request-1", user: { email: "user@example.com", settings: null }, createdProgram: { name: "Four-day Strength" } };
    const prisma = { programmeRequest: { findFirst: vi.fn().mockResolvedValue(request), updateMany } };
    const result = await sendProgrammeWelcomeEmail(prisma as never, { id: "admin-1", email: "admin@example.com", role: "ADMIN" }, "request-1", "Welcome to your programme. Start conservatively and record how each set feels.");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "user@example.com", subject: "Your VicGym programme is ready", idempotencyKey: "programme-request-request-1-welcome", text: result.text }));
    expect(result.text).toContain("Open VicGym: https://gym.example.com/");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { welcomeEmailSentAt: expect.any(Date), welcomeEmailBody: result.text } }));
  });
  it("blocks normal users and duplicate welcome-email sends", async () => {
    const prisma = { programmeRequest: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn() } };
    await expect(sendProgrammeWelcomeEmail(prisma as never, { id: "user-1", email: "user@example.com", role: "USER" }, "request-1", "A sufficiently long welcome email draft body.")).rejects.toThrow("Administrator access required");
    await expect(sendProgrammeWelcomeEmail(prisma as never, { id: "admin-1", email: "admin@example.com", role: "ADMIN" }, "request-1", "A sufficiently long welcome email draft body.")).rejects.toThrow("already sent or the programme request is not ready");
    expect(send).not.toHaveBeenCalled();
  });
  it("does not change programme state or mark the email sent when Resend fails", async () => {
    send.mockRejectedValue(new Error("provider unavailable"));
    const updateMany = vi.fn(); const error = vi.fn();
    const prisma = { programmeRequest: { findFirst: vi.fn().mockResolvedValue({ id: "request-1", user: { email: "user@example.com", settings: null }, createdProgram: { name: "Plan" } }), updateMany } };
    await expect(sendProgrammeWelcomeEmail(prisma as never, { id: "admin-1", email: "admin@example.com", role: "ADMIN" }, "request-1", "A sufficiently long reviewed welcome email body.", { error, info: vi.fn() })).rejects.toThrow("programme remains active");
    expect(updateMany).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("Personalised programme welcome email failed", expect.objectContaining({ requestId: "request-1" }));
  });
});
