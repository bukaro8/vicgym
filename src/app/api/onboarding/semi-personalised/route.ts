import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { semiPersonalisedSchema } from "@/lib/onboarding";
import { getPrisma } from "@/lib/prisma";
import { AuthenticationRequiredError, requireApiUser } from "@/server/auth";
import { completeSemiPersonalisedOnboarding } from "@/server/onboarding";

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const user = await requireApiUser();
    const input = semiPersonalisedSchema.parse(await request.json());
    const result = await completeSemiPersonalisedOnboarding(getPrisma(), user.id, input);
    revalidatePath("/"); revalidatePath("/programme"); revalidatePath("/workouts");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ZodError) return NextResponse.json({ error: "Invalid onboarding answers", issues: error.issues }, { status: 400 });
    if (error instanceof Error && error.message === "ONBOARDING_ALREADY_COMPLETED") return NextResponse.json({ error: "Onboarding is already complete" }, { status: 409 });
    console.error("Starter programme generation failed", { userId: "authenticated", error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create starter programme" }, { status: 500 });
  }
}
