import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { applyCoachImportInTransaction, parseCoachImport, previewCoachImport } from "@/server/coach-import";

export class ProgrammeRequestError extends Error {}
export const requestFilters = ["PENDING", "COMPLETED", "CANCELLED", "ALL"] as const;
export type RequestFilter = typeof requestFilters[number];

export function normalizeRequestFilter(value: string | string[] | undefined): RequestFilter { const candidate = Array.isArray(value) ? value[0] : value; return requestFilters.includes(candidate as RequestFilter) ? candidate as RequestFilter : "PENDING"; }
export function questionnaireLabel(value: string | null | undefined) { const labels: Record<string, string> = { PENDING: "Pending", COMPLETED: "Completed", CANCELLED: "Cancelled", LOSE_FAT: "Lose fat", BUILD_MUSCLE: "Build muscle", GENERAL_FITNESS: "Maintain / general fitness", BEGINNER: "Beginner", SOME_EXPERIENCE: "Some experience", EXPERIENCED: "Experienced", MINIMAL: "Minimal", SOME: "Some", ENJOYS_CARDIO: "I enjoy cardio", KILOGRAM: "Kilograms", MACHINE_LEVEL: "Machine level", BODYWEIGHT: "Bodyweight", REPS_ONLY: "Reps only", STACK_TOTAL: "Machine selector", TOTAL_LOAD: "Total load", PER_DUMBBELL: "Per dumbbell", NONE: "No load" }; return value ? labels[value] ?? value : "Not provided"; }

export async function listProgrammeRequests(prisma: PrismaClient, filter: RequestFilter = "PENDING") {
  const requests = await prisma.programmeRequest.findMany({ where: filter === "ALL" ? undefined : { status: filter }, orderBy: { createdAt: "desc" }, include: { user: { select: { email: true, onboardingProfile: { select: { goal: true, trainingDaysPerWeek: true, sessionLengthMinutes: true } } } } } });
  const order = { PENDING: 0, COMPLETED: 1, CANCELLED: 2 } as const;
  return requests.sort((a, b) => order[a.status] - order[b.status] || b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getProgrammeRequest(prisma: PrismaClient, requestId: string) {
  return prisma.programmeRequest.findUnique({ where: { id: requestId }, include: { user: { select: { id: true, email: true, onboardingProfile: true, settings: { select: { activeProgram: { select: { id: true, name: true, slug: true, activeVersion: { select: { versionNumber: true } } } } } } } } } });
}

export async function buildCoachBrief(prisma: PrismaClient, requestId: string) {
  const request = await getProgrammeRequest(prisma, requestId); if (!request) throw new ProgrammeRequestError("Programme request not found"); const profile = request.user.onboardingProfile;
  const exercises = await prisma.exercise.findMany({ where: { active: true, OR: [{ equipmentId: null }, { equipment: { available: true } }] }, orderBy: { slug: "asc" }, include: { equipment: { select: { name: true } } } });
  const frequency = profile?.trainingDaysPerWeek ? `${profile.trainingDaysPerWeek} days per week` : "Not provided"; const session = profile?.sessionLengthMinutes ? `${profile.sessionLengthMinutes} minutes` : "Not provided";
  const lines = ["# VicGym personalised programme coach brief", "", "## COACH BRIEF", "", `Goal: ${questionnaireLabel(profile?.goal)}`, `Training frequency: ${frequency}`, `Session length: ${session}`, `Experience: ${questionnaireLabel(profile?.experience)}`, `Cardio preference: ${questionnaireLabel(profile?.cardioPreference)}`, `Training preferences: ${profile?.trainingPreferences ?? "Not provided"}`, `Limitations: ${profile?.hasLimitations ? profile.limitationsText || "Reported; no details provided" : "None reported"}`, `Personal priorities: ${profile?.personalPriorities ?? "Not provided"}`, `Additional notes: ${profile?.additionalNotes ?? "None"}`, "", "## VALID VICGYM EXERCISES", "", ...exercises.map((exercise) => `- ${exercise.name} [${exercise.slug}] — ${exercise.equipment?.name ?? "Bodyweight / no equipment"}; tracking: ${questionnaireLabel(exercise.loadTrackingType)}; entry: ${questionnaireLabel(exercise.loadEntryMode)}`), "", "## VICGYM PROGRAMME JSON", "", "Return one schemaVersion 2 create-programme JSON object. Use only exercise slugs listed above. Every exercise requires sets, targetReps, load, restSeconds, autoRest and position. KILOGRAM exercises use {\"type\":\"kg\",\"value\":10}; MACHINE_LEVEL exercises use {\"type\":\"machineLevel\",\"value\":8}; BODYWEIGHT and REPS_ONLY exercises use null. Do not use legacy weightKg. The server assigns version 1. Do not invent catalogue exercises.", "", "```json", JSON.stringify({ schemaVersion: 2, operation: "create-programme", program: { slug: "programme-slug", name: "Programme name" }, days: [{ slug: "upper-a", name: "Upper A", rotationOrder: 1, exercises: [] }] }, null, 2), "```"];
  return { request, exercises, markdown: lines.join("\n") };
}

async function pendingOwner(db: PrismaClient | Prisma.TransactionClient, requestId: string) { const request = await db.programmeRequest.findFirst({ where: { id: requestId, status: "PENDING" }, select: { id: true, userId: true } }); if (!request) throw new ProgrammeRequestError("Pending programme request not found or already processed"); return request; }
export async function previewRequestProgramme(prisma: PrismaClient, requestId: string, raw: string) { const request = await pendingOwner(prisma, requestId); if (parseCoachImport(raw).schemaVersion !== 2) throw new ProgrammeRequestError("An initial programme request requires schemaVersion 2 create-programme JSON"); return previewCoachImport(prisma, request.userId, raw, { personalisedRequestId: request.id }); }
export async function applyRequestProgramme(prisma: PrismaClient, requestId: string, raw: string) { if (parseCoachImport(raw).schemaVersion !== 2) throw new ProgrammeRequestError("An initial programme request requires schemaVersion 2 create-programme JSON"); return prisma.$transaction(async (tx) => { const request = await pendingOwner(tx, requestId); const claimed = await tx.programmeRequest.updateMany({ where: { id: request.id, status: "PENDING" }, data: { status: "COMPLETED", completedAt: new Date() } }); if (claimed.count !== 1) throw new ProgrammeRequestError("Programme request was already processed"); const result = await applyCoachImportInTransaction(tx, request.userId, raw, { personalisedRequestId: request.id }); return { ...result, ownerId: request.userId }; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
export async function cancelProgrammeRequest(prisma: PrismaClient, requestId: string) { const result = await prisma.programmeRequest.updateMany({ where: { id: requestId, status: "PENDING" }, data: { status: "CANCELLED", cancelledAt: new Date() } }); if (result.count !== 1) throw new ProgrammeRequestError("Pending programme request not found or already processed"); }
