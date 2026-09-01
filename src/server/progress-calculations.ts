import { londonWeekRange } from "@/server/weekly-review";
import type { LoadEntryModeValue, LoadTrackingTypeValue } from "@/lib/load-tracking";

export const LONDON = "Europe/London";
export type ProgressPeriod = "4" | "8" | "12" | "all";

export type CompletedSet = { weightKg: number | null; loadValue: number | null; actualReps: number | null };
export type CompletedExerciseSession = {
  exerciseId: string;
  exerciseSlug: string;
  exerciseName: string;
  completedAt: Date;
  startedAt: Date;
  loadTrackingType: LoadTrackingTypeValue | null;
  loadEntryMode: LoadEntryModeValue | null;
  loadMultiplier: number;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  sets: CompletedSet[];
};

export type ExercisePerformance = {
  date: string;
  dateLabel: string;
  completedSets: number;
  reps: number[];
  loadTrackingType: LoadTrackingTypeValue | null;
  loadEntryMode: LoadEntryModeValue | null;
  highestLoadValue: number | null;
  highestWeightKg: number | null;
  highestMachineLevel: number | null;
  totalReps: number;
  volumeKgReps: number | null;
};

function dateParts(date: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(date).map((part) => [part.type, part.value]));
}

export function londonDate(date: Date): string {
  const value = dateParts(date);
  return `${value.year}-${value.month}-${value.day}`;
}

export function londonDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: LONDON, day: "numeric", month: "short", year: "numeric" }).format(date);
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function londonWeekStart(date: Date): string {
  const value = dateParts(date);
  const offset = Math.max(0, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(value.weekday));
  return addDays(`${value.year}-${value.month}-${value.day}`, -offset);
}

export function periodStart(period: ProgressPeriod, now = new Date()): Date | null {
  if (period === "all") return null;
  const weeks = Number(period);
  return londonWeekRange(addDays(londonWeekStart(now), -7 * (weeks - 1))).start;
}

export function isWeighted(loadTrackingType: LoadTrackingTypeValue | null, weightKg: number | null, loadValue: number | null): boolean {
  return loadTrackingType === "KILOGRAM" ? loadValue !== null : loadTrackingType === null && weightKg !== null;
}

export function setVolume(set: CompletedSet, loadTrackingType: LoadTrackingTypeValue | null, loadMultiplier: number): number | null {
  if (!isWeighted(loadTrackingType, set.weightKg, set.loadValue) || set.actualReps === null) return null;
  const kilograms = loadTrackingType === "KILOGRAM" ? set.loadValue : set.weightKg;
  return kilograms === null ? null : kilograms * set.actualReps * loadMultiplier;
}

export function performanceFromSession(session: CompletedExerciseSession): ExercisePerformance {
  const sets = session.sets.filter((set) => set.actualReps !== null);
  const loadValues = sets.map((set) => session.loadTrackingType === null ? set.weightKg : set.loadValue).filter((value): value is number => value !== null);
  const volumes = sets.map((set) => setVolume(set, session.loadTrackingType, session.loadMultiplier)).filter((value): value is number => value !== null);
  const highestLoadValue = loadValues.length ? Math.max(...loadValues) : null;
  return {
    date: londonDate(session.completedAt),
    dateLabel: londonDateLabel(session.completedAt),
    completedSets: sets.length,
    reps: sets.map((set) => set.actualReps!),
    loadTrackingType: session.loadTrackingType,
    loadEntryMode: session.loadEntryMode,
    highestLoadValue,
    highestWeightKg: session.loadTrackingType === "KILOGRAM" || session.loadTrackingType === null ? highestLoadValue : null,
    highestMachineLevel: session.loadTrackingType === "MACHINE_LEVEL" ? highestLoadValue : null,
    totalReps: sets.reduce((total, set) => total + set.actualReps!, 0),
    volumeKgReps: volumes.length ? volumes.reduce((total, value) => total + value, 0) : null,
  };
}

export function progressChange(current: ExercisePerformance, previous?: ExercisePerformance): string {
  if (!previous) return "insufficient history";
  if (current.loadTrackingType !== previous.loadTrackingType || current.loadEntryMode !== previous.loadEntryMode) return "insufficient compatible history";
  if (current.highestLoadValue !== null && previous.highestLoadValue !== null) {
    if (current.highestLoadValue > previous.highestLoadValue) return current.loadTrackingType === "MACHINE_LEVEL" ? "machine level increased" : "weight increased";
    if (current.highestLoadValue < previous.highestLoadValue) return current.loadTrackingType === "MACHINE_LEVEL" ? "machine level decreased" : "weight decreased";
    if (current.totalReps > previous.totalReps) return current.loadTrackingType === "MACHINE_LEVEL" ? "same machine level, more reps" : "same weight, more reps";
  }
  if (current.totalReps > previous.totalReps) return "improved total reps";
  return "same or lower recorded performance";
}

export function weeklyBuckets<T extends { completedAt: Date }>(items: T[], period: ProgressPeriod, now = new Date()): Array<{ weekStart: string; items: T[] }> {
  const newestWeek = londonWeekStart(now);
  const firstWeek = period === "all" ? (items.length ? londonWeekStart(items.reduce((earliest, item) => item.completedAt < earliest ? item.completedAt : earliest, items[0].completedAt)) : newestWeek) : addDays(newestWeek, -7 * (Number(period) - 1));
  const buckets: Array<{ weekStart: string; items: T[] }> = [];
  for (let week = firstWeek; week <= newestWeek; week = addDays(week, 7)) buckets.push({ weekStart: week, items: [] });
  const byWeek = new Map(buckets.map((bucket) => [bucket.weekStart, bucket]));
  for (const item of items) byWeek.get(londonWeekStart(item.completedAt))?.items.push(item);
  return buckets;
}
