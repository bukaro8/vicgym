import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { fullyPersonalisedSchema } from "@/lib/onboarding";
import { getPrisma } from "@/lib/prisma";
import { AuthenticationRequiredError, requireApiUser } from "@/server/auth";
import { OnboardingConflictError, submitFullyPersonalisedOnboarding } from "@/server/onboarding";
import { notifyAdminOfProgrammeRequest } from "@/server/programme-request-notifications";

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const user = await requireApiUser();
    const input = fullyPersonalisedSchema.parse(await request.json());
    const prisma = getPrisma();
    const result = await submitFullyPersonalisedOnboarding(prisma, user.id, input);
    await notifyAdminOfProgrammeRequest(prisma, result.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ZodError) return NextResponse.json({ error: "Invalid personalised questionnaire", issues: error.issues }, { status: 400 });
    if (error instanceof OnboardingConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Personalised questionnaire submission failed", { error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Could not submit personalised programme request" }, { status: 500 });
  }
}
