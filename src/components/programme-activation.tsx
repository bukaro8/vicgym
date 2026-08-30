"use client";

import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function ProgrammeActivation({ slug, version, active }: Readonly<{ slug: string; version: number; active: boolean }>) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activated, setActivated] = useState(active);
  const [error, setError] = useState<string | null>(null);

  if (activated) {
    return <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-accent p-4 text-sm text-accent-foreground"><CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Demo programme confirmed</p><p className="mt-1 leading-5">It remains labelled as test data. Workout logging is not available until Phase 3.</p></div></div>;
  }
  if (!reviewing) {
    return <button type="button" onClick={() => setReviewing(true)} className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground sm:w-auto">Review before activation</button>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acknowledged) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/programmes/${slug}/activate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "ACTIVATE_DEMO_PROGRAMME", version }) });
      if (!response.ok) throw new Error("The programme could not be activated.");
      setActivated(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The programme could not be activated.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Explicit confirmation required</p><p className="mt-1 text-sm leading-5">This four-day routine exists only to test VicGym. Activating it does not turn it into a recommendation.</p></div></div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white/70 p-3 text-sm leading-5"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 size-4 accent-primary" /><span>I understand this is demo/test data and not training advice.</span></label>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="submit" disabled={!acknowledged || submitting} className="min-h-11 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Activating…" : "Activate demo programme"}</button><button type="button" onClick={() => setReviewing(false)} className="min-h-11 rounded-2xl border bg-white px-4 text-sm font-semibold">Cancel</button></div>
    </form>
  );
}
