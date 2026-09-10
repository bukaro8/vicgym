import { redirect } from "next/navigation";

import { AdminUserManagementList } from "@/components/admin-user-management-list";
import { getPrisma } from "@/lib/prisma";
import { listUsersForAdmin } from "@/server/admin-users";
import { requireCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireCurrentUser();
  if (admin.role !== "ADMIN") redirect("/");
  const users = await listUsersForAdmin(getPrisma(), admin);
  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-8 sm:py-10"><p className="text-sm font-semibold text-primary">Administrator</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Users</h1><p className="mt-2 text-sm text-muted-foreground">Manage access while preserving the shared exercise catalogue. Administrator accounts are protected here.</p><AdminUserManagementList initialUsers={users} currentAdminId={admin.id}/></main>;
}
