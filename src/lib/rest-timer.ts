export type TimerStatus = "RUNNING" | "PAUSED" | "COMPLETED" | "SKIPPED";

export function remainingMilliseconds(endsAt: string | Date | null, now = Date.now()): number {
  if (!endsAt) return 0;
  return Math.max(0, new Date(endsAt).getTime() - now);
}

export function adjustedRemainingMilliseconds(remainingMs: number, adjustmentSeconds: number): number {
  return Math.max(0, remainingMs + adjustmentSeconds * 1000);
}

export function formatTimer(milliseconds: number): string {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
