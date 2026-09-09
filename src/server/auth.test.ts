import { describe, expect, it, vi } from "vitest";

import { AUTH_SESSION_TTL_MS, MAGIC_LINK_TTL_MS, MagicLinkRateLimitError, assertAdminUser, consumeMagicLinkToken, createMagicLinkToken, deleteAuthSessionByToken, findAuthenticatedUser, hashOpaqueToken, magicLinkExpired, sessionCookieOptions } from "@/server/auth";

describe("magic-link authentication", () => {
  it("creates an expiring token and stores only its hash", async () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    const create = vi.fn();
    const tx = { magicLinkToken: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn(), create } };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    const issued = await createMagicLinkToken(prisma as never, " Victor@Example.com ", now);
    expect(issued.email).toBe("victor@example.com");
    expect(issued.expiresAt.getTime() - now.getTime()).toBe(MAGIC_LINK_TTL_MS);
    expect(issued.tokenHash).toBe(hashOpaqueToken(issued.token));
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ tokenHash: issued.tokenHash, expiresAt: issued.expiresAt }) });
    expect(JSON.stringify(create.mock.calls)).not.toContain(issued.token);
  });

  it("rate-limits repeated requests without issuing another token", async () => {
    const tx = { magicLinkToken: { findFirst: vi.fn().mockResolvedValue({ id: "recent-link" }), updateMany: vi.fn(), create: vi.fn() } };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    await expect(createMagicLinkToken(prisma as never, "victor@example.com", new Date("2026-09-08T12:00:00.000Z"))).rejects.toBeInstanceOf(MagicLinkRateLimitError);
    expect(tx.magicLinkToken.create).not.toHaveBeenCalled();
  });

  it("rejects expired links and consumes a valid link only once while creating a session", async () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    let usedAt: Date | null = null;
    const authCreate = vi.fn();
    const tx = {
      magicLinkToken: {
        findUnique: vi.fn(async () => ({ id: "link-1", email: "victor@example.com", expiresAt: new Date(now.getTime() + 60_000), usedAt })),
        updateMany: vi.fn(async () => { if (usedAt) return { count: 0 }; usedAt = now; return { count: 1 }; }),
      },
      user: { upsert: vi.fn(async () => ({ id: "user-1", email: "victor@example.com", role: "USER" })) },
      authSession: { create: authCreate },
    };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    const first = await consumeMagicLinkToken(prisma as never, "secret-link", now);
    expect(first?.user).toEqual({ id: "user-1", email: "victor@example.com", role: "USER" });
    expect(first!.expiresAt.getTime() - now.getTime()).toBe(AUTH_SESSION_TTL_MS);
    expect(authCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "user-1", tokenHash: hashOpaqueToken(first!.sessionToken) }) });
    expect(await consumeMagicLinkToken(prisma as never, "secret-link", now)).toBeNull();
    expect(magicLinkExpired(new Date(now.getTime() - 1), now)).toBe(true);
  });

  it("does not consume or create a session for an expired token", async () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    const updateMany = vi.fn();
    const authCreate = vi.fn();
    const tx = {
      magicLinkToken: {
        findUnique: vi.fn().mockResolvedValue({ id: "expired-link", email: "victor@example.com", expiresAt: new Date(now.getTime() - 1), usedAt: null }),
        updateMany,
      },
      user: { upsert: vi.fn() },
      authSession: { create: authCreate },
    };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    expect(await consumeMagicLinkToken(prisma as never, "expired-secret", now)).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
    expect(authCreate).not.toHaveBeenCalled();
  });

  it("resolves valid server sessions, rejects expired sessions, and deletes logout sessions by hash", async () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    const findUnique = vi.fn().mockResolvedValue({ expiresAt: new Date(now.getTime() + 60_000), user: { id: "user-1", email: "victor@example.com", role: "USER" } });
    const deleteMany = vi.fn();
    const prisma = { authSession: { findUnique, deleteMany } };
    expect(await findAuthenticatedUser(prisma as never, "session-secret", now)).toEqual({ id: "user-1", email: "victor@example.com", role: "USER" });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashOpaqueToken("session-secret") } }));
    findUnique.mockResolvedValueOnce({ expiresAt: now, user: { id: "user-1", email: "victor@example.com" } });
    expect(await findAuthenticatedUser(prisma as never, "expired", now)).toBeNull();
    await deleteAuthSessionByToken(prisma as never, "session-secret");
    expect(deleteMany).toHaveBeenCalledWith({ where: { tokenHash: hashOpaqueToken("session-secret") } });
    expect(sessionCookieOptions(new Date(now.getTime() + 1), true)).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  });

  it("enforces administrator role exclusively from the server session", () => {
    expect(() => assertAdminUser({ id: "user-1", email: "user@example.com", role: "USER" })).toThrow("Administrator access required");
    expect(assertAdminUser({ id: "admin-1", email: "admin@example.com", role: "ADMIN" }).id).toBe("admin-1");
  });
});
