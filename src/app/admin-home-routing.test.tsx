import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getOnboardingState: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/server/auth", () => ({ requireCurrentUser: mocks.currentUser }));
vi.mock("@/server/onboarding", () => ({ getOnboardingState: mocks.getOnboardingState }));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => ({}) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import Home from "@/app/page";

describe("administrator home routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
  });

  it("redirects an ADMIN from the root directly to programme requests", async () => {
    mocks.currentUser.mockResolvedValue({ id: "admin-1", email: "admin@example.com", role: "ADMIN" });

    await expect(Home()).rejects.toThrow("redirect:/admin/requests");

    expect(mocks.redirect).toHaveBeenCalledWith("/admin/requests");
    expect(mocks.getOnboardingState).not.toHaveBeenCalled();
  });

  it("keeps the existing onboarding redirect for a normal USER", async () => {
    mocks.currentUser.mockResolvedValue({ id: "user-1", email: "user@example.com", role: "USER" });
    mocks.getOnboardingState.mockResolvedValue({ mode: "CHOOSE_PATH" });

    await expect(Home()).rejects.toThrow("redirect:/onboarding");

    expect(mocks.getOnboardingState).toHaveBeenCalledWith({}, "user-1");
    expect(mocks.redirect).toHaveBeenCalledWith("/onboarding");
  });
});
