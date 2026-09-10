import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), setStatus: vi.fn(), deleteUser: vi.fn(), revalidate: vi.fn(), prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));
vi.mock("@/lib/http/same-origin", () => ({ assertSameOriginJson: vi.fn(), RequestPolicyError: class RequestPolicyError extends Error { status = 400; } }));
vi.mock("@/server/admin-users", () => ({ setUserAccountStatus: mocks.setStatus, deleteManagedUser: mocks.deleteUser, AdminUserManagementError: class AdminUserManagementError extends Error {} }));
vi.mock("@/server/auth", () => ({
  requireAdminUser: mocks.requireAdmin,
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  AdminRequiredError: class AdminRequiredError extends Error {},
}));

import { PATCH } from "@/app/api/admin/users/[userId]/route";
import { AdminRequiredError } from "@/server/auth";

const targetId = "11111111-1111-4111-8111-111111111111";

describe("admin user management route", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("rejects a normal user before invoking management logic", async () => {
    mocks.requireAdmin.mockRejectedValue(new AdminRequiredError("Administrator access required"));
    const request = new Request(`https://gym.example.com/api/admin/users/${targetId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "DISABLED" }) });
    const response = await PATCH(request, { params: Promise.resolve({ userId: targetId }) });
    expect(response.status).toBe(403);
    expect(mocks.setStatus).not.toHaveBeenCalled();
  });

  it("derives the administrator from the session and validates the target", async () => {
    const actor = { id: "admin-1", email: "admin@example.com", role: "ADMIN" };
    mocks.requireAdmin.mockResolvedValue(actor); mocks.setStatus.mockResolvedValue({ id: targetId, status: "DISABLED" });
    const request = new Request(`https://gym.example.com/api/admin/users/${targetId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "DISABLED" }) });
    const response = await PATCH(request, { params: Promise.resolve({ userId: targetId }) });
    expect(response.status).toBe(200);
    expect(mocks.setStatus).toHaveBeenCalledWith(mocks.prisma, actor, targetId, "DISABLED");
  });
});
