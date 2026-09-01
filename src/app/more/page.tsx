import { ClipboardCheck, CloudOff } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { TimerAlertSettings } from "@/components/timer-alert-settings";

export default function MorePage() { return <AppShell><main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:px-8 sm:py-10"><p className="text-sm font-semibold text-primary">VicGym</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">More</h1><div className="mt-6 grid gap-3"><Link href="/more/review" className="flex items-center gap-4 rounded-2xl border bg-card p-4"><span className="grid size-11 place-items-center rounded-2xl bg-accent text-primary"><ClipboardCheck className="size-5"/></span><span><strong className="block">Coach review</strong><span className="text-sm text-muted-foreground">Weekly report and programme changes</span></span></Link><Link href="/more/offline" className="flex items-center gap-4 rounded-2xl border bg-card p-4"><span className="grid size-11 place-items-center rounded-2xl bg-accent text-primary"><CloudOff className="size-5"/></span><span><strong className="block">Offline & synchronization</strong><span className="text-sm text-muted-foreground">Local queue, retry, and private-data reset</span></span></Link></div><div className="mt-6"><TimerAlertSettings /></div></main></AppShell>; }
