export function cardioDurationSeconds(startedAt: string | Date, stoppedAt: string | Date): number {
  return Math.max(0, Math.floor((new Date(stoppedAt).getTime() - new Date(startedAt).getTime()) / 1000));
}

export function cardioElapsedSeconds(input: { startedAt: string | Date | null | undefined; stoppedAt: string | Date | null | undefined; durationSeconds?: number | null }, now = Date.now()): number {
  if (!input.startedAt) return 0;
  if (input.stoppedAt) return input.durationSeconds ?? cardioDurationSeconds(input.startedAt, input.stoppedAt);
  return Math.max(0, Math.floor((now - new Date(input.startedAt).getTime()) / 1000));
}

export function formatCardioDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
