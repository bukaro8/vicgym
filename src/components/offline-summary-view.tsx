"use client";

import { CheckCircle2, Clock3, CloudOff, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { getOfflineOutbox, getOfflineWorkout } from "@/lib/offline-db";
import type { OfflineWorkout } from "@/lib/offline-types";

export function OfflineSummaryView({ sessionId }: Readonly<{ sessionId: string }>) {
  const router = useRouter();
  const [data, setData] = useState<{ workout: OfflineWorkout | null; pending: number }>();
  const inspect = useCallback(() => Promise.all([getOfflineWorkout(sessionId), getOfflineOutbox()]).then(([workout, outbox]) => setData({ workout, pending: outbox.filter((item) => item.sessionId === sessionId).length })).catch(() => setData({ workout: null, pending: 0 })), [sessionId]);
  useEffect(() => { const changed = () => void inspect(); void inspect(); window.addEventListener("vicgym:outbox-changed", changed); window.addEventListener("vicgym:sync-status", changed); return () => { window.removeEventListener("vicgym:outbox-changed", changed); window.removeEventListener("vicgym:sync-status", changed); }; }, [inspect]);
  useEffect(() => { if (data?.workout?.status === "COMPLETED" && data.pending === 0) { router.replace(`/workouts/${sessionId}/summary`); router.refresh(); } }, [data, router, sessionId]);
  const completedSets = data?.workout?.exercises.flatMap((item) => item.sets).filter((set) => set.completedAt).length ?? 0;
  const completedExercises = data?.workout?.exercises.filter((item) => item.sets.filter((set) => set.completedAt).length >= item.plannedSets).length ?? 0; const duration = data?.workout?.completedAt ? Math.max(0, Math.floor((new Date(data.workout.completedAt).getTime() - new Date(data.workout.startedAt).getTime()) / 60_000)) : 0;
  const synchronized = data?.pending === 0;
  return <AppShell><main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-8"><section className="rounded-3xl border bg-card p-6 text-center shadow-sm"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-primary"><CheckCircle2 className="size-8"/></span><p className="mt-5 text-sm font-semibold text-primary">Saved on this device</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{data?.workout?.workoutDayName ?? "Workout complete"}</h1><p className="mt-3 text-muted-foreground">Summary values come from the locally saved session.</p><div className="mt-6 grid grid-cols-3 gap-3 text-left"><SummaryMetric icon={<CheckCircle2 className="size-5 text-primary"/>} value={completedExercises} label="Exercises complete"/><SummaryMetric icon={<ListChecks className="size-5 text-primary"/>} value={completedSets} label="Completed sets"/><SummaryMetric icon={<Clock3 className="size-5 text-primary"/>} value={`${duration}m`} label="Duration"/></div><div className="mt-6 flex items-start gap-3 rounded-2xl border bg-background p-4 text-left">{synchronized ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary"/> : <CloudOff className="mt-0.5 size-5 shrink-0 text-primary"/>}<p className="text-sm"><strong className="block">{synchronized ? "Synchronized" : "Synchronization pending"}</strong><span className="mt-1 block text-muted-foreground">{!data ? "Checking local changes…" : synchronized ? "All local changes have reached VicGym." : `${data.pending} local change${data.pending === 1 ? "" : "s"} will retry automatically on reconnect, app start, or focus.`}</span></p></div><button type="button" onClick={() => router.push("/")} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-5 font-semibold text-white">Return home</button></section></main></AppShell>;
}

function SummaryMetric({ icon, value, label }: Readonly<{ icon: React.ReactNode; value: string | number; label: string }>) { return <div className="rounded-2xl border bg-card p-3">{icon}<p className="mt-3 text-xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>; }
