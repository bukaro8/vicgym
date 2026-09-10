"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { clearOfflineRuntimeCaches, configureOfflineOwner } from "@/lib/offline-db";
import { cn } from "@/lib/utils";

export function LogoutButton({ variant = "default", label = "Sign out" }: { variant?: "default" | "admin-desktop" | "admin-mobile"; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("Logout failed");
      await clearOfflineRuntimeCaches();
      configureOfflineOwner(null);
      router.replace("/login");
      router.refresh();
    } catch { setBusy(false); }
  }
  return <button type="button" onClick={() => void logout()} disabled={busy} className={cn("inline-flex items-center justify-center font-semibold text-foreground disabled:opacity-60", variant === "default" && "min-h-12 w-full gap-2 rounded-2xl border bg-card px-5", variant === "admin-desktop" && "min-h-10 gap-2 rounded-xl px-3 text-sm hover:bg-muted", variant === "admin-mobile" && "min-h-16 flex-col gap-1 text-[0.6875rem]")}><LogOut className={variant === "admin-mobile" ? "size-5" : "size-4"}/>{busy ? "Signing out…" : label}</button>;
}
