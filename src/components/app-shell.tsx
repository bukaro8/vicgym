import Link from "next/link";
import type { ReactNode } from "react";

import { SiteNavigation } from "@/components/site-navigation";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">VG</span>
            <div>
              <p className="font-semibold tracking-tight">VicGym</p>
              <p className="text-xs text-muted-foreground">Private workout log</p>
            </div>
          </Link>
          <SiteNavigation variant="desktop" />
        </div>
      </header>
      {children}
      <footer className="mt-auto px-5 pt-8 pb-24 text-center text-xs text-muted-foreground sm:px-8 sm:pb-8">
        Phase 2 · Verified catalogue and demo programme only.
      </footer>
      <SiteNavigation variant="mobile" />
    </div>
  );
}
