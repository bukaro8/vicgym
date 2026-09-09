import { z } from "zod";

export const onboardingPaths = ["SEMI_PERSONALISED", "FULLY_PERSONALISED"] as const;
export const trainingGoals = ["LOSE_FAT", "BUILD_MUSCLE", "GENERAL_FITNESS"] as const;
export const trainingExperiences = ["BEGINNER", "SOME_EXPERIENCE", "EXPERIENCED"] as const;
export const cardioPreferences = ["MINIMAL", "SOME", "ENJOYS_CARDIO"] as const;
export const limitationAreas = ["UPPER_BODY", "LOWER_BODY", "BACK", "CORE", "OTHER"] as const;

export const onboardingPathSchema = z.object({ path: z.enum(onboardingPaths) }).strict();

export const semiPersonalisedSchema = z.object({
  goal: z.enum(trainingGoals),
  trainingDaysPerWeek: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  experience: z.enum(trainingExperiences),
  sessionLengthMinutes: z.union([z.literal(45), z.literal(60), z.literal(90), z.literal(120)]),
  cardioPreference: z.enum(cardioPreferences),
  hasLimitations: z.boolean(),
  limitationAreas: z.array(z.enum(limitationAreas)).max(5).default([]),
  limitationsText: z.string().trim().max(1000).optional().default(""),
}).strict().superRefine((value, context) => {
  if (value.hasLimitations && !value.limitationsText) context.addIssue({ code: "custom", path: ["limitationsText"], message: "Briefly describe the limitation for coach review" });
  if (!value.hasLimitations && (value.limitationsText || value.limitationAreas.length)) context.addIssue({ code: "custom", path: ["hasLimitations"], message: "Limitation details require limitations to be selected" });
});

export const fullyPersonalisedSchema = z.object({
  goal: z.enum(trainingGoals),
  trainingDaysPerWeek: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  experience: z.enum(trainingExperiences),
  sessionLengthMinutes: z.union([z.literal(45), z.literal(60), z.literal(90), z.literal(120)]),
  cardioPreference: z.enum(cardioPreferences),
  trainingPreferences: z.string().trim().min(1).max(2000),
  hasLimitations: z.boolean(),
  limitationsText: z.string().trim().max(2000).optional().default(""),
  personalPriorities: z.string().trim().min(1).max(2000),
  additionalNotes: z.string().trim().max(2000).optional().default(""),
}).strict().superRefine((value, context) => {
  if (value.hasLimitations && !value.limitationsText) context.addIssue({ code: "custom", path: ["limitationsText"], message: "Briefly describe injuries, pain, or movement limitations for coach review" });
  if (!value.hasLimitations && value.limitationsText) context.addIssue({ code: "custom", path: ["hasLimitations"], message: "Limitation details require Yes to be selected" });
});

export type SemiPersonalisedInput = z.infer<typeof semiPersonalisedSchema>;
export type FullyPersonalisedInput = z.infer<typeof fullyPersonalisedSchema>;
export type OnboardingMode = "NEEDS_ONBOARDING" | "FULLY_PERSONALISED_FORM" | "FULLY_PERSONALISED_PENDING" | "READY";
