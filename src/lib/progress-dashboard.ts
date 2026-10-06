import { completedWorkoutDurationMinutes } from "@/lib/workout-duration";

export type DashboardRange = "week" | "month" | "6months" | "all";
export const dashboardRanges = [{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "6months", label: "6 months" }, { value: "all", label: "All" }] as const;
export function dashboardRange(value: unknown): DashboardRange { return dashboardRanges.some((range) => range.value === value) ? value as DashboardRange : "month"; }
export function localDay(date: Date): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function shiftDay(day: string, offset: number): string { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); }
export function monday(day: string): string { return shiftDay(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7)); }
export function rangeStart(range: DashboardRange, now: Date): string | null {
  const today = localDay(now);
  return range === "all" ? null : range === "week" ? monday(today) : range === "month" ? shiftDay(today, -29) : shiftDay(monday(today), -25 * 7);
}
export function londonMidnight(day: string): Date {
  const utc = new Date(`${day}T00:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(utc));
  return new Date(utc.getTime() - hour * 3_600_000);
}
export type DashboardSession = { status: string; startedAt: Date; completedAt: Date | null; cardioStoppedAt: Date | null; exerciseSessions: Array<{ setLogs: Array<{ completedAt: Date | null; actualReps: number | null }>; exercise: { muscles: Array<{ role: string; muscle: { slug: string } }> } }> };
export type ActivityBucket = { date: string; label: string; sets: number; workouts: number; minutes: number; reps: number };
const muscleGroups: Record<string, string> = {
  chest: "Chest", lats: "Back", "upper-back": "Back", "lower-back": "Back",
  "anterior-deltoids": "Shoulders", "lateral-deltoids": "Shoulders", "posterior-deltoids": "Shoulders",
  biceps: "Arms", triceps: "Arms", forearms: "Arms", abdominals: "Core", obliques: "Core",
  quadriceps: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves", "hip-flexors": "Hips", adductors: "Hips",
};
export const muscleGroupNames = ["Chest", "Back", "Shoulders", "Arms", "Core", "Quads", "Hamstrings", "Glutes", "Calves", "Hips"];

export function deriveDashboard(sessions: DashboardSession[], range: DashboardRange, now = new Date()) {
  const today = localDay(now); const start = rangeStart(range, now);
  const completed = sessions.filter((session) => session.status === "COMPLETED" && session.completedAt && session.completedAt <= now && (!start || localDay(session.completedAt) >= start));
  const earliest = completed.reduce((day, session) => localDay(session.completedAt!) < day ? localDay(session.completedAt!) : day, today);
  const months = (Number(today.slice(0, 4)) - Number(earliest.slice(0, 4))) * 12 + Number(today.slice(5, 7)) - Number(earliest.slice(5, 7));
  const unit = range === "all" ? (months >= 36 ? "year" : "month") : range === "6months" ? "week" : "day";
  const key = (day: string) => unit === "year" ? `${day.slice(0, 4)}-01-01` : unit === "month" ? `${day.slice(0, 7)}-01` : unit === "week" ? monday(day) : day;
  const first = key(start ?? earliest);
  const buckets = new Map<string, ActivityBucket>();
  for (let day = first; day <= today;) {
    const date = new Date(`${day}T12:00:00Z`);
    const label = new Intl.DateTimeFormat("en-GB", unit === "year" ? { year: "numeric", timeZone: "UTC" } : unit === "month" ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
    buckets.set(day, { date: day, label: unit === "week" ? `Week of ${label}` : label, sets: 0, workouts: 0, minutes: 0, reps: 0 });
    if (unit === "year") { date.setUTCFullYear(date.getUTCFullYear() + 1); day = date.toISOString().slice(0, 10); } else if (unit === "month") { date.setUTCMonth(date.getUTCMonth() + 1); day = date.toISOString().slice(0, 10); } else day = shiftDay(day, unit === "week" ? 7 : 1);
  }
  const muscles = new Map(muscleGroupNames.map((name) => [name, 0]));
  for (const session of completed) {
    const bucket = buckets.get(key(localDay(session.completedAt!)))!;
    bucket.workouts += 1; bucket.minutes += completedWorkoutDurationMinutes(session) ?? 0;
    for (const exercise of session.exerciseSessions) {
      const sets = exercise.setLogs.filter((set) => set.completedAt !== null);
      bucket.sets += sets.length; bucket.reps += sets.reduce((sum, set) => sum + (set.actualReps ?? 0), 0);
      const contributions = new Map<string, number>();
      for (const relation of exercise.exercise.muscles) {
        const group = muscleGroups[relation.muscle.slug] ?? "Other";
        const weight = relation.role === "PRIMARY" ? 1 : relation.role === "SECONDARY" ? 0.5 : 0;
        contributions.set(group, Math.max(contributions.get(group) ?? 0, weight));
      }
      for (const [group, weight] of contributions) muscles.set(group, (muscles.get(group) ?? 0) + sets.length * weight);
    }
  }
  const activity = [...buckets.values()];
  return { range, unit, activity, muscles: [...muscles].map(([name, value]) => ({ name, value })), totals: { workouts: completed.length, sets: activity.reduce((sum, item) => sum + item.sets, 0), minutes: activity.reduce((sum, item) => sum + item.minutes, 0) } };
}
