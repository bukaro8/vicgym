import { Prisma, ProgramVersionSource, type PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";

import { getActiveProgramme, setActiveProgramme } from "@/server/active-programme";
import { formatLoad, jsonLoadType, type LoadEntryModeValue, type LoadTrackingTypeValue, type TypedLoad } from "@/lib/load-tracking";

type Db = PrismaClient | Prisma.TransactionClient;
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be a lowercase slug");
const typedLoadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("kg"), value: z.number().min(0).max(9_999) }).strict(),
  z.object({ type: z.literal("machineLevel"), value: z.number().int().min(0).max(9_999) }).strict(),
]);
const configuredExerciseSchema = z.object({
  exercise: slugSchema,
  sets: z.number().int().min(1).max(20),
  targetReps: z.number().int().min(1).max(100),
  load: typedLoadSchema.nullable().optional(),
  weightKg: z.number().min(0).max(9_999).nullable().optional(),
  restSeconds: z.number().int().min(0).max(3_600),
  autoRest: z.boolean(),
  position: z.number().int().min(1).max(50),
}).strict().superRefine((value, context) => {
  if (value.load !== undefined && value.weightKg !== undefined) context.addIssue({ code: "custom", message: "Use load or weightKg, never both." });
  if (value.load === undefined && value.weightKg === undefined) context.addIssue({ code: "custom", message: "Provide load (use null when no external load is planned)." });
});

const changeSchema = z.object({
  action: z.enum(["upsert", "remove"]).optional(),
  day: slugSchema,
  exercise: slugSchema,
  sets: z.number().int().min(1).max(20).optional(),
  targetReps: z.number().int().min(1).max(100).optional(),
  load: typedLoadSchema.nullable().optional(),
  weightKg: z.number().min(0).max(9_999).nullable().optional(),
  restSeconds: z.number().int().min(0).max(3_600).optional(),
  autoRest: z.boolean().optional(),
  position: z.number().int().min(1).max(50).optional(),
}).strict().superRefine((value, context) => {
  if (value.load !== undefined && value.weightKg !== undefined) context.addIssue({ code: "custom", message: "Use load or weightKg, never both." });
});

const patchSchema = z.object({
  schemaVersion: z.literal(1),
  program: slugSchema,
  baseVersion: z.number().int().positive(),
  changes: z.array(changeSchema).min(1).max(100),
}).strict();

const creationDaySchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(120),
  rotationOrder: z.number().int().min(1).max(20),
  exercises: z.array(configuredExerciseSchema).max(50),
}).strict().superRefine((day, context) => {
  const exercises = new Set<string>();
  const positions = new Set<number>();
  day.exercises.forEach((exercise, index) => {
    if (exercises.has(exercise.exercise)) context.addIssue({ code: "custom", path: ["exercises", index, "exercise"], message: `Duplicate exercise ${exercise.exercise} in ${day.slug}` });
    if (positions.has(exercise.position)) context.addIssue({ code: "custom", path: ["exercises", index, "position"], message: `Duplicate position ${exercise.position} in ${day.slug}` });
    exercises.add(exercise.exercise);
    positions.add(exercise.position);
  });
});

const creationSchema = z.object({
  schemaVersion: z.literal(2),
  operation: z.literal("create-programme"),
  program: z.object({ slug: slugSchema, name: z.string().trim().min(1).max(120) }).strict(),
  days: z.array(creationDaySchema).min(1).max(20),
}).strict().superRefine((input, context) => {
  const slugs = new Set<string>();
  const rotations = new Set<number>();
  let exerciseCount = 0;
  input.days.forEach((day, index) => {
    if (slugs.has(day.slug)) context.addIssue({ code: "custom", path: ["days", index, "slug"], message: `Duplicate workout day ${day.slug}` });
    if (rotations.has(day.rotationOrder)) context.addIssue({ code: "custom", path: ["days", index, "rotationOrder"], message: `Duplicate rotation order ${day.rotationOrder}` });
    slugs.add(day.slug);
    rotations.add(day.rotationOrder);
    exerciseCount += day.exercises.length;
  });
  if (exerciseCount === 0) context.addIssue({ code: "custom", path: ["days"], message: "A programme must contain at least one exercise" });
});

