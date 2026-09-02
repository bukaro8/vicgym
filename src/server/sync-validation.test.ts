import { describe, expect, it } from "vitest";

import { validatedSyncLoad } from "@/server/sync";

describe("offline sync load compatibility", () => {
  it("recovers a pending legacy field using a typed machine session snapshot", () => {
    expect(validatedSyncLoad({ weightKg: 8 }, { loadTrackingTypeSnapshot: "MACHINE_LEVEL" })).toEqual({
      load: { weightKg: null, loadValue: 8, loadTrackingType: "MACHINE_LEVEL" },
      recoveredLegacyField: true,
    });
  });

  it("recovers kilograms without changing their unit", () => {
    expect(validatedSyncLoad({ weightKg: 10 }, { loadTrackingTypeSnapshot: "KILOGRAM" })).toEqual({
      load: { weightKg: null, loadValue: 10, loadTrackingType: "KILOGRAM" },
      recoveredLegacyField: true,
    });
  });

  it("keeps a historical legacy session in its legacy weight field", () => {
    expect(validatedSyncLoad({ weightKg: 30 }, { loadTrackingTypeSnapshot: null })).toEqual({
      load: { weightKg: 30, loadValue: null, loadTrackingType: null },
      recoveredLegacyField: false,
    });
  });

  it("rejects ambiguous or incompatible pending loads", () => {
    expect(() => validatedSyncLoad({ weightKg: 8, loadValue: 8 }, { loadTrackingTypeSnapshot: "MACHINE_LEVEL" })).toThrow("both weightKg and loadValue");
    expect(() => validatedSyncLoad({ weightKg: 5 }, { loadTrackingTypeSnapshot: "BODYWEIGHT" })).toThrow("does not accept an external load");
    expect(() => validatedSyncLoad({ loadValue: 8, loadTrackingType: "KILOGRAM" }, { loadTrackingTypeSnapshot: "MACHINE_LEVEL" })).toThrow("does not match session type");
    expect(() => validatedSyncLoad({ weightKg: 8.5 }, { loadTrackingTypeSnapshot: "MACHINE_LEVEL" })).toThrow("integer");
  });
});
