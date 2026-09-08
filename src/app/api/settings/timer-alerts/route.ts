import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { authenticationErrorResponse } from "@/lib/http/auth-response";
import { requireApiUser } from "@/server/auth";

const timerAlertSettingsSchema = z.object({ soundEnabled: z.boolean(), vibrationEnabled: z.boolean() });

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireApiUser();
    const settings = await getPrisma().appSettings.findUnique({ where: { userId: user.id }, select: { soundEnabled: true, vibrationEnabled: true } });
    return NextResponse.json(settings ?? { soundEnabled: false, vibrationEnabled: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const authResponse = authenticationErrorResponse(error); if (authResponse) return authResponse;
    return NextResponse.json({ error: "Timer alert settings could not be loaded" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOriginJson(request);
    const user = await requireApiUser();
    const input = timerAlertSettingsSchema.parse(await request.json());
    const settings = await getPrisma().appSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, ...input }, update: input, select: { soundEnabled: true, vibrationEnabled: true } });
    return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const authResponse = authenticationErrorResponse(error); if (authResponse) return authResponse;
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid timer alert settings" }, { status: 400 });
    return NextResponse.json({ error: "Timer alert settings could not be saved" }, { status: 500 });
  }
}
