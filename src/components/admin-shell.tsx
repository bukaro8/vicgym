import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AdminNavigation } from "@/components/admin-navigation";

export function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex min-h-dvh flex-col bg-background"><header className="sticky top-0 z-30 border-b bg-card/95 px-4 py-3 backdrop-blur sm:px-8"><div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4"><Link href="/admin/requests" className="flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><ShieldCheck className="size-5"/></span><span><strong className="block leading-tight">VicGym Admin</strong><span className="text-xs text-muted-foreground">Programme management</span></span></Link><AdminNavigation variant="desktop"/></div></header>{children}<footer className="mt-auto px-5 pt-8 pb-24 text-center text-xs text-muted-foreground md:pb-8">Administrator tools are read-only except for explicit programme-request actions.</footer><AdminNavigation variant="mobile"/></div>;
}

export function BackToRequestsLink() {
  return <Link href="/admin/requests" className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl text-sm font-semibold text-primary"><ArrowLeft className="size-4"/>Back to requests</Link>;
}
