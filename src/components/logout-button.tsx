"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.assign("/login");
    } catch { setBusy(false); }
  }
  return <button type="button" onClick={() => void logout()} disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border bg-card px-5 font-semibold text-foreground disabled:opacity-60"><LogOut className="size-4"/>{busy ? "Signing out…" : "Sign out"}</button>;
}
