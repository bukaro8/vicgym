import type { PrismaClient } from "@/generated/prisma/client";

type BootstrapLogger = Pick<Console, "info">;

export async function bootstrapAdministrator(
  prisma: PrismaClient,
  configuredEmail: string | undefined,
  logger: BootstrapLogger = console,
) {
  const email = configuredEmail?.trim().toLowerCase();
  if (!email) return { configured: false, promoted: false } as const;

  const result = await prisma.user.updateMany({
    where: { email },
    data: { role: "ADMIN" },
  });

  if (result.count === 0) {
    logger.info(`ADMIN_EMAIL is configured for ${email}, but that user does not exist yet. Sign in once, then run the seed again to promote the account.`);
    return { configured: true, promoted: false } as const;
  }

  logger.info(`Administrator bootstrap confirmed for ${email}.`);
  return { configured: true, promoted: true } as const;
}
