import { describe, expect, it } from "vitest";

import { prefillLoads, prefillWeights } from "@/server/workouts";

describe("previous-performance weight prefilling", () => {
  it("matches the previous completed set number", () => {
    expect(prefillWeights(3, [{ setNumber: 1, weightKg: 20 }, { setNumber: 2, weightKg: 22.5 }, { setNumber: 3, weightKg: 25 }])).toEqual([20, 22.5, 25]);
  });

  it("falls back to the last completed non-blank weight", () => {
    expect(prefillWeights(4, [{ setNumber: 1, weightKg: 20 }, { setNumber: 2, weightKg: null }, { setNumber: 3, weightKg: 25 }])).toEqual([20, 25, 25, 25]);
  });

  it("keeps all weights blank when no history exists", () => {
    expect(prefillWeights(3, [])).toEqual([null, null, null]);
  });
});

describe("typed previous-performance load prefilling", () => {
  it("prefills only the compatible load series selected by the caller", () => {
    expect(prefillLoads(3, [{ setNumber: 1, loadValue: 8 }, { setNumber: 2, loadValue: 9 }])).toEqual([8, 9, 9]);
    expect(prefillLoads(3, [])).toEqual([null, null, null]);
  });
});
