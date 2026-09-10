import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apply: vi.fn(), revalidate: vi.fn(), requireAdmin: vi.fn(), prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/http/same-origin", () => ({ assertSameOriginJson: vi.fn(), RequestPolicyError: class RequestPolicyError extends Error { status = 400; } }));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));
vi.mock("@/server/admin-programme-requests", () => ({ applyRequestProgramme: mocks.apply }));
vi.mock("@/server/auth", () => ({
  requireAdminUser: mocks.requireAdmin,
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  AdminRequiredError: class AdminRequiredError extends Error {},
}));

import { POST } from "@/app/api/admin/programme-requests/[requestId]/apply/route";

describe("personalised programme apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mocks.apply.mockResolvedValue({ program: "starter", versionNumber: 1 });
  });

  it("activates successfully without automatically sending a welcome email", async () => {
    const request = new Request("https://gym.example.com/api/admin/programme-requests/request-1/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ json: "{}", confirmation: "CREATE_REQUEST_PROGRAMME" }) });
    const response = await POST(request, { params: Promise.resolve({ requestId: "request-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ applied: true, program: "starter", versionNumber: 1 });
    expect(mocks.apply).toHaveBeenCalledWith(mocks.prisma, "request-1", "{}");
  });
});
