"use client";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
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

export function playTimerAlert(): boolean {
  try {
    const context = getAudioContext();
    if (!context || context.state !== "running") return false;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.08, context.currentTime);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    return true;
  } catch {
    return false;
  }
}

export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function vibrateTimerAlert(): boolean {
  if (!canVibrate()) return false;
  return navigator.vibrate([180, 80, 180]);
}
