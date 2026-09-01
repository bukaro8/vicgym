import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { getWeeklyReview } from "@/server/weekly-review";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const week = new URL(request.url).searchParams.get("week") ?? undefined;
    return NextResponse.json({ review: await getWeeklyReview(getPrisma(), week) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "INVALID_WEEK" ? "Week must be a Monday in YYYY-MM-DD form." : "Report could not be generated." }, { status: 400 });
  }
}
