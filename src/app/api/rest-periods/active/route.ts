import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { getActiveRestTimer } from "@/server/rest-timers";
import { requireApiUser } from "@/server/auth";
import { authenticationErrorResponse } from "@/lib/http/auth-response";

export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await requireApiUser();
    const prisma = getPrisma();
    const [timer, settings] = await Promise.all([getActiveRestTimer(prisma, user.id), prisma.appSettings.findUnique({ where: { userId: user.id }, select: { soundEnabled: true, vibrationEnabled: true } })]);
    return NextResponse.json({ timer, settings: settings ?? { soundEnabled: false, vibrationEnabled: false } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const authResponse = authenticationErrorResponse(error); if (authResponse) return authResponse;
    return NextResponse.json({ error: "Timer state could not be loaded" }, { status: 500 });
  }
}
