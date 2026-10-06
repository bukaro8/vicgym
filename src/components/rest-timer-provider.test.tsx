import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RestTimerProvider } from "@/components/rest-timer-provider";
import type { RestTimerDto } from "@/server/rest-timers";

const mocks = vi.hoisted(() => ({ start: vi.fn(), cancel: vi.fn(), update: vi.fn(), getTimer: vi.fn(), getWorkout: vi.fn(), putTimer: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/timer-alerts", () => ({ startTimerAlert: mocks.start, cancelTimerAlert: mocks.cancel }));
vi.mock("@/lib/offline-db", () => ({ getActiveOfflineWorkout: mocks.getWorkout, getOfflineTimer: mocks.getTimer, putOfflineTimer: mocks.putTimer }));
vi.mock("@/lib/offline-sync", () => ({ syncOfflineMutations: mocks.sync }));
vi.mock("@/lib/offline-workout", () => ({ offlineTimerDto: vi.fn(), updateTimerLocally: mocks.update }));

function timer(id: string): RestTimerDto {
  return { id, sessionId: "session", setLogId: id, status: "RUNNING", configuredSeconds: 1, startedAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1_000).toISOString(), pausedAt: null, pausedRemainingMs: null, updatedAt: new Date().toISOString(), exerciseName: "Chest Press", completedSetNumber: 1, nextSetId: null };
}
function start(value: RestTimerDto) { act(() => window.dispatchEvent(new CustomEvent("vicgym:timer-started", { detail: { timer: value } }))); }
async function expire() { await act(async () => { vi.advanceTimersByTime(1_250); }); }

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-06T12:00:00Z")); vi.clearAllMocks();
  mocks.getWorkout.mockResolvedValue(null); mocks.getTimer.mockResolvedValue(null); mocks.update.mockResolvedValue(null); mocks.sync.mockResolvedValue("synced");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ timer: null, settings: { soundEnabled: true, vibrationEnabled: true } }), { status: 200 }));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("rest timer alert integration", () => {
  it.each(["open", "minimised"] as const)("alerts once when the timer expires with modal %s", async (mode) => {
    const view = render(<RestTimerProvider><div>Workout</div></RestTimerProvider>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    start(timer("rest-1"));
    expect(screen.getByRole("dialog", { name: "Chest Press · Set 1" })).toBeInTheDocument();
    if (mode === "minimised") {
      fireEvent.click(screen.getByRole("button", { name: "Collapse rest timer" }));
      expect(screen.getByRole("button", { name: /Open rest timer/ })).toBeInTheDocument();
    }
    await expire();
    expect(mocks.start).toHaveBeenCalledExactlyOnceWith({ sound: true, vibration: true });
    expect(mocks.update).toHaveBeenCalledWith("session", "COMPLETE");
    // A second tick cannot replay the completed timer's alert.
    await expire();
    expect(mocks.start).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it("resets alert state when a different timer starts in the same workout", async () => {
    const view = render(<RestTimerProvider><div>Workout</div></RestTimerProvider>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const first = timer("rest-1"); start(first); await expire();
    start(first); await expire();
    expect(mocks.start).toHaveBeenCalledTimes(1);
    start(timer("rest-2"));
    expect(mocks.cancel).toHaveBeenCalled();
    await expire();
    expect(mocks.start).toHaveBeenCalledTimes(2);
    view.unmount();
  });
});
