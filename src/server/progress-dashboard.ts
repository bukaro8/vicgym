import type { PrismaClient } from "@/generated/prisma/client";
import { deriveDashboard, localDay, londonMidnight, monday, rangeStart, type DashboardRange } from "@/lib/progress-dashboard";

export async function getProgressDashboard(db: PrismaClient, userId: string, range: DashboardRange, now = new Date()) {
  const start = rangeStart(range, now);
  const weekStart = londonMidnight(monday(localDay(now)));
  const [sessions, profile, thisWeek] = await Promise.all([
    db.workoutSession.findMany({
      where: { userId, status: "COMPLETED", completedAt: { not: null, lte: now, ...(start ? { gte: londonMidnight(start) } : {}) } },
      select: { status: true, startedAt: true, completedAt: true, cardioStoppedAt: true, exerciseSessions: { select: { setLogs: { where: { completedAt: { not: null } }, select: { completedAt: true, actualReps: true } }, exercise: { select: { muscles: { select: { role: true, muscle: { select: { slug: true } } } } } } } } },
    }),
    db.onboardingProfile.findUnique({ where: { userId }, select: { trainingDaysPerWeek: true } }),
    db.workoutSession.count({ where: { userId, status: "COMPLETED", completedAt: { gte: weekStart, lte: now } } }),
  ]);
  return { ...deriveDashboard(sessions, range, now), consistency: { completed: thisWeek, target: profile?.trainingDaysPerWeek ?? null } };
}
