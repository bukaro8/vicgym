import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminUserManagementList } from "@/components/admin-user-management-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const users = [
  { id: "admin-1", email: "admin@example.com", role: "ADMIN" as const, status: "ACTIVE" as const, onboardingState: "Ready" as const, activeProgrammeName: "Admin Plan" },
  { id: "user-1", email: "user@example.com", role: "USER" as const, status: "ACTIVE" as const, onboardingState: "Awaiting personalised programme" as const, activeProgrammeName: null },
];

describe("administrator user management list", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("renders account status and only exposes actions for non-admin users", () => {
    render(<AdminUserManagementList initialUsers={users} currentAdminId="admin-1"/>);
    expect(screen.getAllByText("Active")).toHaveLength(2);
    expect(screen.getByText("Protected administrator")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("deactivates and then offers reactivation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "user-1", status: "DISABLED" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminUserManagementList initialUsers={users} currentAdminId="admin-1"/>);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/user-1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "DISABLED" }) })));
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("requires a destructive confirmation dialog before deleting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "user-1", deleted: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminUserManagementList initialUsers={users} currentAdminId="admin-1"/>);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete user permanently?" })).toBeInTheDocument();
    expect(screen.getByText(/all of their programmes, workout history/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete user and data" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/user-1", expect.objectContaining({ method: "DELETE", body: JSON.stringify({ confirmation: "DELETE_USER" }) })));
    expect(screen.queryByText("user@example.com")).not.toBeInTheDocument();
  });
});