const importSchema = z.discriminatedUnion("schemaVersion", [patchSchema, creationSchema]);
export type CoachPatchImport = z.infer<typeof patchSchema>;
export type CoachCreationImport = z.infer<typeof creationSchema>;
export type CoachImport = z.infer<typeof importSchema>;
export type PreviewItem = { kind: "changed" | "added" | "removed" | "reordered"; day: string; exercise: string; details: string[] };
export type ImportPreview = {
  kind: "patch" | "create";
  program: string;
  programName: string;
  baseVersion: number | null;
  nextVersion: number;
  days: Array<{ slug: string; name: string; rotationOrder: number; exerciseCount: number }>;
  changes: PreviewItem[];
  changed: PreviewItem[];
  added: PreviewItem[];
  removed: PreviewItem[];
  reordered: PreviewItem[];
};

type PlannedExercise = { exerciseId: string; slug: string; name: string; sets: number; targetReps: number; loadTrackingType: LoadTrackingTypeValue | null; loadEntryMode: LoadEntryModeValue | null; loadValue: number | null; legacyWeightKg: number | null; restSeconds: number; autoRest: boolean; position: number };
type PlannedDay = { slug: string; name: string; rotationOrder: number; exercises: PlannedExercise[] };
type ResolvedPatch = { kind: "patch"; programId: string; baseVersion: number; days: PlannedDay[]; preview: ImportPreview };
type ResolvedCreation = { kind: "create"; input: CoachCreationImport; days: PlannedDay[]; preview: ImportPreview };

function error(message: string): never { throw new Error(message); }
function hasConfiguration(change: CoachPatchImport["changes"][number]) { return change.sets !== undefined || change.targetReps !== undefined || change.load !== undefined || change.weightKg !== undefined || change.restSeconds !== undefined || change.autoRest !== undefined || change.position !== undefined; }
function buildPreview(program: string, programName: string, kind: "patch" | "create", baseVersion: number | null, nextVersion: number, days: PlannedDay[], items: PreviewItem[]): ImportPreview {
  return { kind, program, programName, baseVersion, nextVersion, days: days.map((day) => ({ slug: day.slug, name: day.name, rotationOrder: day.rotationOrder, exerciseCount: day.exercises.length })), changes: items, changed: items.filter((item) => item.kind === "changed"), added: items.filter((item) => item.kind === "added"), removed: items.filter((item) => item.kind === "removed"), reordered: items.filter((item) => item.kind === "reordered") };
}

export function parseCoachImport(raw: string): CoachImport {
  let decoded: unknown;
  try { decoded = JSON.parse(raw); } catch { error("Invalid JSON. Paste a complete JSON object."); }
  const parsed = importSchema.safeParse(decoded);
  if (!parsed.success) error(parsed.error.issues.map((issue) => `${issue.path.join(".") || "JSON"}: ${issue.message}`).join("; "));
  if (parsed.data.schemaVersion === 1) {
    const seen = new Set<string>();
    for (const item of parsed.data.changes) {
      const key = `${item.day}:${item.exercise}`;
      if (seen.has(key)) error(`Duplicate or conflicting change for ${item.exercise} in ${item.day}.`);
      seen.add(key);
      if (item.action === "remove" && hasConfiguration(item)) error(`Remove change for ${item.exercise} in ${item.day} cannot include programme values.`);
    }
  }
  return parsed.data;
}

async function catalogueBySlug(db: Db, slugs: string[]) {
  const unique = [...new Set(slugs)];
  const catalogue = await db.exercise.findMany({ where: { slug: { in: unique }, active: true }, include: { equipment: true } });
  const available = new Map(catalogue.filter((exercise) => !exercise.equipmentId || exercise.equipment?.available).map((exercise) => [exercise.slug, exercise]));
  const unknown = unique.filter((slug) => !available.has(slug));
  if (unknown.length) error(`Unknown or unavailable verified VicGym exercise: ${unknown.join(", ")}.`);
  return available;
}

