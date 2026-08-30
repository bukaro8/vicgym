import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("Phase 2 app shell", () => {
  it("renders current navigation without later-phase screens", () => {
    render(<AppShell><main><h1>Catalogue ready</h1></main></AppShell>);

    expect(screen.getByRole("heading", { name: "Catalogue ready" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Exercises" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Progress" })).not.toBeInTheDocument();
  });
});
