"use client";

import { BellRing, Vibrate, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import { canVibrate, playTimerAlert, prepareTimerSound, vibrateTimerAlert } from "@/lib/timer-alerts";

type TimerSettings = { soundEnabled: boolean; vibrationEnabled: boolean };
const initialSettings: TimerSettings = { soundEnabled: false, vibrationEnabled: false };

export function TimerAlertSettings() {
  const [settings, setSettings] = useState<TimerSettings>(initialSettings);
  const [vibrationSupported, setVibrationSupported] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supported = canVibrate();
    fetch("/api/settings/timer-alerts", { cache: "no-store" }).then((response) => response.ok ? response.json() : initialSettings).then((data: TimerSettings) => { setVibrationSupported(supported); setSettings(data); }).catch(() => { setVibrationSupported(supported); setStatus("Timer alert settings could not be loaded."); });
  }, []);

  async function save(next: TimerSettings) {
    setSaving(true);
    setStatus("");
    try {
      if (next.soundEnabled && !await prepareTimerSound()) { setStatus("Sound could not be enabled by this browser."); return; }
      const response = await fetch("/api/settings/timer-alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSettings(data);
      setStatus("Saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Timer alert settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function testAlert() {
    setStatus("");
    const sounded = settings.soundEnabled && await prepareTimerSound() ? playTimerAlert() : false;
    const vibrated = settings.vibrationEnabled ? vibrateTimerAlert() : false;
    setStatus(sounded || vibrated ? "Test alert sent." : "Enable an available alert first, then try again.");
  }

  return <section className="rounded-2xl border bg-card p-4" aria-labelledby="timer-alert-settings"><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-accent text-primary"><BellRing className="size-5" /></span><div><h2 id="timer-alert-settings" className="font-semibold">Rest-timer alerts</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Alerts work best while VicGym stays open.</p></div></div><div className="mt-4 space-y-3"><label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-muted/50 px-3"><span className="flex items-center gap-2 text-sm font-medium"><Volume2 className="size-4 text-primary" />Sound</span><input aria-label="Enable timer sound" type="checkbox" checked={settings.soundEnabled} disabled={saving} onChange={(event) => void save({ ...settings, soundEnabled: event.target.checked })} className="size-5 accent-primary" /></label><label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-muted/50 px-3"><span><span className="flex items-center gap-2 text-sm font-medium"><Vibrate className="size-4 text-primary" />Vibration</span>{!vibrationSupported && <span className="mt-0.5 block text-xs text-muted-foreground">Not supported by this browser/device.</span>}</span><input aria-label="Enable timer vibration" type="checkbox" checked={settings.vibrationEnabled} disabled={saving || !vibrationSupported} onChange={(event) => void save({ ...settings, vibrationEnabled: event.target.checked })} className="size-5 accent-primary" /></label></div><button type="button" onClick={() => void testAlert()} disabled={saving} className="mt-4 min-h-11 rounded-xl border px-4 text-sm font-semibold">Test alert</button>{status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}<p className="mt-3 text-xs leading-5 text-muted-foreground">iPhone and iPad browsers do not support web vibration. Sound and vibration cannot be guaranteed while the PWA is suspended or the device is in a restricted mode.</p></section>;
}
