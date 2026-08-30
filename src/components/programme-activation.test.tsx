import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProgrammeActivation } from "@/components/programme-activation";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("ProgrammeActivation", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  it("requires an explicit demo acknowledgement", async () => {
    const user = userEvent.setup();
    render(<ProgrammeActivation slug="demo-four-day" version={1} active={false} />);

    await user.click(screen.getByRole("button", { name: "Review before activation" }));
    const activate = screen.getByRole("button", { name: "Activate demo programme" });
    expect(activate).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    expect(activate).toBeEnabled();
  });

  it("shows a stable confirmed state for an active demo", () => {
    render(<ProgrammeActivation slug="demo-four-day" version={1} active />);
    expect(screen.getByText("Demo programme confirmed")).toBeVisible();
    expect(screen.getByText(/workout logging is not available until Phase 3/i)).toBeVisible();
  });
});
