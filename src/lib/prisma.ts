import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

const prismaGlobal = globalThis as typeof globalThis & {
  vicGymPrisma?: PrismaClient;
};

export function getPrisma(): PrismaClient {
  if (!prismaGlobal.vicGymPrisma) {
    const adapter = new PrismaPg({ connectionString: getServerEnv().DATABASE_URL });
    prismaGlobal.vicGymPrisma = new PrismaClient({ adapter });
  }

  return prismaGlobal.vicGymPrisma;
}
