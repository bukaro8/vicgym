import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/server/auth";
import { assertAdminUser } from "@/server/auth";

export type AdminUserSummary = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
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
      onboardingProfile: { select: { path: true } },
      settings: { select: { activeProgram: { select: { name: true } } } },
      programmeRequests: { where: { status: "PENDING" }, select: { id: true }, take: 1 },
    },
  });
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    onboardingState: user.settings?.activeProgram ? "Ready" : user.programmeRequests.length ? "Awaiting personalised programme" : user.onboardingProfile ? "Onboarding in progress" : "Not started",
    activeProgrammeName: user.settings?.activeProgram?.name ?? null,
  }));
}
