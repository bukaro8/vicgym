import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminRouteGate } from "@/components/admin-route-gate";

const navigation = vi.hoisted(() => ({ pathname: "/admin/requests", replace: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ replace: navigation.replace }) }));

describe("administrator route gate", () => {
  beforeEach(() => { navigation.pathname = "/admin/requests"; navigation.replace.mockClear(); });

  it("renders admin routes directly without an onboarding or redirect cycle", () => {
    render(<AdminRouteGate><main>Admin requests</main></AdminRouteGate>);
    expect(screen.getByText("Admin requests")).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.queryByText("Preparing onboarding…")).not.toBeInTheDocument();
  });

  it("blocks normal user-interface routes and redirects the administrator", async () => {
    navigation.pathname = "/workouts";
    render(<AdminRouteGate><main>Normal workouts UI</main></AdminRouteGate>);
    expect(screen.queryByText("Normal workouts UI")).not.toBeInTheDocument();
    expect(screen.getByText("Opening administrator tools…")).toBeInTheDocument();
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledTimes(1));
    expect(navigation.replace).toHaveBeenCalledWith("/admin/requests");
  });
});
