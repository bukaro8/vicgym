import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { FullyPersonalisedInput, OnboardingMode } from "@/lib/onboarding";
import { generateAndActivateStarterProgramme } from "@/server/starter-programme";
import type { SemiPersonalisedInput } from "@/lib/onboarding";

export class OnboardingConflictError extends Error {}

export function resolveOnboardingMode(input: { activeProgramId: string | null; path: string | null; requestStatus: string | null }): OnboardingMode {
  if (input.activeProgramId) return "READY";
  if (input.path === "FULLY_PERSONALISED" && input.requestStatus === "PENDING") return "FULLY_PERSONALISED_PENDING";
  if (input.path === "FULLY_PERSONALISED") return "FULLY_PERSONALISED_FORM";
  return "NEEDS_ONBOARDING";
}

export async function getOnboardingState(prisma: PrismaClient, userId: string) {
  const [settings, profile, request] = await Promise.all([
    prisma.appSettings.findUnique({ where: { userId }, select: { activeProgramId: true } }),
    prisma.onboardingProfile.findUnique({ where: { userId }, select: { path: true } }),
    prisma.programmeRequest.findFirst({ where: { userId, status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true, status: true } }),
  ]);
  const path = profile?.path ?? null;
  return { mode: resolveOnboardingMode({ activeProgramId: settings?.activeProgramId ?? null, path, requestStatus: request?.status ?? null }), path, requestId: request?.id ?? null };
}

export async function chooseOnboardingPath(prisma: PrismaClient, userId: string, path: "SEMI_PERSONALISED" | "FULLY_PERSONALISED") {
  return prisma.$transaction(async (tx) => {
    const settings = await tx.appSettings.upsert({ where: { userId }, create: { userId }, update: {}, select: { activeProgramId: true } });
    if (settings.activeProgramId) throw new OnboardingConflictError("Onboarding is already complete");
    await tx.onboardingProfile.upsert({
      where: { userId },
      create: { userId, path, limitationAreas: [], completedAt: null },
      update: { path, completedAt: null },
    });
    return { path, requestId: null };
  }, { isolationLevel: "Serializable" });
}

export async function submitFullyPersonalisedOnboarding(prisma: PrismaClient, userId: string, input: FullyPersonalisedInput) {
  return prisma.$transaction(async (tx) => {
    const settings = await tx.appSettings.findUnique({ where: { userId }, select: { activeProgramId: true } });
    if (settings?.activeProgramId) throw new OnboardingConflictError("Onboarding is already complete");
    const existing = await tx.programmeRequest.findFirst({ where: { userId, status: "PENDING" }, select: { id: true } });
    if (existing) throw new OnboardingConflictError("A personalised programme request is already pending");
    const profileData = { path: "FULLY_PERSONALISED" as const, goal: input.goal, trainingDaysPerWeek: input.trainingDaysPerWeek, experience: input.experience, sessionLengthMinutes: input.sessionLengthMinutes, cardioPreference: input.cardioPreference, age: input.age, heightCm: input.heightCm, weightKg: input.weightKg, outsideGymActivity: input.outsideGymActivity, averageDailySteps: input.averageDailySteps, trainingPreferences: input.trainingPreferences, hasLimitations: input.hasLimitations, limitationAreas: [] as [], limitationsText: input.limitationsText || null, limitationReviewRequired: input.hasLimitations, personalPriorities: input.personalPriorities, additionalNotes: input.additionalNotes || null, completedAt: new Date() };
    await tx.onboardingProfile.upsert({ where: { userId }, create: { userId, ...profileData }, update: profileData });
    const request = await tx.programmeRequest.create({ data: { userId }, select: { id: true, status: true } });
    await tx.appSettings.update({ where: { userId }, data: { onboardingCompleted: true } });
    return request;
  }, { isolationLevel: "Serializable" });
}

export async function completeSemiPersonalisedOnboarding(prisma: PrismaClient, userId: string, input: SemiPersonalisedInput) {
  return generateAndActivateStarterProgramme(prisma, userId, input);
}
