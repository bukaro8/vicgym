import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import MorePage from "./page";
vi.mock("@/server/auth", () => ({ requireCurrentUser: async () => ({ id: "user", role: "USER", email: "user@example.com" }) }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/timer-alert-settings", () => ({ TimerAlertSettings: () => null }));
vi.mock("@/components/logout-button", () => ({ LogoutButton: () => null }));
it("removes report generation from the normal user's More page", async () => {
  render(await MorePage());
  expect(screen.queryByRole("link", { name: /Coach review/i })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Offline & synchronization/ })).toBeInTheDocument();
});
