import { describe, expect, it, vi } from "vitest";

import { listUsersForAdmin } from "@/server/admin-users";

describe("administrator user directory", () => {
  it("rejects a normal user before querying account data", async () => {
    const findMany = vi.fn();
    await expect(listUsersForAdmin({ user: { findMany } } as never, { id: "user-1", email: "user@example.com", role: "USER" })).rejects.toThrow("Administrator access required");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns only basic account, onboarding, and active-programme information for an administrator", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "admin-1", email: "admin@example.com", role: "ADMIN", onboardingProfile: null, settings: null, programmeRequests: [] },
      { id: "user-1", email: "user@example.com", role: "USER", onboardingProfile: { path: "FULLY_PERSONALISED" }, settings: { activeProgram: null }, programmeRequests: [{ id: "request-1" }] },
      { id: "user-2", email: "ready@example.com", role: "USER", onboardingProfile: { path: "SEMI_PERSONALISED" }, settings: { activeProgram: { name: "Starter Programme" } }, programmeRequests: [] },
    ]);
    const result = await listUsersForAdmin({ user: { findMany } } as never, { id: "admin-1", email: "admin@example.com", role: "ADMIN" });
    expect(result).toEqual([
      { id: "admin-1", email: "admin@example.com", role: "ADMIN", onboardingState: "Not started", activeProgrammeName: null },
      { id: "user-1", email: "user@example.com", role: "USER", onboardingState: "Awaiting personalised programme", activeProgrammeName: null },
      { id: "user-2", email: "ready@example.com", role: "USER", onboardingState: "Ready", activeProgrammeName: "Starter Programme" },
    ]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { email: "asc" },
      select: expect.objectContaining({ email: true, role: true, onboardingProfile: expect.any(Object), settings: expect.any(Object) }),
    }));
  });
});
