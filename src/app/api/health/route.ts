import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET() {
  const startedAt = performance.now();

  try {
    await getPrisma().$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ready",
        checks: { application: "ok", database: "ok" },
        timestamp: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startedAt),
      },
      { status: 200, headers: responseHeaders },
    );
  } catch (error) {
    console.error(
      "Database health check failed",
      error instanceof Error ? error.name : "UnknownError",
    );

    return NextResponse.json(
      {
        status: "not_ready",
        checks: { application: "ok", database: "error" },
        timestamp: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startedAt),
      },
      { status: 503, headers: responseHeaders },
    );
  }
}
