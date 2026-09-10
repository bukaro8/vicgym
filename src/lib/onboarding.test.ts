import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { fullyPersonalisedSchema, onboardingPathSchema, semiPersonalisedSchema } from "@/lib/onboarding";

const valid = { goal: "GENERAL_FITNESS", trainingDaysPerWeek: 3, experience: "SOME_EXPERIENCE", sessionLengthMinutes: 60, cardioPreference: "SOME", hasLimitations: false, limitationAreas: [], limitationsText: "" };

describe("onboarding inputs", () => {
  it("defines USER as the database default role", () => {
    expect(readFileSync("prisma/schema.prisma", "utf8")).toMatch(/role\s+UserRole\s+@default\(USER\)/);
  });
  it("does not accept client-supplied identity or role", () => {
    expect(onboardingPathSchema.safeParse({ path: "SEMI_PERSONALISED", role: "ADMIN" }).success).toBe(false);
    expect(semiPersonalisedSchema.safeParse({ ...valid, userId: "another-user" }).success).toBe(false);
  });

  it("requires free text when limitations are selected", () => {
    expect(semiPersonalisedSchema.safeParse({ ...valid, hasLimitations: true }).success).toBe(false);
    expect(semiPersonalisedSchema.safeParse({ ...valid, hasLimitations: true, limitationAreas: ["BACK"], limitationsText: "Movement restriction" }).success).toBe(true);
  });

  it("validates the complete fully personalised coach brief", () => {
    const brief = { goal: "BUILD_MUSCLE", trainingDaysPerWeek: 4, experience: "EXPERIENCED", sessionLengthMinutes: 90, cardioPreference: "SOME", age: 38, heightCm: 178, weightKg: 82.5, outsideGymActivity: "MODERATE", averageDailySteps: 7200, trainingPreferences: "Enjoy machines", hasLimitations: true, limitationsText: "For coach review", personalPriorities: "Consistency", additionalNotes: "" };
    expect(fullyPersonalisedSchema.safeParse(brief).success).toBe(true);
    expect(fullyPersonalisedSchema.safeParse({ ...brief, limitationsText: "" }).success).toBe(false);
    expect(fullyPersonalisedSchema.safeParse({ ...brief, userId: "other-user" }).success).toBe(false);
  });
  it("validates age, height, weight, activity level, and optional daily steps", () => {
    const brief = { goal: "GENERAL_FITNESS", trainingDaysPerWeek: 3, experience: "BEGINNER", sessionLengthMinutes: 60, cardioPreference: "SOME", age: 30, heightCm: 170, weightKg: 70.5, outsideGymActivity: "LOW", averageDailySteps: null, trainingPreferences: "no", hasLimitations: false, limitationsText: "", personalPriorities: "none", additionalNotes: "nope" };
    expect(fullyPersonalisedSchema.safeParse(brief).success).toBe(true);
    expect(fullyPersonalisedSchema.safeParse({ ...brief, age: 15 }).success).toBe(false);
    expect(fullyPersonalisedSchema.safeParse({ ...brief, age: 30.5 }).success).toBe(false);
    expect(fullyPersonalisedSchema.safeParse({ ...brief, heightCm: 251 }).success).toBe(false);
    expect(fullyPersonalisedSchema.safeParse({ ...brief, weightKg: 24 }).success).toBe(false);
    expect(fullyPersonalisedSchema.safeParse({ ...brief, outsideGymActivity: "EXTREME" }).success).toBe(false);
    expect(fullyPersonalisedSchema.safeParse({ ...brief, averageDailySteps: 8500 }).success).toBe(true);
    expect(fullyPersonalisedSchema.safeParse({ ...brief, averageDailySteps: -1 }).success).toBe(false);
  });
});
