import { describe, expect, it, vi } from "vitest";

import { deleteManagedUser, listUsersForAdmin, setUserAccountStatus } from "@/server/admin-users";

describe("administrator user directory", () => {
  it("rejects a normal user before querying account data", async () => {
    const findMany = vi.fn();
    await expect(listUsersForAdmin({ user: { findMany } } as never, { id: "user-1", email: "user@example.com", role: "USER" })).rejects.toThrow("Administrator access required");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns only basic account, onboarding, and active-programme information for an administrator", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "admin-1", email: "admin@example.com", role: "ADMIN", status: "ACTIVE", onboardingProfile: null, settings: null, programmeRequests: [] },
      { id: "user-1", email: "user@example.com", role: "USER", status: "DISABLED", onboardingProfile: { path: "FULLY_PERSONALISED" }, settings: { activeProgram: null }, programmeRequests: [{ id: "request-1" }] },
      { id: "user-2", email: "ready@example.com", role: "USER", status: "ACTIVE", onboardingProfile: { path: "SEMI_PERSONALISED" }, settings: { activeProgram: { name: "Starter Programme" } }, programmeRequests: [] },
    ]);
    const result = await listUsersForAdmin({ user: { findMany } } as never, { id: "admin-1", email: "admin@example.com", role: "ADMIN" });
    expect(result).toEqual([
      { id: "admin-1", email: "admin@example.com", role: "ADMIN", status: "ACTIVE", onboardingState: "Not started", activeProgrammeName: null },
      { id: "user-1", email: "user@example.com", role: "USER", status: "DISABLED", onboardingState: "Awaiting personalised programme", activeProgrammeName: null },
      { id: "user-2", email: "ready@example.com", role: "USER", status: "ACTIVE", onboardingState: "Ready", activeProgrammeName: "Starter Programme" },
    ]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { email: "asc" },
      select: expect.objectContaining({ email: true, role: true, status: true, onboardingProfile: expect.any(Object), settings: expect.any(Object) }),
    }));
  });

  it("lets an administrator deactivate and reactivate a user while revoking access", async () => {
    const target = { id: "user-1", email: "user@example.com", role: "USER", status: "ACTIVE" as "ACTIVE" | "DISABLED" };
    const tx = {
      user: { findUnique: vi.fn().mockImplementation(() => Promise.resolve({ ...target })), update: vi.fn().mockImplementation(({ data }) => { target.status = data.status; }) },
      authSession: { deleteMany: vi.fn() }, magicLinkToken: { deleteMany: vi.fn() },
    };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    const actor = { id: "admin-1", email: "admin@example.com", role: "ADMIN" } as const;
    await expect(setUserAccountStatus(prisma as never, actor, target.id, "DISABLED")).resolves.toEqual({ id: target.id, status: "DISABLED" });
    expect(tx.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: target.id } });
    expect(tx.magicLinkToken.deleteMany).toHaveBeenCalledWith({ where: { email: target.email } });
    await expect(setUserAccountStatus(prisma as never, actor, target.id, "ACTIVE")).resolves.toEqual({ id: target.id, status: "ACTIVE" });
    expect(target.status).toBe("ACTIVE");
  });

  it("hard-deletes the user-owned session tree before the user and never touches catalogue models", async () => {
    const calls: string[] = [];
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.com", role: "USER", status: "DISABLED" }), delete: vi.fn().mockImplementation(() => { calls.push("user"); }) },
      magicLinkToken: { deleteMany: vi.fn().mockImplementation(() => { calls.push("magic-links"); }) },
      workoutSession: { deleteMany: vi.fn().mockImplementation(() => { calls.push("workout-sessions"); }) },
    };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx), exercise: { deleteMany: vi.fn() }, equipment: { deleteMany: vi.fn() }, muscle: { deleteMany: vi.fn() } };
    await expect(deleteManagedUser(prisma as never, { id: "admin-1", email: "admin@example.com", role: "ADMIN" }, "user-1")).resolves.toEqual({ id: "user-1", deleted: true });
    expect(calls).toEqual(["magic-links", "workout-sessions", "user"]);
    expect(prisma.exercise.deleteMany).not.toHaveBeenCalled(); expect(prisma.equipment.deleteMany).not.toHaveBeenCalled(); expect(prisma.muscle.deleteMany).not.toHaveBeenCalled();
  });

  it("prevents self-management, administrator targets, and normal-user API logic", async () => {
    const transaction = vi.fn();
    const admin = { id: "admin-1", email: "admin@example.com", role: "ADMIN" } as const;
    await expect(setUserAccountStatus({ $transaction: transaction } as never, admin, admin.id, "DISABLED")).rejects.toThrow("own current account");
    await expect(deleteManagedUser({ $transaction: transaction } as never, admin, admin.id)).rejects.toThrow("own current account");
    await expect(setUserAccountStatus({ $transaction: transaction } as never, { id: "user-1", email: "user@example.com", role: "USER" }, "other-user", "DISABLED")).rejects.toThrow("Administrator access required");
    expect(transaction).not.toHaveBeenCalled();

    const tx = { user: { findUnique: vi.fn().mockResolvedValue({ id: "admin-2", email: "other-admin@example.com", role: "ADMIN", status: "ACTIVE" }) } };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    await expect(deleteManagedUser(prisma as never, admin, "admin-2")).rejects.toThrow("Administrator accounts cannot be managed");
  });
});
