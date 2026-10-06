import { describe, expect, it } from "vitest";
import { dashboardRange, deriveDashboard, londonMidnight, rangeStart, type DashboardSession } from "./progress-dashboard";
import { muscleSeed } from "@/data/phase-2-catalogue";

const now = new Date("2026-10-07T12:00:00Z");
function workout(date = "2026-10-06", muscle = "chest"): DashboardSession {
  return { status: "COMPLETED", startedAt: new Date(`${date}T09:00:00Z`), completedAt: new Date(`${date}T20:00:00Z`), cardioStoppedAt: null, exerciseSessions: [{ setLogs: [{ completedAt: new Date(`${date}T09:30:00Z`), actualReps: 12 }, { completedAt: null, actualReps: 99 }], exercise: { muscles: [{ role: "PRIMARY", muscle: { slug: muscle } }, { role: "SECONDARY", muscle: { slug: "triceps" } }] } }] };
}
describe("visual progress analytics", () => {
  it("defaults to Month and handles empty and single-workout history", () => {
    expect(dashboardRange(undefined)).toBe("month"); expect(dashboardRange("bad")).toBe("month");
    expect(deriveDashboard([], "month", now).activity).toHaveLength(30);
    expect(deriveDashboard([], "month", now).totals).toEqual({ workouts: 0, sets: 0, minutes: 0 });
    expect(deriveDashboard([workout()], "month", now).totals).toEqual({ workouts: 1, sets: 1, minutes: 30 });
  });
  it("counts multiple sessions but excludes incomplete workouts, incomplete sets and future records", () => {
    const data = deriveDashboard([workout(), workout(), { ...workout(), status: "IN_PROGRESS" }, { ...workout(), completedAt: null }, workout("2026-10-08")], "week", now);
    expect(data.totals).toEqual({ workouts: 2, sets: 2, minutes: 60 });
    expect(data.activity.find((item) => item.date === "2026-10-06")).toMatchObject({ sets: 2, reps: 24, workouts: 2 });
  });
  it("uses daily, weekly, monthly and yearly buckets with range-specific muscle totals", () => {
    const sessions = [workout(), workout("2026-09-20", "quadriceps"), workout("2026-06-01", "hamstrings"), workout("2025-01-01", "glutes")];
    expect(deriveDashboard(sessions, "week", now).totals.workouts).toBe(1);
    expect(deriveDashboard(sessions, "month", now).totals.workouts).toBe(2);
    const six = deriveDashboard(sessions, "6months", now); expect(six.activity).toHaveLength(26); expect(six.totals.workouts).toBe(3);
    expect(deriveDashboard(sessions, "all", now).totals.workouts).toBe(4);
    expect(deriveDashboard(sessions, "all", now).unit).toBe("month");
    expect(deriveDashboard([workout("2020-01-01")], "all", now).unit).toBe("year");
    expect(deriveDashboard(sessions, "week", now).muscles.find((item) => item.name === "Quads")?.value).toBe(0);
    expect(deriveDashboard(sessions, "month", now).muscles.find((item) => item.name === "Quads")?.value).toBe(1);
  });
  it("weights muscle groups once per set and maps every current catalogue muscle", () => {
    const session = workout("2026-10-06", "lats");
    session.exerciseSessions[0].exercise.muscles.push({ role: "SECONDARY", muscle: { slug: "upper-back" } }, { role: "SECONDARY", muscle: { slug: "forearms" } });
    const data = deriveDashboard([session], "week", now);
    expect(data.muscles.find((item) => item.name === "Back")?.value).toBe(1);
    expect(data.muscles.find((item) => item.name === "Arms")?.value).toBe(0.5);
    const all = deriveDashboard(muscleSeed.map((muscle) => workout("2026-10-06", muscle.slug)), "week", now);
    expect(all.muscles.some((item) => item.name === "Other")).toBe(false);
  });
  it("counts sets equally regardless of load type", () => {
    const sessions = ["MACHINE_LEVEL", "KILOGRAM", "BODYWEIGHT", "REPS_ONLY"].map((loadTrackingType) => ({ ...workout(), loadTrackingType }));
    expect(deriveDashboard(sessions, "month", now).totals.sets).toBe(4);
  });
  it("uses London midnight and Monday boundaries across DST", () => {
    expect(londonMidnight("2026-07-01").toISOString()).toBe("2026-06-30T23:00:00.000Z");
    expect(londonMidnight("2026-12-01").toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(rangeStart("week", new Date("2026-10-04T23:30:00Z"))).toBe("2026-10-05");
  });
});
