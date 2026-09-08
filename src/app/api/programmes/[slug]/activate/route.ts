import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { setActiveProgramme } from "@/server/active-programme";
import { authenticationErrorResponse } from "@/lib/http/auth-response";
import { requireApiUser } from "@/server/auth";

export const runtime = "nodejs";

const activationSchema = z.object({ confirmation: z.literal("ACTIVATE_DEMO_PROGRAMME"), version: z.number().int().positive() });

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    assertSameOriginJson(request);
    const user = await requireApiUser();
    const body = activationSchema.parse(await request.json());
    const { slug } = await params;
    const prisma = getPrisma();
    const program = await prisma.workoutProgram.findFirst({ where: { userId: user.id, slug }, include: { versions: { where: { versionNumber: body.version }, select: { id: true } } } });
    if (!program || !program.isDemo || program.versions.length !== 1) return NextResponse.json({ error: "Demo programme version not found" }, { status: 404 });

    const updated = await prisma.$transaction((tx) => setActiveProgramme(tx, user.id, program.id, program.versions[0].id));
    revalidatePath("/");
    revalidatePath("/programme");
    return NextResponse.json({ program: updated });
  } catch (error) {
    const authResponse = authenticationErrorResponse(error); if (authResponse) return authResponse;
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid activation confirmation" }, { status: 400 });
    console.error("Demo programme activation failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Programme activation failed" }, { status: 500 });
  }
}
