"use client";

import { ClipboardList, Dumbbell, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

const adminItems = [
  { href: "/admin/requests", label: "Programme Requests", mobileLabel: "Requests", icon: ClipboardList },
  { href: "/admin/users", label: "Users", mobileLabel: "Users", icon: Users },
] as const;

function isActive(pathname: string, href: string) { return pathname === href || pathname.startsWith(`${href}/`); }

export function AdminNavigation({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  if (variant === "desktop") return <nav aria-label="Administrator navigation" className="hidden items-center gap-1 md:flex">{adminItems.map(({ href, label }) => <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined} className={cn("rounded-xl px-3 py-2 text-sm font-medium", isActive(pathname, href) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{label}</Link>)}<Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Dumbbell className="size-4"/>Return to VicGym</Link><LogoutButton variant="admin-desktop" label="Logout"/></nav>;
  return <nav aria-label="Administrator navigation" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"><div className="mx-auto grid max-w-lg grid-cols-4">{adminItems.map(({ href, mobileLabel, icon: Icon }) => <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium", isActive(pathname, href) ? "text-primary" : "text-muted-foreground")}><Icon className="size-5"/>{mobileLabel}</Link>)}<Link href="/" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-muted-foreground"><Dumbbell className="size-5"/>VicGym</Link><LogoutButton variant="admin-mobile" label="Logout"/></div></nav>;
}