export function validateImportedLoad(
  item: { load?: TypedLoad | null; weightKg?: number | null },
  exercise: { slug: string; loadTrackingType: string; loadEntryMode: string },
): { loadTrackingType: LoadTrackingTypeValue; loadEntryMode: LoadEntryModeValue; loadValue: number | null; legacyWeightKg: null } {
  const trackingType = exercise.loadTrackingType as LoadTrackingTypeValue;
  const entryMode = exercise.loadEntryMode as LoadEntryModeValue;
  if (item.load !== undefined && item.weightKg !== undefined) error(`Use load or weightKg for ${exercise.slug}, never both.`);
  if (item.weightKg !== undefined) {
    if (trackingType !== "KILOGRAM") error(`weightKg is only valid for kilogram exercises; ${exercise.slug} uses ${trackingType}.`);
    return { loadTrackingType: trackingType, loadEntryMode: entryMode, loadValue: item.weightKg, legacyWeightKg: null };
  }
  if (item.load == null) {
    if (item.load === null && (trackingType === "KILOGRAM" || trackingType === "MACHINE_LEVEL")) {
      return { loadTrackingType: trackingType, loadEntryMode: entryMode, loadValue: null, legacyWeightKg: null };
    }
    return { loadTrackingType: trackingType, loadEntryMode: entryMode, loadValue: null, legacyWeightKg: null };
  }
  const expected = jsonLoadType(trackingType);
  if (expected === null || item.load.type !== expected) error(`${exercise.slug} requires ${expected ?? "no external load"}; received ${item.load.type}.`);
  return { loadTrackingType: trackingType, loadEntryMode: entryMode, loadValue: item.load.value, legacyWeightKg: null };
}

function plannedLoadText(exercise: PlannedExercise): string {
  return formatLoad(exercise.loadTrackingType, exercise.loadEntryMode, exercise.loadValue, { blank: "load blank", legacyWeightKg: exercise.legacyWeightKg });
}

async function resolveCreation(db: Db, input: CoachCreationImport): Promise<ResolvedCreation> {
  if (await db.workoutProgram.findUnique({ where: { slug: input.program.slug }, select: { id: true } })) error(`Programme ${input.program.slug} already exists.`);
  const existingReal = await db.workoutProgram.findFirst({ where: { isDemo: false }, select: { slug: true } });
  if (existingReal) error(`A real programme already exists: ${existingReal.slug}. Initial programme creation is only available once.`);
  const active = await getActiveProgramme(db);
  if (active && !active.isDemo) error(`A real programme is already active: ${active.slug}. Initial programme creation is only available once.`);
  const exercises = await catalogueBySlug(db, input.days.flatMap((day) => day.exercises.map((exercise) => exercise.exercise)));
  const days: PlannedDay[] = input.days.map((day) => ({
    slug: day.slug,
    name: day.name,
    rotationOrder: day.rotationOrder,
    exercises: day.exercises.map((item) => {
      const exercise = exercises.get(item.exercise)!;
      return { exerciseId: exercise.id, slug: exercise.slug, name: exercise.name, sets: item.sets, targetReps: item.targetReps, ...validateImportedLoad(item, exercise), restSeconds: item.restSeconds, autoRest: item.autoRest, position: item.position };
    }).sort((a, b) => a.position - b.position),
  })).sort((a, b) => a.rotationOrder - b.rotationOrder);
  const items = days.flatMap((day) => day.exercises.map((exercise) => ({ kind: "added" as const, day: day.name, exercise: exercise.name, details: [`Add to ${day.name} at position ${exercise.position}: ${exercise.sets} sets × ${exercise.targetReps} reps, ${plannedLoadText(exercise)}, ${exercise.restSeconds} sec rest, auto rest ${exercise.autoRest ? "on" : "off"}.`] })));
  return { kind: "create", input, days, preview: buildPreview(input.program.slug, input.program.name, "create", null, 1, days, items) };
}

