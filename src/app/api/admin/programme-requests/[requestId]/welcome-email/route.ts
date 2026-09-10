import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { WELCOME_EMAIL_MAX_LENGTH } from "@/lib/welcome-email";
import { AdminRequiredError, AuthenticationRequiredError, requireAdminUser } from "@/server/auth";
import { ProgrammeWelcomeEmailError, sendProgrammeWelcomeEmail } from "@/server/programme-request-notifications";

const bodySchema = z.object({ body: z.string().trim().min(20).max(WELCOME_EMAIL_MAX_LENGTH), confirmation: z.literal("SEND_WELCOME_EMAIL") }).strict();

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    assertSameOriginJson(request);
    const actor = await requireAdminUser();
    const { requestId } = await context.params;
    const input = bodySchema.parse(await request.json());
    const result = await sendProgrammeWelcomeEmail(getPrisma(), actor, requestId, input.body);
    revalidatePath(`/admin/requests/${requestId}`);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof AdminRequiredError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ProgrammeWelcomeEmailError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof z.ZodError ? "Invalid welcome email" : "Welcome email could not be sent" }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
