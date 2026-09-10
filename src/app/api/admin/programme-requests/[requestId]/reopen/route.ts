import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { reopenProgrammeRequest } from "@/server/admin-programme-requests";
import { AdminRequiredError, AuthenticationRequiredError, requireAdminUser } from "@/server/auth";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    assertSameOriginJson(request);
    const admin = await requireAdminUser();
    const { requestId } = await context.params;
    await reopenProgrammeRequest(getPrisma(), admin, requestId);
    revalidatePath("/admin/requests");
    revalidatePath(`/admin/requests/${requestId}`);
    return NextResponse.json({ reopened: true });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof AdminRequiredError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request could not be reopened" }, { status: 409 });
  }
}