async function resolvePatch(db: Db, input: CoachPatchImport): Promise<ResolvedPatch> {
  const program = await db.workoutProgram.findUnique({ where: { slug: input.program }, include: { activeVersion: { include: { days: { orderBy: { rotationOrder: "asc" }, include: { workoutExercises: { orderBy: { position: "asc" }, include: { exercise: true } } } } } } } });
  if (!program) error(`Unknown programme: ${input.program}.`);
  const active = await getActiveProgramme(db);
  if (!active || active.id !== program.id || !program.activeVersion || program.status !== "ACTIVE") error("Coach patches may only update the currently active programme.");
  if (program.activeVersion.versionNumber !== input.baseVersion) error(`This coach response is based on version ${input.baseVersion}, but the current programme is version ${program.activeVersion.versionNumber}. Generate a new report before applying changes.`);
  const days = new Map<string, PlannedDay>(program.activeVersion.days.map((day) => [day.slug, { slug: day.slug, name: day.name, rotationOrder: day.rotationOrder, exercises: day.workoutExercises.map((item) => {
    const hasTypedSnapshot = item.loadTrackingTypeSnapshot !== null && item.loadEntryModeSnapshot !== null;
    return {
      exerciseId: item.exerciseId,
      slug: item.exercise.slug,
      name: item.exercise.name,
      sets: item.sets,
      targetReps: item.targetReps,
      loadTrackingType: hasTypedSnapshot ? item.loadTrackingTypeSnapshot as LoadTrackingTypeValue : item.plannedWeightKg === null ? item.exercise.loadTrackingType as LoadTrackingTypeValue : null,
      loadEntryMode: hasTypedSnapshot ? item.loadEntryModeSnapshot as LoadEntryModeValue : item.plannedWeightKg === null ? item.exercise.loadEntryMode as LoadEntryModeValue : null,
      loadValue: item.plannedLoadValue === null ? null : Number(item.plannedLoadValue),
      legacyWeightKg: hasTypedSnapshot || item.plannedWeightKg === null ? null : Number(item.plannedWeightKg),
      restSeconds: item.restSeconds,
      autoRest: item.autoRest,
      position: item.position,
    };
  }) }]));
  const exercises = await catalogueBySlug(db, input.changes.map((change) => change.exercise));
  for (const change of input.changes) {
    const day = days.get(change.day);
    if (!day) error(`Unknown workout day: ${change.day}.`);
    const exercise = exercises.get(change.exercise)!;
    const existingIndex = day.exercises.findIndex((item) => item.slug === change.exercise);
    const action = change.action ?? "upsert";
    if (action === "remove") {
      if (existingIndex === -1) error(`${change.exercise} is not currently in ${change.day}, so it cannot be removed.`);
      day.exercises.splice(existingIndex, 1);
      continue;
    }
    if (existingIndex === -1) {
      if (change.sets === undefined || change.targetReps === undefined || change.restSeconds === undefined || change.autoRest === undefined || change.position === undefined) error(`Adding ${change.exercise} to ${change.day} requires sets, targetReps, restSeconds, autoRest, and position.`);
      day.exercises.push({ exerciseId: exercise.id, slug: exercise.slug, name: exercise.name, sets: change.sets, targetReps: change.targetReps, ...validateImportedLoad(change, exercise), restSeconds: change.restSeconds, autoRest: change.autoRest, position: change.position });
      continue;
    }
    if (!hasConfiguration(change)) error(`Upsert change for ${change.exercise} in ${change.day} has no values to change.`);
    const existing = day.exercises[existingIndex];
    const updatedLoad = change.load === undefined && change.weightKg === undefined
      ? { loadTrackingType: existing.loadTrackingType, loadEntryMode: existing.loadEntryMode, loadValue: existing.loadValue, legacyWeightKg: existing.legacyWeightKg }
      : validateImportedLoad(change, exercise);
    day.exercises[existingIndex] = { ...existing, sets: change.sets ?? existing.sets, targetReps: change.targetReps ?? existing.targetReps, ...updatedLoad, restSeconds: change.restSeconds ?? existing.restSeconds, autoRest: change.autoRest ?? existing.autoRest, position: change.position ?? existing.position };
  }
  for (const day of days.values()) {
    const positions = new Set<number>();
    for (const exercise of day.exercises) { if (positions.has(exercise.position)) error(`Duplicate final position ${exercise.position} in ${day.slug}. Reorder changes must leave unique positions.`); positions.add(exercise.position); }
    day.exercises.sort((a, b) => a.position - b.position);
  }
  const before = new Map(program.activeVersion.days.flatMap((day) => day.workoutExercises.map((item) => [`${day.slug}:${item.exercise.slug}`, item])));
  const items: PreviewItem[] = [];
  for (const day of days.values()) for (const finalExercise of day.exercises) {
    const previous = before.get(`${day.slug}:${finalExercise.slug}`);
    if (!previous) { items.push({ kind: "added", day: day.name, exercise: finalExercise.name, details: [`Added to ${day.name} at position ${finalExercise.position}.`] }); continue; }
    const changes: string[] = [];
    const priorHasTyped = previous.loadTrackingTypeSnapshot !== null && previous.loadEntryModeSnapshot !== null;
    const priorLoad = priorHasTyped
      ? formatLoad(previous.loadTrackingTypeSnapshot as LoadTrackingTypeValue, previous.loadEntryModeSnapshot as LoadEntryModeValue, previous.plannedLoadValue === null ? null : Number(previous.plannedLoadValue), { blank: "load blank" })
      : formatLoad(null, null, null, { blank: "load blank", legacyWeightKg: previous.plannedWeightKg === null ? null : Number(previous.plannedWeightKg) });
    const finalLoad = plannedLoadText(finalExercise);
    if (priorLoad !== finalLoad) changes.push(`Load: ${priorLoad} → ${finalLoad}`);
    if (previous.sets !== finalExercise.sets) changes.push(`Sets: ${previous.sets} → ${finalExercise.sets}`);
    if (previous.targetReps !== finalExercise.targetReps) changes.push(`Target reps: ${previous.targetReps} → ${finalExercise.targetReps}`);
    if (previous.restSeconds !== finalExercise.restSeconds) changes.push(`Rest: ${previous.restSeconds} sec → ${finalExercise.restSeconds} sec`);
    if (previous.autoRest !== finalExercise.autoRest) changes.push(`Auto rest: ${previous.autoRest ? "on" : "off"} → ${finalExercise.autoRest ? "on" : "off"}`);
    if (previous.position !== finalExercise.position) items.push({ kind: "reordered", day: day.name, exercise: finalExercise.name, details: [`Position: ${previous.position} → ${finalExercise.position}`] });
    if (changes.length) items.push({ kind: "changed", day: day.name, exercise: finalExercise.name, details: changes });
  }
  for (const [key, prior] of before) {
    const [daySlug] = key.split(":");
    if (!days.get(daySlug)?.exercises.some((exercise) => exercise.slug === prior.exercise.slug)) items.push({ kind: "removed", day: program.activeVersion.days.find((day) => day.slug === daySlug)?.name ?? daySlug, exercise: prior.exercise.name, details: [`Removed from ${daySlug}.`] });
  }
  if (!items.length) error("The import does not change the current programme.");
  const plannedDays = [...days.values()].sort((a, b) => a.rotationOrder - b.rotationOrder);
  return { kind: "patch", programId: program.id, baseVersion: program.activeVersion.versionNumber, days: plannedDays, preview: buildPreview(program.slug, program.name, "patch", input.baseVersion, input.baseVersion + 1, plannedDays, items) };
}

