import { NextResponse } from "next/server";

import { AuthenticationRequiredError } from "@/server/auth";

export function authenticationErrorResponse(error: unknown): NextResponse | null {
  return error instanceof AuthenticationRequiredError
    ? NextResponse.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    : null;
}
