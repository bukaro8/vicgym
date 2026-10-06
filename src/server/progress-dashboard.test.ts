import { expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { getProgressDashboard } from "./progress-dashboard";

it("scopes analytics and weekly goal to the signed-in owner, filtering completed sets", async () => {
  const db = { workoutSession: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(3) }, onboardingProfile: { findUnique: vi.fn().mockResolvedValue({ trainingDaysPerWeek: 4 }) } };
  const result = await getProgressDashboard(db as unknown as PrismaClient, "owner", "month", new Date("2026-10-07T12:00:00Z"));
  expect(db.workoutSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner", status: "COMPLETED" }), select: expect.objectContaining({ exerciseSessions: { select: expect.objectContaining({ setLogs: expect.objectContaining({ where: { completedAt: { not: null } } }) }) } }) }));
  expect(db.workoutSession.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner", status: "COMPLETED" }) }));
  expect(db.onboardingProfile.findUnique).toHaveBeenCalledWith({ where: { userId: "owner" }, select: { trainingDaysPerWeek: true } });
  expect(result.consistency).toEqual({ completed: 3, target: 4 });
});
