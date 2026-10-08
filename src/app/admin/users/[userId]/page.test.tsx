import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Profile from "./page";
import { requireCurrentUser } from "@/server/auth";
const mocks = vi.hoisted(() => ({ user: vi.fn(), profile: vi.fn(), programme: vi.fn(), progress: vi.fn() }));
vi.mock("@/server/auth", async (original) => ({ ...await original<typeof import("@/server/auth")>(), requireCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => ({ user: { findUnique: mocks.user }, onboardingProfile: { findUnique: mocks.profile } }) }));
vi.mock("@/server/active-programme", () => ({ getActiveProgramme: mocks.programme }));
vi.mock("@/server/progress-dashboard", () => ({ getProgressDashboard: mocks.progress }));
const id = "10000000-0000-4000-8000-000000000001";
beforeEach(() => { vi.clearAllMocks(); });
it("blocks USER before reading any selected account data", async () => {
  vi.mocked(requireCurrentUser).mockResolvedValue({ id: "normal", role: "USER", email: "normal@example.com" });
  await expect(Profile({ params: Promise.resolve({ userId: id }), searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/");
  expect(mocks.user).not.toHaveBeenCalled();
});
it("renders an ADMIN profile with target-scoped brief, progress and navigation", async () => {
  vi.mocked(requireCurrentUser).mockResolvedValue({ id: "admin", role: "ADMIN", email: "admin@example.com" });
  mocks.user.mockResolvedValue({ id, email: "selected@example.com", role: "USER", status: "ACTIVE" });
  mocks.profile.mockResolvedValue(null); mocks.programme.mockResolvedValue(null);
  mocks.progress.mockResolvedValue({ totals: { workouts: 2, sets: 12, minutes: 80 }, consistency: { completed: 1, target: 3 } });
  render(await Profile({ params: Promise.resolve({ userId: id }), searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("heading", { name: "selected@example.com" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "History" })).toHaveAttribute("href", `/admin/users/${id}?tab=history`);
  expect(mocks.profile).toHaveBeenCalledWith({ where: { userId: id } });
  expect(mocks.programme).toHaveBeenCalledWith(expect.anything(), id);
  expect(mocks.progress).toHaveBeenCalledWith(expect.anything(), id, "month");
});
