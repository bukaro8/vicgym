"use client";

import { Maximize2, Pause, Play, SkipForward, TimerReset, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { adjustedRemainingMilliseconds, formatTimer, remainingMilliseconds } from "@/lib/rest-timer";
import { cn } from "@/lib/utils";
import type { RestTimerDto, TimerAction } from "@/server/rest-timers";

type TimerSettings = { soundEnabled: boolean; vibrationEnabled: boolean };
type TimerEvent = CustomEvent<{ timer: RestTimerDto }>;

const TimerContext = createContext<{ begin(timer: RestTimerDto): void } | null>(null);

export function useRestTimer() {
  const value = useContext(TimerContext);
  if (!value) throw new Error("useRestTimer must be used inside RestTimerProvider");
  return value;
}

export function RestTimerProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [timer, setTimer] = useState<RestTimerDto | null>(null);
  const [settings, setSettings] = useState<TimerSettings>({ soundEnabled: false, vibrationEnabled: false });
  const [remainingMs, setRemainingMs] = useState(0);
  const [overlay, setOverlay] = useState(false);
  const [busy, setBusy] = useState(false);
  const completedRef = useRef<string | null>(null);

  const calculate = useCallback((value: RestTimerDto | null) => value?.status === "PAUSED" ? (value.pausedRemainingMs ?? 0) : remainingMilliseconds(value?.endsAt ?? null), []);
  const begin = useCallback((value: RestTimerDto) => { completedRef.current = null; setTimer(value); setRemainingMs(calculate(value)); setOverlay(true); }, [calculate]);

  useEffect(() => {
    fetch("/api/rest-periods/active", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => {
      if (!data) return;
      setSettings(data.settings);
      setTimer(data.timer);
      setRemainingMs(calculate(data.timer));
    }).catch(() => undefined);
    const listener = (event: Event) => begin((event as TimerEvent).detail.timer);
    window.addEventListener("vicgym:timer-started", listener);
    return () => window.removeEventListener("vicgym:timer-started", listener);
  }, [begin, calculate]);

  const action = useCallback(async (nextAction: TimerAction) => {
    if (!timer || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/rest-periods/${timer.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: nextAction }) });
      if (!response.ok) throw new Error("Timer update failed");
      const data = await response.json();
      setTimer(data.timer);
      setRemainingMs(calculate(data.timer));
      if (!data.timer) setOverlay(false);
    } finally { setBusy(false); }
  }, [busy, calculate, timer]);

  useEffect(() => {
    if (!timer || timer.status !== "RUNNING") return;
    const tick = () => {
      const next = remainingMilliseconds(timer.endsAt);
      setRemainingMs(next);
      if (next === 0 && completedRef.current !== timer.id) {
        completedRef.current = timer.id;
        if (settings.soundEnabled) {
          try { const context = new AudioContext(); const oscillator = context.createOscillator(); oscillator.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.18); } catch { /* best effort */ }
        }
        if (settings.vibrationEnabled && "vibrate" in navigator) navigator.vibrate([180, 80, 180]);
        void action("COMPLETE");
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [action, settings, timer]);

  const optimisticAdjust = (seconds: number) => {
    setRemainingMs((current) => adjustedRemainingMilliseconds(current, seconds));
    void action(seconds > 0 ? "ADD_15" : "SUBTRACT_15");
  };
  const progress = timer ? Math.min(1, remainingMs / (timer.configuredSeconds * 1000)) : 0;
  const contextValue = useMemo(() => ({ begin }), [begin]);

  return <TimerContext.Provider value={contextValue}>{children}{timer && <>
    {!overlay && <button type="button" onClick={() => setOverlay(true)} className="fixed inset-x-4 bottom-20 z-50 mx-auto flex min-h-14 max-w-md items-center gap-3 rounded-2xl bg-foreground px-4 text-left text-white shadow-xl sm:bottom-5" aria-label={`Open rest timer, ${formatTimer(remainingMs)} remaining`}><TimerReset className="size-5 text-primary" /><span className="flex-1"><span className="block text-xs text-white/70">Rest after {timer.exerciseName} · Set {timer.completedSetNumber}</span><span className="text-lg font-semibold tabular-nums">{formatTimer(remainingMs)}</span></span><Maximize2 className="size-4" /></button>}
    {overlay && <div className="fixed inset-0 z-[60] grid place-items-center bg-foreground/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="rest-timer-title"><section className="w-full max-w-sm rounded-[2rem] bg-card p-6 text-center shadow-2xl"><div className="flex items-start justify-between text-left"><div><p className="text-sm font-semibold text-primary">Rest timer</p><h2 id="rest-timer-title" className="mt-1 text-lg font-semibold">{timer.exerciseName} · Set {timer.completedSetNumber}</h2></div><button type="button" onClick={() => setOverlay(false)} className="grid size-10 place-items-center rounded-full bg-muted" aria-label="Collapse rest timer"><X className="size-5" /></button></div><div className="relative mx-auto mt-7 grid size-52 place-items-center"><svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--muted)" strokeWidth="8"/><circle cx="60" cy="60" r="52" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1-progress}/></svg><div><p className="text-5xl font-semibold tabular-nums">{formatTimer(remainingMs)}</p><p className="mt-2 text-sm text-muted-foreground">{timer.status === "PAUSED" ? "Paused" : "remaining"}</p></div></div><div className="mt-7 grid grid-cols-3 gap-2"><button disabled={busy} onClick={() => optimisticAdjust(-15)} className="min-h-12 rounded-xl border font-semibold">−15</button><button disabled={busy} onClick={() => void action(timer.status === "PAUSED" ? "RESUME" : "PAUSE")} className="grid min-h-12 place-items-center rounded-xl bg-primary text-white" aria-label={timer.status === "PAUSED" ? "Resume timer" : "Pause timer"}>{timer.status === "PAUSED" ? <Play /> : <Pause />}</button><button disabled={busy} onClick={() => optimisticAdjust(15)} className="min-h-12 rounded-xl border font-semibold">+15</button></div><button disabled={busy} onClick={() => void action("SKIP")} className="mt-3 inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold text-muted-foreground"><SkipForward className="size-4" />Skip rest</button><p className="mt-3 text-xs leading-5 text-muted-foreground">Sound and vibration are best effort while VicGym is open. A suspended PWA may not alert.</p></section></div>}
  </>}</TimerContext.Provider>;
}
