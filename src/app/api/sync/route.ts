import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { replayOfflineMutations } from "@/server/sync";

export const runtime = "nodejs";
const mutationSchema = z.object({ id: z.string().uuid(), sequence: z.number().int().positive(), type: z.enum(["ADD_SET", "UPSERT_SET", "UPSERT_TIMER", "UPDATE_CARDIO", "FINISH_WORKOUT"]), sessionId: z.string().uuid(), targetId: z.string().uuid(), payload: z.record(z.string(), z.unknown()), createdAt: z.string().datetime(), attempts: z.number().int().nonnegative(), lastError: z.string().nullable() });
const batchSchema = z.object({ schemaVersion: z.literal(1), mutations: z.array(mutationSchema).min(1).max(100) });

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request); const input = batchSchema.parse(await request.json()); const results = await replayOfflineMutations(getPrisma(), input.mutations); const failed = results.some((result) => result.status === "failed");
    return NextResponse.json({ results }, { status: failed ? 409 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid sync batch", issues: error.issues }, { status: 400, headers: { "Cache-Control": "no-store" } });
    console.error("Offline sync failed", error instanceof Error ? error.name : "UnknownError"); return NextResponse.json({ error: "Sync could not be completed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
