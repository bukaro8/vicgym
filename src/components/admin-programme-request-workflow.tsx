"use client";

import { Check, ClipboardCopy, FileCheck2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { composeWelcomeEmailText } from "@/lib/welcome-email";
import type { ImportPreview } from "@/server/coach-import";

export function ProgrammePreview({ preview, ownerEmail }: { preview: ImportPreview; ownerEmail: string }) {
  return <div className="mt-5 rounded-2xl border bg-muted/50 p-4"><p className="text-sm font-semibold text-primary">Programme creation preview</p><h3 className="mt-1 text-lg font-semibold">{preview.programName}</h3><p className="mt-1 text-sm text-muted-foreground">{preview.days.length} training day{preview.days.length === 1 ? "" : "s"} · creates version 1 for {ownerEmail}</p><div className="mt-4 space-y-3">{preview.days.map((day) => <section key={day.slug} className="rounded-xl border bg-background p-3"><div className="flex items-baseline justify-between gap-3"><h4 className="font-semibold">{day.rotationOrder}. {day.name}</h4><span className="text-xs text-muted-foreground">{day.exerciseCount} exercises</span></div><ol className="mt-3 space-y-2">{day.exercises.map((exercise) => <li key={exercise.slug} className="rounded-lg bg-card p-3 text-sm"><p className="font-medium">{exercise.position}. {exercise.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{exercise.sets} sets × {exercise.targetReps} reps · {exercise.plannedLoad} · {exercise.restSeconds}s rest{exercise.autoRest ? " · auto rest" : ""}</p></li>)}</ol></section>)}</div></div>;
}

type Props = {
  requestId: string;
  coachBrief: string;
  aiPrompt: string;
  welcomeEmailPrompt?: string | null;
  welcomeEmailSentAt?: string | null;
  welcomeEmailBody?: string | null;
  appUrl?: string;
  requestStatus: "PENDING" | "COMPLETED" | "CANCELLED";
  ownerEmail: string;
};

export function AdminProgrammeRequestWorkflow(props: Props) {
  const { requestId, coachBrief, aiPrompt, welcomeEmailPrompt = null, appUrl = "/", requestStatus, ownerEmail } = props;
  const router = useRouter();
  const [copied, setCopied] = useState<"brief" | "programme" | "welcome" | null>(null);
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [reopened, setReopened] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailPreview, setEmailPreview] = useState<string | null>(null);
  const [emailApproved, setEmailApproved] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [sentAt, setSentAt] = useState(props.welcomeEmailSentAt ?? null);
  const [sentBody, setSentBody] = useState(props.welcomeEmailBody ?? null);
  const effectiveStatus = reopened ? "PENDING" : requestStatus;

  async function request(path: string, body: unknown) {
    const response = await fetch(`/api/admin/programme-requests/${requestId}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }
  async function copy(content: string, kind: "brief" | "programme" | "welcome") {
    try { await navigator.clipboard.writeText(content); setCopied(kind); window.setTimeout(() => setCopied(null), 2000); }
    catch { setError("The requested text could not be copied."); }
  }
  async function validate() { setError(""); setPreview(null); try { const data = await request("preview", { json }); setPreview(data.preview); setApproved(false); } catch (caught) { setError(caught instanceof Error ? caught.message : "Validation failed"); } }
  async function apply() { setError(""); try { await request("apply", { json, confirmation: "CREATE_REQUEST_PROGRAMME" }); setDone(true); setPreview(null); router.refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Apply failed"); } }
  async function cancel() { if (!window.confirm("Cancel this pending programme request?")) return; try { await request("cancel", {}); router.refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Cancel failed"); } }
  async function reopen() { setError(""); setReopening(true); try { await request("reopen", {}); setReopened(true); router.refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Reopen failed"); } finally { setReopening(false); } }
  function prepareEmailPreview() { setError(""); setEmailApproved(false); setEmailPreview(composeWelcomeEmailText(emailDraft, appUrl)); }
  async function sendWelcomeEmail() {
    setError(""); setEmailBusy(true);
    try {
      const result = await request("welcome-email", { body: emailDraft, confirmation: "SEND_WELCOME_EMAIL" });
      setSentAt(new Date().toISOString()); setSentBody(result.text); setEmailPreview(null); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Welcome email could not be sent"); }
    finally { setEmailBusy(false); }
  }

  return <div className="space-y-7">
    <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">Coach Brief export</h2><p className="mt-2 text-sm text-muted-foreground">Copy the readable reference, or copy the dedicated self-contained prompt when asking an AI to create VicGym JSON.</p><textarea readOnly value={coachBrief} aria-label="Coach Brief export" className="mt-4 min-h-96 w-full rounded-2xl border bg-background p-4 font-mono text-xs leading-5"/><div className="mt-3 flex flex-col gap-2 sm:flex-row"><button onClick={() => void copy(aiPrompt, "programme")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"><ClipboardCopy className="size-4"/>{copied === "programme" ? "AI prompt copied" : "Copy AI Programme Prompt"}</button><button onClick={() => void copy(coachBrief, "brief")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-semibold"><ClipboardCopy className="size-4"/>{copied === "brief" ? "Coach Brief copied" : "Copy Coach Brief"}</button></div></section>
    {effectiveStatus === "PENDING" && !done ? <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">Create programme for request owner</h2>{reopened && <p className="mt-2 rounded-xl bg-accent p-3 text-sm font-medium text-accent-foreground">Request reopened. It is pending again and ready for programme validation.</p>}<p className="mt-2 text-sm text-muted-foreground">Paste schemaVersion 2 JSON. Validation writes nothing and always targets {ownerEmail}.</p><textarea value={json} onChange={(event) => setJson(event.target.value)} aria-label="Programme JSON" className="mt-4 min-h-72 w-full rounded-2xl border bg-background p-4 font-mono text-xs"/><button disabled={!json.trim()} onClick={() => void validate()} className="mt-3 min-h-11 rounded-xl bg-foreground px-4 font-semibold text-white disabled:opacity-50">Validate programme</button>{error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}{preview && <><ProgrammePreview preview={preview} ownerEmail={ownerEmail}/><label className="mt-4 flex gap-3 rounded-xl border bg-card p-3 text-sm"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)}/><span>I reviewed every day and exercise and want to create and activate this programme for {ownerEmail}.</span></label><button disabled={!approved} onClick={() => void apply()} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"><FileCheck2 className="size-5"/>Create and activate programme</button></>}<button onClick={() => void cancel()} className="mt-8 text-sm font-semibold text-destructive">Cancel request</button></section> : effectiveStatus === "CANCELLED" ? <section className="rounded-3xl border bg-card p-5 text-sm shadow-sm"><p className="font-medium">This request is no longer actively pending review.</p><p className="mt-2 text-muted-foreground">Reopen it to paste, preview, and explicitly apply an initial programme for {ownerEmail}. Existing programme checks still apply.</p>{error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}<button disabled={reopening} onClick={() => void reopen()} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">{reopening ? "Reopening…" : "Reopen request"}</button></section> : <section className="rounded-3xl border bg-card p-5 text-sm shadow-sm">{done ? <p className="inline-flex items-center gap-2 font-semibold text-emerald-800"><Check className="size-4"/>Programme created and activated. The welcome email is not sent automatically.</p> : <p className="font-medium">This request is completed and cannot be applied again.</p>}</section>}
    {effectiveStatus === "COMPLETED" && welcomeEmailPrompt && <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">Personalised welcome email</h2>{sentAt ? <><p className="mt-2 text-sm text-emerald-800">Sent {new Date(sentAt).toLocaleString("en-GB")}. Duplicate sending is disabled.</p>{sentBody && <textarea readOnly aria-label="Sent welcome email" value={sentBody} className="mt-4 min-h-64 w-full rounded-2xl border bg-background p-4 text-sm leading-6"/>}</> : <><p className="mt-2 text-sm text-muted-foreground">Copy the prompt into an external AI, then paste its email body here. Nothing is sent until you review and confirm it.</p><button onClick={() => void copy(welcomeEmailPrompt, "welcome")} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-semibold"><ClipboardCopy className="size-4"/>{copied === "welcome" ? "Welcome prompt copied" : "Copy Welcome Email Prompt"}</button><textarea value={emailDraft} onChange={(event) => { setEmailDraft(event.target.value); setEmailPreview(null); setEmailApproved(false); }} aria-label="Welcome email draft" placeholder="Paste the generated email body here…" className="mt-4 min-h-64 w-full rounded-2xl border bg-background p-4 text-sm leading-6"/><button disabled={emailDraft.trim().length < 20} onClick={prepareEmailPreview} className="mt-3 min-h-11 rounded-xl bg-foreground px-4 font-semibold text-white disabled:opacity-50">Preview welcome email</button>{emailPreview && <><div className="mt-5 rounded-2xl border bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Exact email preview</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{emailPreview}</p></div><label className="mt-4 flex gap-3 rounded-xl border bg-card p-3 text-sm"><input type="checkbox" checked={emailApproved} onChange={(event) => setEmailApproved(event.target.checked)}/><span>I reviewed this exact email and want to send it to {ownerEmail}.</span></label><button disabled={!emailApproved || emailBusy} onClick={() => void sendWelcomeEmail()} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"><Mail className="size-5"/>{emailBusy ? "Sending…" : "Send Welcome Email"}</button></>}{error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}</>}</section>}
  </div>;
}
