import { describe, expect, it, vi } from "vitest";

import { chooseOnboardingPath, resolveOnboardingMode, submitFullyPersonalisedOnboarding } from "@/server/onboarding";

describe("onboarding state", () => {
  it("routes users with active programmes to the app and pending requests to their state", () => {
    expect(resolveOnboardingMode({ activeProgramId: "program-1", path: null, requestStatus: null })).toBe("READY");
    expect(resolveOnboardingMode({ activeProgramId: null, path: "FULLY_PERSONALISED", requestStatus: "PENDING" })).toBe("FULLY_PERSONALISED_PENDING");
    expect(resolveOnboardingMode({ activeProgramId: null, path: "FULLY_PERSONALISED", requestStatus: null })).toBe("FULLY_PERSONALISED_FORM");
    expect(resolveOnboardingMode({ activeProgramId: null, path: null, requestStatus: null })).toBe("NEEDS_ONBOARDING");
  });

  it("stores the fully personalised path without prematurely creating a request", async () => {
    const tx = {
      appSettings: { upsert: vi.fn().mockResolvedValue({ activeProgramId: null }), update: vi.fn() },
      onboardingProfile: { upsert: vi.fn() },
      programmeRequest: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "request-1" }) },
      workoutProgram: { create: vi.fn() },
    };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    await expect(chooseOnboardingPath(prisma as never, "user-1", "FULLY_PERSONALISED")).resolves.toEqual({ path: "FULLY_PERSONALISED", requestId: null });
    expect(tx.programmeRequest.create).not.toHaveBeenCalled();
    expect(tx.onboardingProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
    expect(tx.workoutProgram.create).not.toHaveBeenCalled();
  });

  it("saves the authenticated user's coach brief and then creates a pending request", async () => {
    const tx = { appSettings: { findUnique: vi.fn().mockResolvedValue({ activeProgramId: null }), update: vi.fn() }, onboardingProfile: { upsert: vi.fn() }, programmeRequest: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "request-1", status: "PENDING" }) } };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    const answers = { goal: "BUILD_MUSCLE", trainingDaysPerWeek: 4, experience: "SOME_EXPERIENCE", sessionLengthMinutes: 60, cardioPreference: "SOME", trainingPreferences: "Machines and free weights", hasLimitations: true, limitationsText: "Coach should review knee discomfort", personalPriorities: "Consistency", additionalNotes: "Morning training" } as const;
    await expect(submitFullyPersonalisedOnboarding(prisma as never, "owner-1", answers)).resolves.toEqual({ id: "request-1", status: "PENDING" });
    expect(tx.onboardingProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner-1" }, update: expect.objectContaining({ trainingPreferences: answers.trainingPreferences, personalPriorities: answers.personalPriorities, limitationReviewRequired: true }) }));
    expect(tx.programmeRequest.create).toHaveBeenCalledWith({ data: { userId: "owner-1" }, select: { id: true, status: true } });
  });
});
