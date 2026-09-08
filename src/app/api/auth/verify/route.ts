import { NextResponse } from "next/server";

import { getAuthEmailEnv } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, consumeMagicLinkToken, sessionCookieOptions } from "@/server/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token");
  const env = getAuthEmailEnv();
  const loginUrl = new URL("/login", env.APP_ORIGIN);
  if (!token || token.length > 200) {
    loginUrl.searchParams.set("error", "invalid-link");
    return NextResponse.redirect(loginUrl, { headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
  }
  const result = await consumeMagicLinkToken(getPrisma(), token);
  if (!result) {
    loginUrl.searchParams.set("error", "expired-link");
    return NextResponse.redirect(loginUrl, { headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
  }
  const response = NextResponse.redirect(new URL("/", env.APP_ORIGIN), { headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
  response.cookies.set(AUTH_COOKIE_NAME, result.sessionToken, sessionCookieOptions(result.expiresAt, env.APP_ORIGIN.startsWith("https://")));
  return response;
}
