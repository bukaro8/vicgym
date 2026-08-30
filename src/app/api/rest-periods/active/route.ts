import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { getActiveRestTimer } from "@/server/rest-timers";

export const runtime = "nodejs";
export async function GET() {
  const prisma = getPrisma();
  const [timer, settings] = await Promise.all([getActiveRestTimer(prisma), prisma.appSettings.findUnique({ where: { id: 1 }, select: { soundEnabled: true, vibrationEnabled: true } })]);
  return NextResponse.json({ timer, settings: settings ?? { soundEnabled: false, vibrationEnabled: false } });
}
