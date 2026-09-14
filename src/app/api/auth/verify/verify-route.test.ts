import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consume: vi.fn(), cookieOptions: vi.fn(() => ({ httpOnly: true, path: "/" })), prisma: {} }));
vi.mock("@/lib/env", () => ({ getAuthEmailEnv: () => ({ APP_ORIGIN: "https://gym.example.com" }) }));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));
vi.mock("@/server/auth", () => ({ AUTH_COOKIE_NAME: "vicgym_session", consumeMagicLinkToken: mocks.consume, sessionCookieOptions: mocks.cookieOptions }));

import { GET } from "@/app/api/auth/verify/route";

describe("magic-link verification destination", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("redirects an ADMIN login directly to programme requests", async () => {
    mocks.consume.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com", role: "ADMIN" }, sessionToken: "session-token", expiresAt: new Date("2026-10-01T00:00:00Z") });
    const response = await GET(new Request("https://gym.example.com/api/auth/verify?token=valid-token"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://gym.example.com/admin/requests");
    expect(response.headers.get("set-cookie")).toContain("vicgym_session=session-token");
  });

  it("keeps a normal USER login on the normal VicGym root", async () => {
    mocks.consume.mockResolvedValue({ user: { id: "user-1", email: "user@example.com", role: "USER" }, sessionToken: "session-token", expiresAt: new Date("2026-10-01T00:00:00Z") });
    const response = await GET(new Request("https://gym.example.com/api/auth/verify?token=valid-token"));
    expect(response.headers.get("location")).toBe("https://gym.example.com/");
  });
});
