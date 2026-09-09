import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { getAuthEmailEnv } from "@/lib/env";
import { sendResendEmail } from "@/server/resend";

type NotificationLogger = Pick<Console, "error" | "info">;

function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function summary(profile: { goal: string | null; trainingDaysPerWeek: number | null; sessionLengthMinutes: number | null } | null) {
  return [profile?.goal?.toLowerCase().replaceAll("_", " "), profile?.trainingDaysPerWeek ? `${profile.trainingDaysPerWeek} days/week` : null, profile?.sessionLengthMinutes ? `${profile.sessionLengthMinutes}-minute sessions` : null].filter(Boolean).join(" · ") || "Personalised programme request";
}

async function notifyAdminOfProgrammeRequestUnsafe(prisma: PrismaClient, requestId: string, logger: NotificationLogger) {
  const env = getAuthEmailEnv();
  if (!env.ADMIN_EMAIL) { logger.info("Personalised programme admin notification skipped because ADMIN_EMAIL is not configured."); return false; }
  const request = await prisma.programmeRequest.findFirst({ where: { id: requestId, status: "PENDING", submittedNotificationSentAt: null }, include: { user: { select: { email: true, onboardingProfile: { select: { goal: true, trainingDaysPerWeek: true, sessionLengthMinutes: true } } } } } });
  if (!request) return false;
  const requestSummary = summary(request.user.onboardingProfile); const url = new URL(`/admin/requests/${request.id}`, env.APP_ORIGIN).toString();
  try {
    await sendResendEmail({ to: env.ADMIN_EMAIL, subject: "New VicGym personalised programme request", idempotencyKey: `programme-request-${request.id}-submitted`, text: `A new VicGym personalised programme request was submitted.\n\nUser: ${request.user.email}\nSubmitted: ${request.createdAt.toISOString()}\nSummary: ${requestSummary}\n\nReview: ${url}`, html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#17231b"><h1>New personalised programme request</h1><p><strong>User:</strong> ${escapeHtml(request.user.email)}</p><p><strong>Submitted:</strong> ${escapeHtml(request.createdAt.toISOString())}</p><p><strong>Summary:</strong> ${escapeHtml(requestSummary)}</p><p><a href="${escapeHtml(url)}">Open the secure VicGym admin review</a></p></div>` });
    await prisma.programmeRequest.updateMany({ where: { id: request.id, status: "PENDING", submittedNotificationSentAt: null }, data: { submittedNotificationSentAt: new Date() } }); return true;
  } catch (error) { logger.error("Personalised programme admin notification failed", { requestId, error: error instanceof Error ? error.message : "Unknown email error" }); return false; }
}

export async function notifyAdminOfProgrammeRequest(prisma: PrismaClient, requestId: string, logger: NotificationLogger = console) {
  try { return await notifyAdminOfProgrammeRequestUnsafe(prisma, requestId, logger); }
  catch (error) { logger.error("Personalised programme admin notification failed", { requestId, error: error instanceof Error ? error.message : "Unknown email error" }); return false; }
}

async function notifyUserProgrammeReadyUnsafe(prisma: PrismaClient, requestId: string, logger: NotificationLogger) {
  const env = getAuthEmailEnv();
  const request = await prisma.programmeRequest.findFirst({ where: { id: requestId, status: "COMPLETED", completedNotificationSentAt: null }, include: { user: { select: { email: true } } } });
  if (!request) return false;
  const url = new URL("/", env.APP_ORIGIN).toString();
  try {
    await sendResendEmail({ to: request.user.email, subject: "Your VicGym programme is ready", idempotencyKey: `programme-request-${request.id}-completed`, text: `Your personalised VicGym programme is ready and active.\n\nOpen VicGym: ${url}`, html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#17231b"><h1>Your VicGym programme is ready</h1><p>Your personalised programme has been created and activated.</p><p><a href="${escapeHtml(url)}">Open VicGym</a></p></div>` });
    await prisma.programmeRequest.updateMany({ where: { id: request.id, status: "COMPLETED", completedNotificationSentAt: null }, data: { completedNotificationSentAt: new Date() } }); return true;
  } catch (error) { logger.error("Personalised programme completion notification failed", { requestId, error: error instanceof Error ? error.message : "Unknown email error" }); return false; }
}

export async function notifyUserProgrammeReady(prisma: PrismaClient, requestId: string, logger: NotificationLogger = console) {
  try { return await notifyUserProgrammeReadyUnsafe(prisma, requestId, logger); }
  catch (error) { logger.error("Personalised programme completion notification failed", { requestId, error: error instanceof Error ? error.message : "Unknown email error" }); return false; }
}
