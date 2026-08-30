"use client";

import { Dumbbell, Home, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/programme", label: "Programme", icon: ListChecks },
] as const;

export function SiteNavigation({ variant }: Readonly<{ variant: "desktop" | "mobile" }>) {
  const pathname = usePathname();

  if (variant === "desktop") {
    return (
      <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary navigation">
        {items.map(({ href, label }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("rounded-xl px-3 py-2 text-sm font-medium transition-colors", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{label}</Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden" aria-label="Primary navigation">
      <div className="mx-auto grid max-w-md grid-cols-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium", active ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
