import { describe, expect, it, vi } from "vitest";

import { bootstrapAdministrator } from "@/server/admin-bootstrap";

describe("administrator bootstrap", () => {
  it("does nothing when ADMIN_EMAIL is not configured", async () => {
    const updateMany = vi.fn();
    expect(await bootstrapAdministrator({ user: { updateMany } } as never, undefined)).toEqual({ configured: false, promoted: false });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("normalizes the configured email and idempotently promotes only that existing user", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    await expect(bootstrapAdministrator({ user: { updateMany } } as never, " Admin@Example.com ", { info: vi.fn() })).resolves.toEqual({ configured: true, promoted: true });
    expect(updateMany).toHaveBeenCalledWith({ where: { email: "admin@example.com" }, data: { role: "ADMIN" } });
  });

  it("logs and continues when the account has not signed in yet", async () => {
    const info = vi.fn();
    const result = await bootstrapAdministrator({ user: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } } as never, "future@example.com", { info });
    expect(result).toEqual({ configured: true, promoted: false });
    expect(info).toHaveBeenCalledWith(expect.stringContaining("does not exist yet"));
  });
});
