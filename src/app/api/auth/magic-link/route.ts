import { NextResponse } from "next/server";
import { z } from "zod";

import { emailIsAllowed, getServerEnv } from "@/lib/env";
import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { createMagicLinkToken, normalizeEmail } from "@/server/auth";
import { sendMagicLinkEmail } from "@/server/resend";

export const runtime = "nodejs";
const inputSchema = z.object({ email: z.email().max(320) }).strict();
const genericResponse = { sent: true, message: "If this email is allowed, a sign-in link has been sent." };

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const email = normalizeEmail(inputSchema.parse(await request.json()).email);
    if (!emailIsAllowed(email)) return NextResponse.json(genericResponse, { headers: { "Cache-Control": "no-store" } });
    const issued = await createMagicLinkToken(getPrisma(), email);
    const url = new URL("/api/auth/verify", getServerEnv().APP_ORIGIN);
    url.searchParams.set("token", issued.token);
    try {
      await sendMagicLinkEmail({ to: email, url: url.toString(), idempotencyKey: issued.tokenHash });
    } catch (error) {
      await getPrisma().magicLinkToken.deleteMany({ where: { tokenHash: issued.tokenHash, usedAt: null } });
      throw error;
    }
    return NextResponse.json(genericResponse, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    console.error("Magic-link request failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The sign-in email could not be sent. Try again shortly." }, { status: 502 });
  }
}
