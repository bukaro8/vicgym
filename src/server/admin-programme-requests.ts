import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { applyCoachImportInTransaction, parseCoachImport, previewCoachImport } from "@/server/coach-import";

export class ProgrammeRequestError extends Error {}

export async function listProgrammeRequests(prisma: PrismaClient) {
  return prisma.programmeRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { user: { select: { email: true } } } });
}

export async function getProgrammeRequest(prisma: PrismaClient, requestId: string) {
  return prisma.programmeRequest.findUnique({ where: { id: requestId }, include: { user: { select: { id: true, email: true, onboardingProfile: true } } } });
}

function label(value: string | null | undefined) { return value ? value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()) : "Not provided"; }

export async function buildCoachBrief(prisma: PrismaClient, requestId: string) {
  const request = await getProgrammeRequest(prisma, requestId);
  if (!request) throw new ProgrammeRequestError("Programme request not found");
  const profile = request.user.onboardingProfile;
  const exercises = await prisma.exercise.findMany({ where: { active: true, OR: [{ equipmentId: null }, { equipment: { available: true } }] }, orderBy: { slug: "asc" }, include: { equipment: { select: { name: true } } } });
  const lines = ["# VicGym personalised programme coach brief", "", `User: ${request.user.email}`, `Request status: ${request.status}`, `Submitted: ${request.createdAt.toISOString()}`, "", "## COACH BRIEF", "", `Goal: ${label(profile?.goal)}`, `Training frequency: ${profile?.trainingDaysPerWeek ?? "Not provided"} days per week`, `Session length: ${profile?.sessionLengthMinutes ?? "Not provided"} minutes`, `Experience: ${label(profile?.experience)}`, `Cardio preference: ${label(profile?.cardioPreference)}`, `Training preferences: ${profile?.trainingPreferences ?? "Not provided"}`, `Limitations: ${profile?.hasLimitations ? profile.limitationsText || "Reported; no details provided" : "None reported"}`, `Personal priorities: ${profile?.personalPriorities ?? "Not provided"}`, `Additional notes: ${profile?.additionalNotes ?? "None"}`, "", "## VALID VICGYM EXERCISES", "", ...exercises.map((exercise) => `- ${exercise.name} [${exercise.slug}] — ${exercise.equipment?.name ?? "Bodyweight / no equipment"}`), "", "## VICGYM PROGRAMME JSON", "", "Return one schemaVersion 2 create-programme JSON object. Use only exercise slugs listed above. Each exercise requires sets, targetReps, load, restSeconds, autoRest and position. Use typed loads: {\"type\":\"kg\",\"value\":10}, {\"type\":\"machineLevel\",\"value\":8}, or null. The server assigns version 1. Do not invent catalogue exercises.", "", "```json", JSON.stringify({ schemaVersion: 2, operation: "create-programme", program: { slug: "programme-slug", name: "Programme name" }, days: [{ slug: "upper-a", name: "Upper A", rotationOrder: 1, exercises: [] }] }, null, 2), "```"];
  return { request, exercises, markdown: lines.join("\n") };
}

async function pendingOwner(db: PrismaClient | Prisma.TransactionClient, requestId: string) {
  const request = await db.programmeRequest.findFirst({ where: { id: requestId, status: "PENDING" }, select: { id: true, userId: true } });
  if (!request) throw new ProgrammeRequestError("Pending programme request not found or already processed");
  return request;
}

export async function previewRequestProgramme(prisma: PrismaClient, requestId: string, raw: string) {
  const request = await pendingOwner(prisma, requestId);
  if (parseCoachImport(raw).schemaVersion !== 2) throw new ProgrammeRequestError("An initial programme request requires schemaVersion 2 create-programme JSON");
  return previewCoachImport(prisma, request.userId, raw, { personalisedRequestId: request.id });
}

export async function applyRequestProgramme(prisma: PrismaClient, requestId: string, raw: string) {
  if (parseCoachImport(raw).schemaVersion !== 2) throw new ProgrammeRequestError("An initial programme request requires schemaVersion 2 create-programme JSON");
  return prisma.$transaction(async (tx) => {
    const request = await pendingOwner(tx, requestId);
    const claimed = await tx.programmeRequest.updateMany({ where: { id: request.id, status: "PENDING" }, data: { status: "COMPLETED", completedAt: new Date() } });
    if (claimed.count !== 1) throw new ProgrammeRequestError("Programme request was already processed");
    const result = await applyCoachImportInTransaction(tx, request.userId, raw, { personalisedRequestId: request.id });
    return { ...result, ownerId: request.userId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelProgrammeRequest(prisma: PrismaClient, requestId: string) {
  const result = await prisma.programmeRequest.updateMany({ where: { id: requestId, status: "PENDING" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  if (result.count !== 1) throw new ProgrammeRequestError("Pending programme request not found or already processed");
}
