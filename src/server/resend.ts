import "server-only";

import { getAuthEmailEnv } from "@/lib/env";

export class ResendEmailError extends Error {
  constructor(
    public readonly status: number,
    public readonly providerCode: string | null,
    message: string,
  ) {
    super(message);
    this.name = "ResendEmailError";
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export async function sendMagicLinkEmail(input: { to: string; url: string; idempotencyKey: string }): Promise<void> {
  return sendResendEmail({ ...input, subject: "Sign in to VicGym", html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#17231b"><h1>Sign in to VicGym</h1><p>Use this secure link to sign in. It expires in 15 minutes and can only be used once.</p><p><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#3fa66a;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">Sign in to VicGym</a></p><p>If you did not request this email, you can ignore it.</p></div>`, text: `Sign in to VicGym\n\n${input.url}\n\nThis link expires in 15 minutes and can only be used once.` });
}

export async function sendResendEmail(input: { to: string; subject: string; html: string; text: string; idempotencyKey: string }): Promise<void> {
  const env = getAuthEmailEnv();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
      "User-Agent": "VicGym/0.1",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { name?: unknown; message?: unknown } | null;
    const providerCode = typeof body?.name === "string" ? body.name.slice(0, 100) : null;
    const providerMessage = typeof body?.message === "string" ? body.message.slice(0, 500) : "No provider message was returned";
    throw new ResendEmailError(response.status, providerCode, `Resend rejected the email (${response.status}${providerCode ? ` ${providerCode}` : ""}): ${providerMessage}`);
  }
}
