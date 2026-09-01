import { AppShell } from "@/components/app-shell";
import { OfflineStatusSettings } from "@/components/offline-status-settings";

export default function OfflineSettingsPage() { return <AppShell><main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:px-8 sm:py-10"><p className="text-sm font-semibold text-primary">More</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Offline & synchronization</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">VicGym saves active workout changes locally first, then replays them in order when the server is reachable.</p><OfflineStatusSettings/></main></AppShell>; }
