import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { getAuthEmailEnv } from "@/lib/env";
import { composeWelcomeEmailText } from "@/lib/welcome-email";
import type { AuthenticatedUser } from "@/server/auth";
import { assertAdminUser } from "@/server/auth";
import { sendResendEmail } from "@/server/resend";

type NotificationLogger = Pick<Console, "error" | "info">;

function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function summary(profile: { goal: string | null; trainingDaysPerWeek: number | null; sessionLengthMinutes: number | null } | null) {
  return [profile?.goal?.toLowerCase().replaceAll("_", " "), profile?.trainingDaysPerWeek ? `${profile.trainingDaysPerWeek} days/week` : null, profile?.sessionLengthMinutes ? `${profile.sessionLengthMinutes}-minute sessions` : null].filter(Boolean).join(" · ") || "Personalised programme request";
}

type ProgrammeReadyEmailInput = {
  programmeName: string;
  trainingDayCount: number | null;
  goal: string | null;
  trainingDaysPerWeek: number | null;
  sessionLengthMinutes: number | null;
  cardioPreference: string | null;
  url: string;
};

function goalLabel(goal: string | null) { return goal === "LOSE_FAT" ? "lose fat" : goal === "BUILD_MUSCLE" ? "build muscle" : goal === "GENERAL_FITNESS" ? "general fitness" : null; }
function cardioLabel(preference: string | null) { return preference === "MINIMAL" ? "minimal cardio" : preference === "SOME" ? "some cardio" : preference === "ENJOYS_CARDIO" ? "cardio as an enjoyable part of training" : null; }

export function buildProgrammeReadyEmail(input: ProgrammeReadyEmailInput) {
  const goal = goalLabel(input.goal);
  const details = [
    goal ? `Goal: ${goal}` : null,
    input.trainingDaysPerWeek ? `Training frequency: ${input.trainingDaysPerWeek} days per week` : null,
    input.sessionLengthMinutes ? `Preferred session length: ${input.sessionLengthMinutes} minutes` : null,
    cardioLabel(input.cardioPreference) ? `Cardio preference: ${cardioLabel(input.cardioPreference)}` : null,
  ].filter((value): value is string => Boolean(value));
  const purpose = [
    goal ? `your goal of ${goal}` : "your stated goal",
    input.trainingDaysPerWeek ? `your availability for ${input.trainingDaysPerWeek} training days each week` : "your weekly availability",
    input.sessionLengthMinutes ? `your preference for ${input.sessionLengthMinutes}-minute sessions` : "your preferred session length",
  ].join(", ");
  const daySentence = input.trainingDayCount === null ? "" : ` It contains ${input.trainingDayCount} training day${input.trainingDayCount === 1 ? "" : "s"}.`;
  const text = [
    "Hi,",
    "",
    `Your programme, ${input.programmeName}, is ready in VicGym.`,
    "",
    `I created this routine around ${purpose}.${daySentence}`,
    "",
    ...details,
    "",
    "Use the first few workouts to establish comfortable working loads and record how each set goes. Your future Coach Reviews can then use your actual reps and loads to refine progression.",
    "",
    `Open your programme: ${input.url}`,
  ].join("\n");
  const detailItems = details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("");
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#17231b;max-width:620px"><h1 style="font-size:26px">Your VicGym programme is ready</h1><p>Hi,</p><p>Your programme, <strong>${escapeHtml(input.programmeName)}</strong>, is ready in VicGym.</p><p>I created this routine around ${escapeHtml(purpose)}.${escapeHtml(daySentence)}</p>${detailItems ? `<ul>${detailItems}</ul>` : ""}<p>Use the first few workouts to establish comfortable working loads and record how each set goes. Your future Coach Reviews can then use your actual reps and loads to refine progression.</p><p><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#3fa66a;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">Open VicGym</a></p></div>`;
  return { subject: "Your VicGym programme is ready", text, html };
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
  const request = await prisma.programmeRequest.findFirst({ where: { id: requestId, status: "COMPLETED", completedNotificationSentAt: null }, select: { id: true, user: { select: { email: true, onboardingProfile: { select: { goal: true, trainingDaysPerWeek: true, sessionLengthMinutes: true, cardioPreference: true } }, settings: { select: { activeProgram: { select: { name: true, activeVersion: { select: { _count: { select: { days: true } } } } } } } } } } } });
  if (!request) return false;
  const url = new URL("/", env.APP_ORIGIN).toString();
  const profile = request.user.onboardingProfile;
  const programme = request.user.settings?.activeProgram;
  const email = buildProgrammeReadyEmail({ programmeName: programme?.name ?? "Your personalised programme", trainingDayCount: programme?.activeVersion?._count.days ?? null, goal: profile?.goal ?? null, trainingDaysPerWeek: profile?.trainingDaysPerWeek ?? null, sessionLengthMinutes: profile?.sessionLengthMinutes ?? null, cardioPreference: profile?.cardioPreference ?? null, url });
  try {
    await sendResendEmail({ to: request.user.email, ...email, idempotencyKey: `programme-request-${request.id}-completed` });
    await prisma.programmeRequest.updateMany({ where: { id: request.id, status: "COMPLETED", completedNotificationSentAt: null }, data: { completedNotificationSentAt: new Date() } }); return true;
  } catch (error) { logger.error("Personalised programme completion notification failed", { requestId, error: error instanceof Error ? error.message : "Unknown email error" }); return false; }
}

