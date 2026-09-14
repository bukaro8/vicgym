"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function AdminRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = pathname === "/admin" || pathname.startsWith("/admin/");
  useEffect(() => { if (!allowed) router.replace("/admin/requests"); }, [allowed, router]);
  return allowed ? children : <main className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">Opening administrator tools…</main>;
}
