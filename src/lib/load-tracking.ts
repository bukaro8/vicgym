export type LoadTrackingTypeValue = "KILOGRAM" | "MACHINE_LEVEL" | "BODYWEIGHT" | "REPS_ONLY";
export type LoadEntryModeValue = "STACK_TOTAL" | "TOTAL_LOAD" | "PER_DUMBBELL" | "BODYWEIGHT" | "NONE";

export type TypedLoad = { type: "kg" | "machineLevel"; value: number };

export function jsonLoadType(type: LoadTrackingTypeValue): TypedLoad["type"] | null {
  if (type === "KILOGRAM") return "kg";
  if (type === "MACHINE_LEVEL") return "machineLevel";
  return null;
}

export function formatLoad(
  type: LoadTrackingTypeValue | null,
  mode: LoadEntryModeValue | null,
  value: number | null,
  options: { blank?: string; legacyWeightKg?: number | null } = {},
): string {
  if (type === "MACHINE_LEVEL") return value === null ? (options.blank ?? "Level not set") : `L${value}`;
  if (type === "KILOGRAM") {
    if (value === null) return options.blank ?? "Weight not set";
    if (mode === "PER_DUMBBELL") return `${value} kg per dumbbell`;
    return `${value} kg`;
  }
  if (type === "BODYWEIGHT") return "Bodyweight";
  if (type === "REPS_ONLY") return "Reps only";
  if (options.legacyWeightKg != null) return `${options.legacyWeightKg} kg (legacy)`;
  return options.blank ?? "Load not set";
}

export function loadInputLabel(type: LoadTrackingTypeValue | null, mode: LoadEntryModeValue | null): string | null {
  if (type === "MACHINE_LEVEL") return "Machine level";
  if (type !== "KILOGRAM") return null;
  if (mode === "PER_DUMBBELL") return "Weight per dumbbell (kg)";
  if (mode === "TOTAL_LOAD") return "Total weight (kg)";
  return "Weight (kg)";
}

export function isExternalLoad(type: LoadTrackingTypeValue | null): boolean {
  return type === "KILOGRAM" || type === "MACHINE_LEVEL" || type === null;
}

export function compatibleLoadSemantics(
  leftType: LoadTrackingTypeValue | null,
  leftMode: LoadEntryModeValue | null,
  rightType: LoadTrackingTypeValue | null,
  rightMode: LoadEntryModeValue | null,
): boolean {
  return leftType !== null && leftType === rightType && leftMode !== null && leftMode === rightMode;
}
