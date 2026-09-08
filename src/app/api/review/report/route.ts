import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { getWeeklyReview } from "@/server/weekly-review";
import { authenticationErrorResponse } from "@/lib/http/auth-response";
import { requireApiUser } from "@/server/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const week = new URL(request.url).searchParams.get("week") ?? undefined;
    return NextResponse.json({ review: await getWeeklyReview(getPrisma(), user.id, week) });
  } catch (error) {
    const authResponse = authenticationErrorResponse(error); if (authResponse) return authResponse;
    return NextResponse.json({ error: error instanceof Error && error.message === "INVALID_WEEK" ? "Week must be a Monday in YYYY-MM-DD form." : "Report could not be generated." }, { status: 400 });
  }
}
