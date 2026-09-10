import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminShell, BackToRequestsLink } from "@/components/admin-shell";
import { AppShell } from "@/components/app-shell";

const navigation = vi.hoisted(() => ({ pathname: "/admin/requests" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

describe("administrator navigation", () => {
  it("replaces normal navigation on admin routes and indicates the active section", () => {
    navigation.pathname = "/admin/requests/request-1";
    render(<AdminShell><main>Request detail</main></AdminShell>);
    expect(screen.getAllByRole("navigation", { name: "Administrator navigation" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Programme Requests" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Workouts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Exercises" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Progress" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Logout" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Return to VicGym" })).toHaveAttribute("href", "/");
  });

  it("indicates the Users route and exposes the compact mobile destination", () => {
    navigation.pathname = "/admin/users";
    render(<AdminShell><main>Users directory</main></AdminShell>);
    expect(screen.getAllByRole("link", { name: "Users" })).toHaveLength(2);
    for (const link of screen.getAllByRole("link", { name: "Users" })) expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "VicGym" })).toHaveAttribute("href", "/");
  });

  it("keeps the normal VicGym navigation outside admin routes", () => {
    navigation.pathname = "/workouts";
    render(<AppShell><main>Normal app</main></AppShell>);
    expect(screen.getAllByRole("link", { name: "Workouts" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Programme Requests" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Administrator navigation" })).not.toBeInTheDocument();
  });

  it("links request details directly back to the request list", () => {
    render(<BackToRequestsLink/>);
    expect(screen.getByRole("link", { name: "Back to requests" })).toHaveAttribute("href", "/admin/requests");
  });
});
