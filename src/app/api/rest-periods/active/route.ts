import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { getActiveRestTimer } from "@/server/rest-timers";
import { requireApiUser } from "@/server/auth";

export const runtime = "nodejs";
export async function GET() {
  const user = await requireApiUser();
  const prisma = getPrisma();
  const [timer, settings] = await Promise.all([getActiveRestTimer(prisma, user.id), prisma.appSettings.findUnique({ where: { userId: user.id }, select: { soundEnabled: true, vibrationEnabled: true } })]);
  return NextResponse.json({ timer, settings: settings ?? { soundEnabled: false, vibrationEnabled: false } });
}
