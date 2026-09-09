import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getPrisma } from "@/lib/prisma";
import { listProgrammeRequests } from "@/server/admin-programme-requests";
import { requireCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";
export default async function AdminRequestsPage() { const user = await requireCurrentUser(); if (user.role !== "ADMIN") redirect("/"); const requests = await listProgrammeRequests(getPrisma()); return <AppShell><main className="mx-auto w-full max-w-4xl flex-1 px-4 py-7 sm:px-8 sm:py-10"><p className="text-sm font-semibold text-primary">Administrator</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Personalised programme requests</h1><p className="mt-2 text-sm text-muted-foreground">Pending coach briefs awaiting an initial programme.</p><div className="mt-7 space-y-3">{requests.map((request)=><Link key={request.id} href={`/admin/requests/${request.id}`} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm"><span className="grid size-11 place-items-center rounded-2xl bg-accent text-primary"><ClipboardList className="size-5"/></span><span className="min-w-0 flex-1"><strong className="block truncate">{request.user.email}</strong><span className="text-sm text-muted-foreground">Submitted {request.createdAt.toLocaleString("en-GB")} · {request.status}</span></span></Link>)}{!requests.length && <div className="rounded-3xl border bg-card p-7 text-sm text-muted-foreground">No pending personalised programme requests.</div>}</div></main></AppShell>; }
