import { describe, expect, it } from "vitest";

import { compatibleLoadSemantics, formatLoad, loadInputLabel } from "@/lib/load-tracking";

describe("typed load presentation", () => {
  it("renders Chest Press selector level 8 as L8 and never kilograms", () => {
    expect(formatLoad("MACHINE_LEVEL", "STACK_TOTAL", 8)).toBe("L8");
    expect(formatLoad("MACHINE_LEVEL", "STACK_TOTAL", 8)).not.toContain("kg");
    expect(loadInputLabel("MACHINE_LEVEL", "STACK_TOTAL")).toBe("Machine level");
  });

  it("renders one-arm dumbbell row as kilograms per dumbbell", () => {
    expect(formatLoad("KILOGRAM", "PER_DUMBBELL", 10)).toBe("10 kg per dumbbell");
    expect(loadInputLabel("KILOGRAM", "PER_DUMBBELL")).toBe("Weight per dumbbell (kg)");
  });

  it("requires both load type and entry mode for compatible prefilling", () => {
    expect(compatibleLoadSemantics("MACHINE_LEVEL", "STACK_TOTAL", "MACHINE_LEVEL", "STACK_TOTAL")).toBe(true);
    expect(compatibleLoadSemantics(null, null, "MACHINE_LEVEL", "STACK_TOTAL")).toBe(false);
    expect(compatibleLoadSemantics("KILOGRAM", "STACK_TOTAL", "MACHINE_LEVEL", "STACK_TOTAL")).toBe(false);
  });
});
