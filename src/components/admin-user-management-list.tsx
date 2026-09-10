"use client";

import { Trash2, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminUserSummary } from "@/server/admin-users";

export function AdminUserManagementList({ initialUsers, currentAdminId }: { initialUsers: AdminUserSummary[]; currentAdminId: string }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserSummary | null>(null);
  const [error, setError] = useState("");

  async function mutate(user: AdminUserSummary, method: "PATCH" | "DELETE", body: unknown) {
    setBusyId(user.id); setError("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "User management failed");
      if (method === "DELETE") setUsers((current) => current.filter((item) => item.id !== user.id));
      else setUsers((current) => current.map((item) => item.id === user.id ? { ...item, status: result.status } : item));
      setDeleteTarget(null); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "User management failed"); }
    finally { setBusyId(null); }
  }

  async function toggleStatus(user: AdminUserSummary) {
    const disabling = user.status === "ACTIVE";
    if (disabling && !window.confirm(`Deactivate ${user.email}? Their data will be preserved, but all sessions will be signed out.`)) return;
    await mutate(user, "PATCH", { status: disabling ? "DISABLED" : "ACTIVE" });
  }

  return <>
    {error && <p role="alert" className="mt-5 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    <div className="mt-6 overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="hidden grid-cols-[minmax(0,1.4fr)_0.5fr_0.65fr_1fr_1fr_1.25fr] gap-4 border-b bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid"><span>Email</span><span>Role</span><span>Status</span><span>Onboarding</span><span>Active programme</span><span>Actions</span></div>
      <ul className="divide-y">{users.map((user) => {
        const manageable = user.role !== "ADMIN" && user.id !== currentAdminId;
        return <li key={user.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.4fr)_0.5fr_0.65fr_1fr_1fr_1.25fr] lg:items-center lg:gap-4">
          <div className="min-w-0"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Email</span><p className="truncate font-medium">{user.email}</p></div>
          <UserValue label="Role" value={user.role === "ADMIN" ? "Admin" : "User"}/>
          <div><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Status</span><p><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${user.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{user.status === "ACTIVE" ? "Active" : "Disabled"}</span></p></div>
          <UserValue label="Onboarding" value={user.onboardingState}/>
          <UserValue label="Active programme" value={user.activeProgrammeName ?? "None"}/>
          <div><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Actions</span>{manageable ? <div className="mt-1 flex flex-wrap gap-2 lg:mt-0"><button disabled={busyId === user.id} onClick={() => void toggleStatus(user)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold disabled:opacity-50">{user.status === "ACTIVE" ? <UserX className="size-3.5"/> : <UserCheck className="size-3.5"/>}{user.status === "ACTIVE" ? "Deactivate" : "Reactivate"}</button><button disabled={busyId === user.id} onClick={() => setDeleteTarget(user)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-destructive/30 px-3 text-xs font-semibold text-destructive disabled:opacity-50"><Trash2 className="size-3.5"/>Delete</button></div> : <p className="text-xs text-muted-foreground">Protected administrator</p>}</div>
        </li>;
      })}{users.length === 0 && <li className="p-7 text-sm text-muted-foreground">No users found.</li>}</ul>
    </div>
    {deleteTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="delete-user-title" className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-xl"><h2 id="delete-user-title" className="text-xl font-semibold">Delete user permanently?</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">This permanently deletes <strong className="text-foreground">{deleteTarget.email}</strong> and all of their programmes, workout history, onboarding information, requests, settings, sessions, and sync records. The shared exercise catalogue is not affected.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button disabled={busyId === deleteTarget.id} onClick={() => setDeleteTarget(null)} className="min-h-11 rounded-xl border px-4 font-semibold">Keep user</button><button disabled={busyId === deleteTarget.id} onClick={() => void mutate(deleteTarget, "DELETE", { confirmation: "DELETE_USER" })} className="min-h-11 rounded-xl bg-destructive px-4 font-semibold text-white disabled:opacity-50">{busyId === deleteTarget.id ? "Deleting…" : "Delete user and data"}</button></div></section></div>}
  </>;
}

function UserValue({ label, value }: { label: string; value: string }) { return <div><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">{label}</span><p className="text-sm">{value}</p></div>; }
