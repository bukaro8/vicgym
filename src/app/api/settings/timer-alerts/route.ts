import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";

const timerAlertSettingsSchema = z.object({ soundEnabled: z.boolean(), vibrationEnabled: z.boolean() });

export const runtime = "nodejs";

export async function GET() {
  const settings = await getPrisma().appSettings.findUnique({ where: { id: 1 }, select: { soundEnabled: true, vibrationEnabled: true } });
  return NextResponse.json(settings ?? { soundEnabled: false, vibrationEnabled: false }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  try {
    assertSameOriginJson(request);
    const input = timerAlertSettingsSchema.parse(await request.json());
    const settings = await getPrisma().appSettings.upsert({ where: { id: 1 }, create: { id: 1, ...input }, update: input, select: { soundEnabled: true, vibrationEnabled: true } });
    return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid timer alert settings" }, { status: 400 });
    return NextResponse.json({ error: "Timer alert settings could not be saved" }, { status: 500 });
  }
}
