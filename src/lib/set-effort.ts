import { z } from "zod";

export const effortValues = ["EASY", "MODERATE", "HARD"] as const;
export const setEffortSchema = z.enum(effortValues).nullable().optional();
export type SetEffortValue = typeof effortValues[number];
export const effortLabel: Record<SetEffortValue, string> = { EASY: "Easy", MODERATE: "Moderate", HARD: "Hard" };
