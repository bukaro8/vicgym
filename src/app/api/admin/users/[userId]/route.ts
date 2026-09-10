import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";
import { getPrisma } from "@/lib/prisma";
import { AdminUserManagementError, deleteManagedUser, setUserAccountStatus } from "@/server/admin-users";
import { AdminRequiredError, AuthenticationRequiredError, requireAdminUser } from "@/server/auth";

const paramsSchema = z.object({ userId: z.uuid() });
const statusSchema = z.object({ status: z.enum(["ACTIVE", "DISABLED"]) }).strict();
const deleteSchema = z.object({ confirmation: z.literal("DELETE_USER") }).strict();

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof AdminRequiredError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof RequestPolicyError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof AdminUserManagementError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid user-management request" }, { status: 400 });
  console.error("Administrator user management failed", { error: error instanceof Error ? error.message : "Unknown error" });
  return NextResponse.json({ error: "User management failed" }, { status: 500 });
}

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    assertSameOriginJson(request);
    const actor = await requireAdminUser();
    const { userId } = paramsSchema.parse(await context.params);
    const { status } = statusSchema.parse(await request.json());
    const result = await setUserAccountStatus(getPrisma(), actor, userId, status);
    revalidatePath("/admin/users");
    return NextResponse.json(result);
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    assertSameOriginJson(request);
    const actor = await requireAdminUser();
    const { userId } = paramsSchema.parse(await context.params);
    deleteSchema.parse(await request.json());
    const result = await deleteManagedUser(getPrisma(), actor, userId);
    revalidatePath("/admin/users");
    return NextResponse.json(result);
  } catch (error) { return errorResponse(error); }
}
