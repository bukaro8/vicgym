import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin-shell";
import { requireCurrentUser } from "@/server/auth";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireCurrentUser();
  if (user.role !== "ADMIN") redirect("/");
  return <AdminShell>{children}</AdminShell>;
}
