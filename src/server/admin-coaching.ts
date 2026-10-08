import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { assertAdminUser, type AuthenticatedUser } from "@/server/auth";
import { getWeeklyReview } from "@/server/weekly-review";
import { previewCoachImport, applyCoachImportInTransaction } from "@/server/coach-import";

export class CoachingTargetError extends Error {}
export async function coachingTarget(db: PrismaClient | Prisma.TransactionClient, actor: AuthenticatedUser, userId: string, write = false) {
  assertAdminUser(actor);
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true, status: true } });
  if (!target || target.role !== "USER") throw new CoachingTargetError("Coaching user not found.");
  if (write && target.status !== "ACTIVE") throw new CoachingTargetError("Reactivate this account before changing its programme.");
  return target;
}
export async function adminCoachReport(db: PrismaClient, actor: AuthenticatedUser, userId: string, week?: string) {
  const target = await coachingTarget(db, actor, userId);
  return getWeeklyReview(db, target.id, week);
}
export async function adminCoachPreview(db: PrismaClient, actor: AuthenticatedUser, userId: string, json: string) {
  const target = await coachingTarget(db, actor, userId, true);
  return previewCoachImport(db, target.id, json);
}
export async function adminCoachApply(db: PrismaClient, actor: AuthenticatedUser, userId: string, json: string) {
  assertAdminUser(actor);
  return db.$transaction(async (tx) => {
    const target = await coachingTarget(tx, actor, userId, true);
    return applyCoachImportInTransaction(tx, target.id, json);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
