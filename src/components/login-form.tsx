"use client";

import { Mail, Send } from "lucide-react";
import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/magic-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The sign-in email could not be sent.");
      setSent(true);
    } catch (value) { setError(value instanceof Error ? value.message : "The sign-in email could not be sent."); }
    finally { setBusy(false); }
  }

  if (sent) return <div className="rounded-3xl border bg-card p-6 text-center shadow-sm"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-primary"><Mail className="size-7"/></span><h2 className="mt-4 text-xl font-semibold">Check your email</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">If <strong>{email}</strong> is allowed, its single-use sign-in link will arrive shortly and remain valid for 15 minutes.</p><button type="button" onClick={() => setSent(false)} className="mt-5 text-sm font-semibold text-primary">Use another email</button></div>;

  return <form onSubmit={submit} className="rounded-3xl border bg-card p-6 shadow-sm"><label className="text-sm font-semibold">Email address<input type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 min-h-12 w-full rounded-2xl border bg-background px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"/></label>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}<button type="submit" disabled={busy} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"><Send className="size-4"/>{busy ? "Sending…" : "Send magic link"}</button><p className="mt-4 text-center text-xs leading-5 text-muted-foreground">No password is required. The link expires and works once.</p></form>;
}
