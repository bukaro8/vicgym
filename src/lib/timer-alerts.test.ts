import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ALERT_BEEP_DURATION_MS, ALERT_BEEP_STARTS_MS, ALERT_DURATION_MS, ALERT_VIBRATION_PATTERN, cancelTimerAlert, startTimerAlert } from "@/lib/timer-alerts";

const sound = { sound: true, vibration: true };
const oscillators: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
const vibrate = vi.fn<(pattern: number[] | number) => boolean>(() => true);

beforeEach(() => {
  vi.useFakeTimers();
  oscillators.length = 0;
  vibrate.mockClear();
  vi.stubGlobal("AudioContext", class {
    currentTime = 10;
    state = "running";
    destination = {};
    createOscillator() {
      const oscillator = { type: "sine", frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null };
      oscillators.push(oscillator);
      return oscillator;
    }
    createGain() { return { gain: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }; }
  });
  vi.stubGlobal("navigator", { ...navigator, vibrate });
});

afterEach(() => {
  cancelTimerAlert();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("rest completion alert", () => {
  it("schedules exactly six matching beeps and one bounded vibration pattern", () => {
    expect(startTimerAlert(sound)).toBe(true);
    expect(oscillators).toHaveLength(6);
    expect(oscillators.map((oscillator) => oscillator.start.mock.calls[0][0])).toEqual(ALERT_BEEP_STARTS_MS.map((ms) => 10 + ms / 1000));
    oscillators.forEach((oscillator, index) => expect(oscillator.stop.mock.calls[0][0]).toBeCloseTo(10 + (ALERT_BEEP_STARTS_MS[index] + ALERT_BEEP_DURATION_MS) / 1000));
    expect(vibrate).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith([...ALERT_VIBRATION_PATTERN]);
    expect(ALERT_VIBRATION_PATTERN.reduce((sum, ms) => sum + ms, 0)).toBe(ALERT_DURATION_MS);
  });

  it("rejects close completions and permits a later timer after the pattern ends", () => {
    expect(startTimerAlert(sound)).toBe(true);
    expect(startTimerAlert(sound)).toBe(false);
    expect(oscillators).toHaveLength(6);
    expect(vibrate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(ALERT_DURATION_MS);
    expect(startTimerAlert(sound)).toBe(true);
    expect(oscillators).toHaveLength(12);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it("cancels scheduled sound and vibration before a new timer", () => {
    startTimerAlert(sound);
    cancelTimerAlert();
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length >= 2)).toBe(true);
    expect(vibrate).toHaveBeenLastCalledWith(0);
    expect(startTimerAlert(sound)).toBe(true);
    expect(oscillators).toHaveLength(12);
  });

  it("can reset for another timer when vibration cancellation is blocked", () => {
    startTimerAlert(sound);
    vibrate.mockImplementationOnce(() => { throw new Error("Vibration restricted"); });
    expect(() => cancelTimerAlert()).not.toThrow();
    expect(startTimerAlert({ sound: true, vibration: false })).toBe(true);
  });

  it("plays whichever channel the browser permits", async () => {
    vi.resetModules();
    vi.stubGlobal("AudioContext", class { state = "suspended"; });
    const restricted = await import("@/lib/timer-alerts");
    expect(restricted.startTimerAlert(sound)).toBe(true);
    expect(oscillators).toHaveLength(0);
    expect(vibrate).toHaveBeenCalledOnce();
    restricted.cancelTimerAlert();
    vi.stubGlobal("navigator", { vibrate: undefined });
    expect(restricted.startTimerAlert({ sound: false, vibration: true })).toBe(false);
  });
});
