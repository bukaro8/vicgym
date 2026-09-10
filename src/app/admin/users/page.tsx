import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/prisma";
import { listUsersForAdmin } from "@/server/admin-users";
import { requireCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireCurrentUser();
  if (admin.role !== "ADMIN") redirect("/");
  const users = await listUsersForAdmin(getPrisma(), admin);
  return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-8 sm:py-10"><p className="text-sm font-semibold text-primary">Administrator</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Users</h1><p className="mt-2 text-sm text-muted-foreground">Basic account and onboarding information. This page is read-only.</p><div className="mt-6 overflow-hidden rounded-3xl border bg-card shadow-sm"><div className="hidden grid-cols-[minmax(0,1.5fr)_0.55fr_1fr_1fr] gap-4 border-b bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid"><span>Email</span><span>Role</span><span>Onboarding</span><span>Active programme</span></div><ul className="divide-y">{users.map((user) => <li key={user.id} className="grid gap-3 p-5 md:grid-cols-[minmax(0,1.5fr)_0.55fr_1fr_1fr] md:items-center md:gap-4"><div className="min-w-0"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:hidden">Email</span><p className="truncate font-medium">{user.email}</p></div><UserValue label="Role" value={user.role === "ADMIN" ? "Admin" : "User"}/><UserValue label="Onboarding" value={user.onboardingState}/><UserValue label="Active programme" value={user.activeProgrammeName ?? "None"}/></li>)}{users.length === 0 && <li className="p-7 text-sm text-muted-foreground">No users found.</li>}</ul></div></main>;
}

function UserValue({ label, value }: { label: string; value: string }) { return <div><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:hidden">{label}</span><p className="text-sm">{value}</p></div>; }
