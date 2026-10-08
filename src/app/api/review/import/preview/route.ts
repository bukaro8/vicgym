import { NextResponse } from "next/server";

// Retired user endpoint: coaching is only available through target-scoped admin routes.
export async function POST() {
  return NextResponse.json({ error: "Coach Review is managed by your trainer." }, { status: 403, headers: { "Cache-Control": "no-store" } });
}
