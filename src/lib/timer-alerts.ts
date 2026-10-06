"use client";

let audioContext: AudioContext | null = null;
let activeAlert: { oscillators: OscillatorNode[]; timeout: ReturnType<typeof setTimeout>; vibrates: boolean } | null = null;

// Three 120 ms pulses, a 500 ms group pause, then three more pulses.
// Within each group the quiet gap is 100 ms. Total duration: 1620 ms.
export const ALERT_BEEP_STARTS_MS = [0, 220, 440, 1060, 1280, 1500] as const;
export const ALERT_BEEP_DURATION_MS = 120;
export const ALERT_DURATION_MS = 1620;
export const ALERT_VIBRATION_PATTERN = [120, 100, 120, 100, 120, 500, 120, 100, 120, 100, 120] as const;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  audioContext ??= new AudioContext();
  return audioContext;
}

export async function prepareTimerSound(): Promise<boolean> {
  try {
    const context = getAudioContext();
    if (!context) return false;
    if (context.state === "suspended") await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Stop a previous alert when a new rest period starts or this provider unmounts. */
export function cancelTimerAlert(): void {
  const active = activeAlert;
  if (!active) return;
  activeAlert = null;
  clearTimeout(active.timeout);
  for (const oscillator of active.oscillators) {
    try { oscillator.stop(); } catch { /* An already stopped oscillator needs no cleanup. */ }
    oscillator.disconnect();
  }
  if (active.vibrates && canVibrate()) {
    try { navigator.vibrate(0); } catch { /* Alert cleanup must not interrupt a new timer. */ }
  }
}

/** Both alert channels are best effort; a restricted channel never blocks the other. */
export function startTimerAlert(options: { sound: boolean; vibration: boolean }): boolean {
  if (activeAlert) return false;
  const oscillators: OscillatorNode[] = [];
  let vibrates = false;
  try {
    const context = options.sound ? getAudioContext() : null;
    if (context?.state === "running") {
      const base = context.currentTime;
      for (const offset of ALERT_BEEP_STARTS_MS) {
        const start = base + offset / 1000;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillators.push(oscillator);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, start);
        gain.gain.setValueAtTime(0.08, start);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + ALERT_BEEP_DURATION_MS / 1000);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
    }
  } catch {
    // Web Audio may be blocked or unavailable; vibration can still run.
    for (const oscillator of oscillators) {
      try { oscillator.stop(); } catch { /* The oscillator may not have started. */ }
      oscillator.disconnect();
    }
    oscillators.length = 0;
  }
  if (options.vibration && canVibrate()) {
    try { vibrates = navigator.vibrate([...ALERT_VIBRATION_PATTERN]); } catch { /* Vibration is optional. */ }
  }
  if (!oscillators.length && !vibrates) return false;
  const timeout = setTimeout(() => { activeAlert = null; }, ALERT_DURATION_MS);
  activeAlert = { oscillators, timeout, vibrates };
  return true;
}
