import { describe, expect, it } from "vitest";

import { parseCoachImport, validateImportedLoad } from "@/server/coach-import";

const valid = JSON.stringify({ schemaVersion: 1, program: "demo-four-day", baseVersion: 1, changes: [{ day: "demo-upper-a", exercise: "chest-press", sets: 3 }] });
const creation = JSON.stringify({ schemaVersion: 2, operation: "create-programme", program: { slug: "small-gym", name: "Small Gym Programme" }, days: [{ slug: "upper-a", name: "Upper A", rotationOrder: 1, exercises: [{ exercise: "chest-press", sets: 3, targetReps: 12, load: { type: "machineLevel", value: 8 }, restSeconds: 120, autoRest: true, position: 1 }] }] });

describe("coach JSON contract", () => {
  it("accepts a versioned upsert with explicit changes", () => expect(parseCoachImport(valid).program).toBe("demo-four-day"));
  it("rejects invalid JSON", () => expect(() => parseCoachImport("{" )).toThrow("Invalid JSON"));
  it("rejects duplicate changes", () => expect(() => parseCoachImport(JSON.stringify({ schemaVersion: 1, program: "demo-four-day", baseVersion: 1, changes: [{ day: "demo-upper-a", exercise: "chest-press", sets: 3 }, { day: "demo-upper-a", exercise: "chest-press", restSeconds: 90 }] }))).toThrow("Duplicate"));
  it("rejects programme values on removes", () => expect(() => parseCoachImport(JSON.stringify({ schemaVersion: 1, program: "demo-four-day", baseVersion: 1, changes: [{ action: "remove", day: "demo-upper-a", exercise: "chest-press", sets: 3 }] }))).toThrow("cannot include"));
  it("accepts initial programme creation without a client version number", () => {
    const parsed = parseCoachImport(creation);
    expect(parsed.schemaVersion).toBe(2);
    if (parsed.schemaVersion === 2) expect(parsed.program.slug).toBe("small-gym");
  });
  it("accepts the canonical typed load in both patch and creation documents", () => {
    expect(parseCoachImport(JSON.stringify({ schemaVersion: 1, program: "small-gym", baseVersion: 1, changes: [{ day: "upper-a", exercise: "chest-press", load: { type: "machineLevel", value: 9 } }] })).schemaVersion).toBe(1);
    expect(parseCoachImport(creation).schemaVersion).toBe(2);
  });
  it("rejects both load and weightKg in either schema version", () => {
    expect(() => parseCoachImport(JSON.stringify({ schemaVersion: 1, program: "small-gym", baseVersion: 1, changes: [{ day: "upper-a", exercise: "chest-press", load: { type: "machineLevel", value: 8 }, weightKg: 8 }] }))).toThrow("never both");
    expect(() => parseCoachImport(JSON.stringify({ schemaVersion: 2, operation: "create-programme", program: { slug: "small-gym", name: "Small Gym" }, days: [{ slug: "upper-a", name: "Upper A", rotationOrder: 1, exercises: [{ exercise: "chest-press", sets: 3, targetReps: 12, load: { type: "machineLevel", value: 8 }, weightKg: 8, restSeconds: 90, autoRest: true, position: 1 }] }] }))).toThrow("never both");
  });
  it("rejects incompatible catalogue load types and legacy weightKg for machines", () => {
    const chest = { slug: "chest-press", loadTrackingType: "MACHINE_LEVEL", loadEntryMode: "STACK_TOTAL" };
    expect(() => validateImportedLoad({ weightKg: 8 }, chest)).toThrow("only valid for kilogram exercises");
    expect(() => validateImportedLoad({ load: { type: "kg", value: 8 } }, chest)).toThrow("requires machineLevel");
    expect(validateImportedLoad({ load: { type: "machineLevel", value: 8 } }, chest).loadValue).toBe(8);
    const row = { slug: "one-arm-dumbbell-row", loadTrackingType: "KILOGRAM", loadEntryMode: "PER_DUMBBELL" };
    expect(validateImportedLoad({ weightKg: 10 }, row).loadValue).toBe(10);
  });
  it("rejects duplicate creation day slugs", () => expect(() => parseCoachImport(JSON.stringify({ schemaVersion: 2, operation: "create-programme", program: { slug: "small-gym", name: "Small Gym" }, days: [{ slug: "upper-a", name: "Upper A", rotationOrder: 1, exercises: [{ exercise: "push-up", sets: 3, targetReps: 12, weightKg: null, restSeconds: 90, autoRest: true, position: 1 }] }, { slug: "upper-a", name: "Again", rotationOrder: 2, exercises: [] }] }))).toThrow("Duplicate workout day"));
  it("rejects duplicate exercise positions in a creation day", () => expect(() => parseCoachImport(JSON.stringify({ schemaVersion: 2, operation: "create-programme", program: { slug: "small-gym", name: "Small Gym" }, days: [{ slug: "upper-a", name: "Upper A", rotationOrder: 1, exercises: [{ exercise: "push-up", sets: 3, targetReps: 12, weightKg: null, restSeconds: 90, autoRest: true, position: 1 }, { exercise: "chest-press", sets: 3, targetReps: 12, weightKg: null, restSeconds: 90, autoRest: true, position: 1 }] }] }))).toThrow("Duplicate position"));
  it("rejects a creation document with no exercises", () => expect(() => parseCoachImport(JSON.stringify({ schemaVersion: 2, operation: "create-programme", program: { slug: "small-gym", name: "Small Gym" }, days: [{ slug: "upper-a", name: "Upper A", rotationOrder: 1, exercises: [] }] }))).toThrow("at least one exercise"));
});
