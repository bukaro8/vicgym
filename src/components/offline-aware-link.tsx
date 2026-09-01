"use client";

import Link from "next/link";

export function OfflineAwareLink({ href, offlineHref, children, className }: Readonly<{ href: string; offlineHref: string; children: React.ReactNode; className?: string }>) { return <Link href={href} onClick={(event) => { if (navigator.onLine) return; event.preventDefault(); window.location.assign(offlineHref); }} className={className}>{children}</Link>; }
