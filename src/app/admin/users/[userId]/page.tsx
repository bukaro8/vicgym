import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentUser } from "@/server/auth";
import { coachingTarget, adminCoachReport, CoachingTargetError } from "@/server/admin-coaching";
import { getPrisma } from "@/lib/prisma";
import { getActiveProgramme } from "@/server/active-programme";
import { formatStoredCoachBrief } from "@/server/admin-programme-requests";
import { getProgressDashboard } from "@/server/progress-dashboard";
import { ReviewWorkflow } from "@/components/review-workflow";
import { formatLoad } from "@/lib/load-tracking";
import { effortLabel } from "@/lib/set-effort";
import { completedWorkoutDurationMinutes } from "@/lib/workout-duration";

export const dynamic = "force-dynamic";
const tabs = ["Profile", "Coach Review", "Programme", "History"] as const;
const tabSlug = (tab: string) => tab.toLowerCase().replace(" ", "-");
const date = (value: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }).format(value);

export default async function AdminUserProfile({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const actor = await requireCurrentUser();
  if (actor.role !== "ADMIN") redirect("/");
  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) notFound();
  const db = getPrisma();
  const target = await coachingTarget(db, actor, userId).catch((error) => { if (error instanceof CoachingTargetError) notFound(); throw error; });
  const requested = (await searchParams).tab;
  const tab = tabs.find((item) => tabSlug(item) === requested) ?? "Profile";
  const base = `/admin/users/${target.id}`;
  const program = await getActiveProgramme(db, target.id);
  const profile = tab === "Profile" ? await db.onboardingProfile.findUnique({ where: { userId: target.id } }) : null;
  const progress = tab === "Profile" ? await getProgressDashboard(db, target.id, "month") : null;
  const review = tab === "Coach Review" ? await adminCoachReport(db, actor, target.id) : null;
  const versions = tab === "Programme" ? await db.programVersion.findMany({ where: { program: { userId: target.id } }, orderBy: { createdAt: "desc" }, take: 8, include: { program: { select: { name: true } }, days: { orderBy: { rotationOrder: "asc" }, include: { workoutExercises: { orderBy: { position: "asc" }, include: { exercise: { select: { name: true, slug: true } } } } } } } }) : [];
  const workouts = tab === "History" ? await db.workoutSession.findMany({ where: { userId: target.id, status: "COMPLETED", completedAt: { not: null } }, orderBy: { completedAt: "desc" }, take: 10, include: { programVersion: { select: { versionNumber: true } }, exerciseSessions: { orderBy: { position: "asc" }, include: { setLogs: { where: { completedAt: { not: null } }, orderBy: { setNumber: "asc" } } } } } }) : [];
  return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8">
    <Link href="/admin/users" className="text-sm font-semibold text-primary">← Back to users</Link>
    <h1 className="mt-4 break-words text-2xl font-semibold">{target.email}</h1><p className="mt-1 text-sm text-muted-foreground">{target.status === "ACTIVE" ? "Active account" : "Disabled account"} · Trainer profile</p>
    <nav aria-label="User coaching sections" className="mt-5 grid grid-cols-4 gap-1 rounded-xl border bg-card p-1">{tabs.map((item) => <Link key={item} href={`${base}?tab=${tabSlug(item)}`} aria-current={tab === item ? "page" : undefined} className={`flex min-h-11 items-center justify-center rounded-lg px-1 text-center text-sm font-semibold ${tab === item ? "bg-primary text-white" : "text-muted-foreground"}`}>{item}</Link>)}</nav>
    <section className="mt-5 rounded-2xl border bg-card p-4"><h2 className="font-semibold">Active programme</h2><p className="mt-1 text-sm">{program ? `${program.name} · version ${program.activeVersion?.versionNumber}` : "No active programme"}</p><Link href={`${base}?tab=coach-review`} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">Generate Coach Report / propose changes</Link></section>
    {tab === "Profile" && <><section className="mt-5 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">Coach Brief</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{formatStoredCoachBrief(profile)}</p>{profile?.limitationAreas.length ? <p className="mt-2 text-sm">Reported areas: {profile.limitationAreas.join(", ").toLowerCase().replaceAll("_", " ")}</p> : null}<p className="mt-3 text-xs text-muted-foreground">Free-text answers are shown as stored. No separate trainer-notes field exists.</p></section>{progress && <section className="mt-5 rounded-2xl border bg-card p-5"><h2 className="font-semibold">Last 30 days</h2><p className="mt-2 text-sm">{progress.totals.workouts} workouts · {progress.totals.sets} sets · {progress.totals.minutes} min</p><p className="mt-1 text-sm">This week: {progress.consistency.completed}{progress.consistency.target ? ` / ${progress.consistency.target} target` : ""} workouts</p></section>}</>}
    {tab === "Coach Review" && (review ? <ReviewWorkflow key={target.id} initialReview={review} apiBase={`/api/admin/users/${target.id}/review`} targetEmail={target.email} canApply={target.status === "ACTIVE"}/> : <p className="mt-5 rounded-2xl border bg-card p-4">This account is disabled. Reactivate it before proposing programme changes. Its profile, programme and history remain available.</p>)}
    {tab === "Programme" && <section className="mt-5 space-y-3"><h2 className="text-lg font-semibold">Recent immutable versions</h2><Link href={`${base}?tab=coach-review`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">Paste JSON to preview a new version →</Link>{!versions.length && <p>No programme versions yet.</p>}{versions.map((version) => <details key={version.id} className="rounded-2xl border bg-card p-4" open={version.id === program?.activeVersionId}><summary className="cursor-pointer font-semibold">{version.program.name} · v{version.versionNumber}{version.id === program?.activeVersionId ? " · Active" : ""}<span className="mt-1 block text-xs font-normal text-muted-foreground">{date(version.createdAt)}</span></summary>{version.days.map((day) => <div key={day.id} className="mt-4"><h3 className="font-semibold">{day.name} [{day.slug}]</h3><ol className="mt-2 space-y-2">{day.workoutExercises.map((item) => <li key={item.id} className="rounded-xl bg-background p-3 text-sm">{item.position}. {item.exercise.name}<span className="mt-1 block text-xs text-muted-foreground">{item.sets} × {item.targetReps} · {formatLoad(item.loadTrackingTypeSnapshot, item.loadEntryModeSnapshot, item.plannedLoadValue === null ? null : Number(item.plannedLoadValue), { legacyWeightKg: item.plannedWeightKg === null ? null : Number(item.plannedWeightKg) })} · rest {item.restSeconds}s · auto-rest {item.autoRest ? "on" : "off"}</span></li>)}</ol></div>)}</details>)}</section>}
    {tab === "History" && <section className="mt-5 space-y-3"><h2 className="text-lg font-semibold">Recent completed workouts</h2>{!workouts.length && <p>No completed workouts yet.</p>}{workouts.map((workout) => <details key={workout.id} className="rounded-2xl border bg-card p-4"><summary className="cursor-pointer font-semibold">{workout.workoutDayNameSnapshot}<span className="mt-1 block text-xs font-normal text-muted-foreground">{date(workout.completedAt!)} · v{workout.programVersion.versionNumber} · {completedWorkoutDurationMinutes(workout) ?? 0} min</span></summary>{workout.exerciseSessions.map((exercise) => <div key={exercise.id} className="mt-4"><h3 className="font-semibold">{exercise.exerciseNameSnapshot}{exercise.isAdHoc ? " · Extra" : ""}</h3><p className="text-xs text-muted-foreground">Configured rest {exercise.restSeconds}s</p>{exercise.setLogs.map((set) => <p key={set.id} className="mt-1 text-sm">Set {set.setNumber}: {formatLoad(exercise.loadTrackingTypeSnapshot, exercise.loadEntryModeSnapshot, set.loadValue === null ? null : Number(set.loadValue), { legacyWeightKg: set.weightKg === null ? null : Number(set.weightKg) })} × {set.actualReps ?? "unrecorded"} / {set.targetReps} target · {set.effort ? effortLabel[set.effort] : "Unrated"}{set.notes ? ` · ${set.notes}` : ""}</p>)}</div>)}</details>)}</section>}
  </main>;
}