async function resolveImport(db: Db, input: CoachImport) { return input.schemaVersion === 2 ? resolveCreation(db, input) : resolvePatch(db, input); }
function versionData(days: PlannedDay[]) { return { days: { create: days.map((day) => ({ slug: day.slug, name: day.name, rotationOrder: day.rotationOrder, workoutExercises: { create: day.exercises.map((exercise) => ({ exerciseId: exercise.exerciseId, position: exercise.position, sets: exercise.sets, targetReps: exercise.targetReps, plannedWeightKg: exercise.legacyWeightKg, plannedLoadValue: exercise.loadValue, loadTrackingTypeSnapshot: exercise.loadTrackingType, loadEntryModeSnapshot: exercise.loadEntryMode, restSeconds: exercise.restSeconds, autoRest: exercise.autoRest })) } })) } }; }

export async function previewCoachImport(db: Db, raw: string): Promise<ImportPreview> { return (await resolveImport(db, parseCoachImport(raw))).preview; }

export async function applyCoachImport(prisma: PrismaClient, raw: string) {
  const input = parseCoachImport(raw);
  return prisma.$transaction(async (tx) => {
    const resolved = await resolveImport(tx, input);
    if (resolved.kind === "create") {
      const program = await tx.workoutProgram.create({ data: { slug: resolved.input.program.slug, name: resolved.input.program.name, status: "DRAFT", isDemo: false } });
      const version = await tx.programVersion.create({ data: { programId: program.id, versionNumber: 1, source: ProgramVersionSource.IMPORT, notes: "Initial programme created from validated JSON after explicit preview confirmation.", ...versionData(resolved.days) } });
      await setActiveProgramme(tx, program.id, version.id);
      return { kind: "create" as const, program: program.slug, versionNumber: 1, preview: resolved.preview };
    }
    const version = await tx.programVersion.create({ data: { programId: resolved.programId, versionNumber: resolved.baseVersion + 1, source: ProgramVersionSource.IMPORT, notes: "Validated coach JSON applied after explicit preview confirmation.", ...versionData(resolved.days) } });
    await setActiveProgramme(tx, resolved.programId, version.id);
    return { kind: "patch" as const, program: resolved.preview.program, versionNumber: version.versionNumber, preview: resolved.preview };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
