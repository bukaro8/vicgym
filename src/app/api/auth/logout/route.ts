import { NextResponse } from "next/server";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { AUTH_COOKIE_NAME, deleteCurrentAuthSession } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    await deleteCurrentAuthSession();
    const response = NextResponse.json({ loggedOut: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(AUTH_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", expires: new Date(0) });
    return response;
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
