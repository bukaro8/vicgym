"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import type { OnboardingMode } from "@/lib/onboarding";

export function OnboardingGate({ mode, children }: { mode: OnboardingMode; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const blocked = mode !== "READY" && pathname !== "/onboarding";
  useEffect(() => { if (blocked) router.replace("/onboarding"); }, [blocked, router]);
  return blocked ? <main className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">Preparing onboarding…</main> : children;
}
