import type { PrismaClient, Prisma } from "@/generated/prisma/client";

import { adjustedRemainingMilliseconds, remainingMilliseconds } from "@/lib/rest-timer";

type Db = PrismaClient | Prisma.TransactionClient;

export type RestTimerDto = {
  id: string;
  sessionId: string | null;
  setLogId: string;
  status: "RUNNING" | "PAUSED";
  configuredSeconds: number;
  startedAt: string;
  endsAt: string | null;
  pausedAt: string | null;
  pausedRemainingMs: number | null;
  updatedAt: string;
  exerciseName: string;
  completedSetNumber: number;
  nextSetId: string | null;
};

const activeTimerInclude = {
  setLog: { include: { exerciseSession: { include: { setLogs: { orderBy: { setNumber: "asc" as const } } } } } },
};

function timerDto(timer: Awaited<ReturnType<typeof findActiveRestTimer>>): RestTimerDto | null {
  if (!timer || (timer.status !== "RUNNING" && timer.status !== "PAUSED")) return null;
  return {
    id: timer.id,
    sessionId: timer.setLog.exerciseSession.workoutSessionId,
    setLogId: timer.setLogId,
    status: timer.status,
    configuredSeconds: timer.configuredSeconds,
    startedAt: timer.startedAt.toISOString(),
    endsAt: timer.endsAt?.toISOString() ?? null,
    pausedAt: timer.pausedAt?.toISOString() ?? null,
    pausedRemainingMs: timer.pausedRemainingMs ?? (timer.pausedRemainingSeconds === null ? null : timer.pausedRemainingSeconds * 1000),
    updatedAt: timer.updatedAt.toISOString(),
    exerciseName: timer.setLog.exerciseSession.exerciseNameSnapshot,
    completedSetNumber: timer.setLog.setNumber,
    nextSetId: timer.setLog.exerciseSession.setLogs.find((set) => set.setNumber > timer.setLog.setNumber && !set.completedAt)?.id ?? null,
  };
}

export async function findActiveRestTimer(db: Db) {
  return db.restPeriod.findFirst({ where: { status: { in: ["RUNNING", "PAUSED"] } }, orderBy: { createdAt: "desc" }, include: activeTimerInclude });
}

export async function getActiveRestTimer(db: Db): Promise<RestTimerDto | null> {
  return timerDto(await findActiveRestTimer(db));
}

export async function startRestForSet(db: Db, setLogId: string, now = new Date()): Promise<RestTimerDto | null> {
  const set = await db.setLog.findUnique({ where: { id: setLogId }, include: { exerciseSession: true } });
  if (!set?.exerciseSession.autoRest || set.exerciseSession.restSeconds <= 0) return null;
  await db.restPeriod.updateMany({ where: { status: { in: ["RUNNING", "PAUSED"] } }, data: { status: "SKIPPED", skippedAt: now, endsAt: null, pausedRemainingMs: null, pausedRemainingSeconds: null } });
  const timer = await db.restPeriod.upsert({
    where: { setLogId },
    create: { setLogId, status: "RUNNING", configuredSeconds: set.exerciseSession.restSeconds, startedAt: now, endsAt: new Date(now.getTime() + set.exerciseSession.restSeconds * 1000) },
    update: { status: "RUNNING", configuredSeconds: set.exerciseSession.restSeconds, startedAt: now, endsAt: new Date(now.getTime() + set.exerciseSession.restSeconds * 1000), pausedAt: null, pausedRemainingMs: null, pausedRemainingSeconds: null, completedAt: null, skippedAt: null },
    include: activeTimerInclude,
  });
  return timerDto(timer);
}

export type TimerAction = "ADD_15" | "SUBTRACT_15" | "PAUSE" | "RESUME" | "SKIP" | "COMPLETE";

export async function applyTimerAction(db: Db, id: string, action: TimerAction, now = new Date()): Promise<RestTimerDto | null> {
  const timer = await db.restPeriod.findUnique({ where: { id }, include: activeTimerInclude });
  if (!timer || (timer.status !== "RUNNING" && timer.status !== "PAUSED")) return null;
  const currentMs = timer.status === "PAUSED"
    ? (timer.pausedRemainingMs ?? (timer.pausedRemainingSeconds ?? 0) * 1000)
    : remainingMilliseconds(timer.endsAt, now.getTime());
  let data: Prisma.RestPeriodUpdateInput;

  if (action === "SKIP") data = { status: "SKIPPED", skippedAt: now, endsAt: null };
  else if (action === "COMPLETE") {
    if (currentMs > 1000) return timerDto(timer);
    data = { status: "COMPLETED", completedAt: now, endsAt: null, pausedRemainingMs: null, pausedRemainingSeconds: null };
  } else if (action === "PAUSE") {
    if (timer.status !== "RUNNING") return timerDto(timer);
    data = { status: "PAUSED", pausedAt: now, endsAt: null, pausedRemainingMs: currentMs, pausedRemainingSeconds: Math.ceil(currentMs / 1000) };
  } else if (action === "RESUME") {
    if (timer.status !== "PAUSED") return timerDto(timer);
    data = { status: "RUNNING", endsAt: new Date(now.getTime() + currentMs), pausedAt: null, pausedRemainingMs: null, pausedRemainingSeconds: null };
  } else {
    const adjustment = action === "ADD_15" ? 15 : -15;
    const nextMs = adjustedRemainingMilliseconds(currentMs, adjustment);
    if (nextMs === 0) data = { status: "COMPLETED", completedAt: now, endsAt: null, pausedRemainingMs: null, pausedRemainingSeconds: null };
    else if (timer.status === "PAUSED") data = { pausedRemainingMs: nextMs, pausedRemainingSeconds: Math.ceil(nextMs / 1000), adjustments: [...(Array.isArray(timer.adjustments) ? timer.adjustments : []), { seconds: adjustment, at: now.toISOString() }] };
    else data = { endsAt: new Date(now.getTime() + nextMs), adjustments: [...(Array.isArray(timer.adjustments) ? timer.adjustments : []), { seconds: adjustment, at: now.toISOString() }] };
  }

  const updated = await db.restPeriod.update({ where: { id }, data, include: activeTimerInclude });
  return timerDto(updated);
}
