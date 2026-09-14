import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), redirect: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireCurrentUser: mocks.currentUser }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  usePathname: () => "/admin/requests",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import AdminLayout from "@/app/admin/layout";

describe("administrator layout authorization", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); }); });

  it("renders administrator requests without normal user navigation", async () => {
    mocks.currentUser.mockResolvedValue({ id: "admin-1", email: "admin@example.com", role: "ADMIN" });
    render(await AdminLayout({ children: <main>Programme request list</main> }));
    expect(screen.getByText("Programme request list")).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Administrator navigation" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Workouts" })).not.toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("safely denies a normal user", async () => {
    mocks.currentUser.mockResolvedValue({ id: "user-1", email: "user@example.com", role: "USER" });
    await expect(AdminLayout({ children: <main>Secret admin data</main> })).rejects.toThrow("redirect:/");
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });
});