export async function notifyUserProgrammeReady(prisma: PrismaClient, requestId: string, logger: NotificationLogger = console) {
  try { return await notifyUserProgrammeReadyUnsafe(prisma, requestId, logger); }
  catch (error) { logger.error("Personalised programme completion notification failed", { requestId, error: error instanceof Error ? error.message : "Unknown email error" }); return false; }
}

export class ProgrammeWelcomeEmailError extends Error {}

export async function sendProgrammeWelcomeEmail(
  prisma: PrismaClient,
  actor: AuthenticatedUser,
  requestId: string,
  draftBody: string,
  logger: NotificationLogger = console,
) {
  assertAdminUser(actor);
  const env = getAuthEmailEnv();
  const request = await prisma.programmeRequest.findFirst({
    where: { id: requestId, status: "COMPLETED", welcomeEmailSentAt: null },
    select: { id: true, user: { select: { email: true, settings: { select: { activeProgram: { select: { name: true } } } } } }, createdProgram: { select: { name: true } } },
  });
  const programme = request?.createdProgram ?? request?.user.settings?.activeProgram;
  if (!request || !programme) throw new ProgrammeWelcomeEmailError("This welcome email was already sent or the programme request is not ready.");
  const appUrl = new URL("/", env.APP_ORIGIN).toString();
  const text = composeWelcomeEmailText(draftBody, appUrl);
  const paragraphs = draftBody.trim().split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#17231b;max-width:620px">${paragraphs}<p><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#3fa66a;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">Open VicGym</a></p></div>`;
  try {
    await sendResendEmail({ to: request.user.email, subject: "Your VicGym programme is ready", text, html, idempotencyKey: `programme-request-${request.id}-welcome` });
  } catch (error) {
    logger.error("Personalised programme welcome email failed", { requestId, error: error instanceof Error ? error.message : "Unknown email error" });
    throw new ProgrammeWelcomeEmailError("The welcome email could not be sent. The programme remains active; please try again.");
  }
  const recorded = await prisma.programmeRequest.updateMany({ where: { id: request.id, status: "COMPLETED", welcomeEmailSentAt: null }, data: { welcomeEmailSentAt: new Date(), welcomeEmailBody: text } });
  if (recorded.count !== 1) throw new ProgrammeWelcomeEmailError("The welcome email was sent, but its status could not be recorded. Retry is protected by the email idempotency key.");
  return { sent: true, text, programmeName: programme.name };
}
