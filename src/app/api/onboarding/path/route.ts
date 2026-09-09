import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { onboardingPathSchema } from "@/lib/onboarding";
import { getPrisma } from "@/lib/prisma";
import { AuthenticationRequiredError, requireApiUser } from "@/server/auth";
import { chooseOnboardingPath, OnboardingConflictError } from "@/server/onboarding";

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const user = await requireApiUser();
    const input = onboardingPathSchema.parse(await request.json());
    return NextResponse.json(await chooseOnboardingPath(getPrisma(), user.id, input.path));
  } catch (error) {
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ZodError) return NextResponse.json({ error: "Invalid onboarding selection", issues: error.issues }, { status: 400 });
    if (error instanceof OnboardingConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Onboarding path selection failed", { error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Could not save onboarding selection" }, { status: 500 });
  }
}
