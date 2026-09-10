import "server-only";

import { Prisma, type PrismaClient, type UserStatus } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/server/auth";
import { assertAdminUser } from "@/server/auth";

export class AdminUserManagementError extends Error {}

export type AdminUserSummary = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  onboardingState: "Ready" | "Awaiting personalised programme" | "Onboarding in progress" | "Not started";
  activeProgrammeName: string | null;
};

export async function listUsersForAdmin(prisma: PrismaClient, actor: AuthenticatedUser): Promise<AdminUserSummary[]> {
  assertAdminUser(actor);
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      onboardingProfile: { select: { path: true } },
      settings: { select: { activeProgram: { select: { name: true } } } },
      programmeRequests: { where: { status: "PENDING" }, select: { id: true }, take: 1 },
    },
  });
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    onboardingState: user.settings?.activeProgram ? "Ready" : user.programmeRequests.length ? "Awaiting personalised programme" : user.onboardingProfile ? "Onboarding in progress" : "Not started",
    activeProgrammeName: user.settings?.activeProgram?.name ?? null,
  }));
}

async function editableTarget(tx: Prisma.TransactionClient, actor: AuthenticatedUser, targetUserId: string) {
  if (actor.id === targetUserId) throw new AdminUserManagementError("You cannot manage your own current account.");
  const target = await tx.user.findUnique({ where: { id: targetUserId }, select: { id: true, email: true, role: true, status: true } });
  if (!target) throw new AdminUserManagementError("User not found.");
  if (target.role === "ADMIN") throw new AdminUserManagementError("Administrator accounts cannot be managed from this page.");
  return target;
}

export async function setUserAccountStatus(prisma: PrismaClient, actor: AuthenticatedUser, targetUserId: string, status: UserStatus) {
  assertAdminUser(actor);
  if (actor.id === targetUserId) throw new AdminUserManagementError("You cannot manage your own current account.");
  return prisma.$transaction(async (tx) => {
    const target = await editableTarget(tx, actor, targetUserId);
    if (target.status === status) return { id: target.id, status };
    await tx.user.update({ where: { id: target.id }, data: { status } });
    if (status === "DISABLED") {
      await tx.authSession.deleteMany({ where: { userId: target.id } });
      await tx.magicLinkToken.deleteMany({ where: { email: target.email } });
    }
    return { id: target.id, status };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function deleteManagedUser(prisma: PrismaClient, actor: AuthenticatedUser, targetUserId: string) {
  assertAdminUser(actor);
  if (actor.id === targetUserId) throw new AdminUserManagementError("You cannot manage your own current account.");
  return prisma.$transaction(async (tx) => {
    const target = await editableTarget(tx, actor, targetUserId);
    await tx.magicLinkToken.deleteMany({ where: { email: target.email } });
    // Sessions reference immutable programme snapshots with RESTRICT, so remove
    // the user's session tree before the user's programme tree is cascaded.
    await tx.workoutSession.deleteMany({ where: { userId: target.id } });
    await tx.user.delete({ where: { id: target.id } });
    return { id: target.id, deleted: true as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
