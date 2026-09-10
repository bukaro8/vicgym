"use client";

import { Dumbbell, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LogoutButton } from "@/components/logout-button";
import type { OnboardingMode } from "@/lib/onboarding";

async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result;
}

const selectClass = "mt-2 min-h-12 w-full rounded-2xl border bg-background px-4";
const textClass = "mt-2 min-h-28 w-full rounded-2xl border bg-background p-4";

function Basics() {
  return <div className="mt-7 grid gap-5 sm:grid-cols-2">
    <label className="text-sm font-medium">Main goal<select name="goal" className={selectClass} defaultValue="GENERAL_FITNESS"><option value="LOSE_FAT">Lose fat</option><option value="BUILD_MUSCLE">Build muscle</option><option value="GENERAL_FITNESS">Maintain / general fitness</option></select></label>
    <label className="text-sm font-medium">Training days per week<select name="trainingDaysPerWeek" className={selectClass} defaultValue="3">{[2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
    <label className="text-sm font-medium">Experience<select name="experience" className={selectClass} defaultValue="SOME_EXPERIENCE"><option value="BEGINNER">Beginner</option><option value="SOME_EXPERIENCE">Some experience</option><option value="EXPERIENCED">Experienced</option></select></label>
    <label className="text-sm font-medium">Session length<select name="sessionLengthMinutes" className={selectClass} defaultValue="60">{[45, 60, 90, 120].map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></label>
    <label className="text-sm font-medium sm:col-span-2">Cardio preference<select name="cardioPreference" className={selectClass} defaultValue="SOME"><option value="MINIMAL">Minimal</option><option value="SOME">Some</option><option value="ENJOYS_CARDIO">I enjoy cardio</option></select></label>
  </div>;
}

function PersonalContext() {
  return <div className="mt-5 grid gap-5 sm:grid-cols-2">
    <label className="text-sm font-medium">Age<input required name="age" type="number" min={16} max={100} inputMode="numeric" className={selectClass}/></label>
    <label className="text-sm font-medium">Height (cm)<input required name="heightCm" type="number" min={100} max={250} inputMode="numeric" className={selectClass}/></label>
    <label className="text-sm font-medium">Weight (kg)<input required name="weightKg" type="number" min={25} max={350} step="0.1" inputMode="decimal" className={selectClass}/></label>
    <label className="text-sm font-medium">How active are you outside the gym?<select required name="outsideGymActivity" defaultValue="MODERATE" className={selectClass}><option value="LOW">Low</option><option value="MODERATE">Moderate</option><option value="HIGH">High</option></select></label>
    <label className="text-sm font-medium sm:col-span-2">Average daily steps, if you know them<input name="averageDailySteps" type="number" min={0} max={100000} inputMode="numeric" className={selectClass}/></label>
  </div>;
}

export function OnboardingFlow({ initialMode, initialPath }: { initialMode: OnboardingMode; initialPath: string | null }) {
  const router = useRouter();
  const [path, setPath] = useState(initialPath);
  const [pending, setPending] = useState(initialMode === "FULLY_PERSONALISED_PENDING");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasLimitations, setHasLimitations] = useState(false);

  async function choose(nextPath: "SEMI_PERSONALISED" | "FULLY_PERSONALISED") {
    setBusy(true); setError("");
    try { await post("/api/onboarding/path", { path: nextPath }); setPath(nextPath); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save selection"); }
    finally { setBusy(false); }
  }

  async function submitSemi(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget);
    try {
      await post("/api/onboarding/semi-personalised", { goal: data.get("goal"), trainingDaysPerWeek: Number(data.get("trainingDaysPerWeek")), experience: data.get("experience"), sessionLengthMinutes: Number(data.get("sessionLengthMinutes")), cardioPreference: data.get("cardioPreference"), hasLimitations, limitationAreas: hasLimitations ? data.getAll("limitationAreas") : [], limitationsText: hasLimitations ? String(data.get("limitationsText") ?? "") : "" });
      router.replace("/"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create programme"); }
    finally { setBusy(false); }
  }

  async function submitFully(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget); const dailySteps = String(data.get("averageDailySteps") ?? "").trim();
    try {
      await post("/api/onboarding/fully-personalised", { goal: data.get("goal"), trainingDaysPerWeek: Number(data.get("trainingDaysPerWeek")), experience: data.get("experience"), sessionLengthMinutes: Number(data.get("sessionLengthMinutes")), cardioPreference: data.get("cardioPreference"), age: Number(data.get("age")), heightCm: Number(data.get("heightCm")), weightKg: Number(data.get("weightKg")), outsideGymActivity: data.get("outsideGymActivity"), averageDailySteps: dailySteps ? Number(dailySteps) : null, trainingPreferences: String(data.get("trainingPreferences") ?? ""), hasLimitations, limitationsText: hasLimitations ? String(data.get("limitationsText") ?? "") : "", personalPriorities: String(data.get("personalPriorities") ?? ""), additionalNotes: String(data.get("additionalNotes") ?? "") });
      setPending(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not submit request"); }
    finally { setBusy(false); }
  }

  if (pending) return <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-9"><Sparkles className="size-8 text-primary"/><h1 className="mt-5 text-3xl font-semibold tracking-tight">Your request is ready</h1><p className="mt-3 leading-7 text-muted-foreground">Your personalised programme is under review. VicGym will open normally after an administrator creates and activates it.</p><p className="mt-5 rounded-2xl bg-accent p-4 text-sm font-medium text-accent-foreground">Status: Pending coach review</p><div className="mt-6"><LogoutButton/></div></section>;
  if (!path) return <section><p className="text-sm font-semibold text-primary">Welcome to VicGym</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">How would you like to start?</h1><p className="mt-3 max-w-xl leading-7 text-muted-foreground">Choose an instant starter programme or request a fully personalised programme for coach review.</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><button disabled={busy} onClick={() => choose("SEMI_PERSONALISED")} className="rounded-3xl border bg-card p-6 text-left shadow-sm hover:border-primary"><Dumbbell className="size-7 text-primary"/><span className="mt-5 block text-xl font-semibold">Create my programme now</span><span className="mt-2 block text-sm leading-6 text-muted-foreground">Answer a few questions and create a starter programme immediately.</span></button><button disabled={busy} onClick={() => choose("FULLY_PERSONALISED")} className="rounded-3xl border bg-card p-6 text-left shadow-sm hover:border-primary"><Sparkles className="size-7 text-primary"/><span className="mt-5 block text-xl font-semibold">Build a fully personalised programme</span><span className="mt-2 block text-sm leading-6 text-muted-foreground">Complete a detailed coach brief before submitting a request.</span></button></div>{error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}</section>;
  if (path === "FULLY_PERSONALISED") return <form onSubmit={submitFully} className="rounded-3xl border bg-card p-5 shadow-sm sm:p-8"><p className="text-sm font-semibold text-primary">Fully personalised programme</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Create your coach brief</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Your answers are saved for administrator review. VicGym does not medically interpret limitation text.</p><Basics/><PersonalContext/><label className="mt-5 block text-sm font-medium">Training preferences<textarea required name="trainingPreferences" maxLength={2000} placeholder="Exercises you enjoy or dislike, machines vs free weights, shorter/harder or longer/easier sessions…" className={textClass}/></label><label className="mt-5 flex items-start gap-3 rounded-2xl bg-accent/60 p-4"><input type="checkbox" checked={hasLimitations} onChange={(event) => setHasLimitations(event.target.checked)} className="mt-1"/><span><span className="font-medium">I have an injury, pain, or movement limitation</span><span className="mt-1 block text-sm text-muted-foreground">This is passed to the coach without medical interpretation.</span></span></label>{hasLimitations && <label className="mt-4 block text-sm font-medium">Limitations<textarea required name="limitationsText" maxLength={2000} className={textClass}/></label>}<label className="mt-5 block text-sm font-medium">What would you most like your coach to take into account when creating your programme?<textarea required name="personalPriorities" maxLength={2000} className={textClass}/></label><label className="mt-5 block text-sm font-medium">Is there anything else you want your coach to know?<textarea name="additionalNotes" maxLength={2000} className={textClass}/></label>{error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}<button disabled={busy} className="mt-7 min-h-12 w-full rounded-2xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Submitting…" : "Submit for coach review"}</button></form>;
  return <form onSubmit={submitSemi} className="rounded-3xl border bg-card p-5 shadow-sm sm:p-8"><p className="text-sm font-semibold text-primary">Starter programme</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Tell VicGym the basics</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Your answers shape a catalogue-based starter. This is not medical advice.</p><Basics/><label className="mt-6 flex items-start gap-3 rounded-2xl bg-accent/60 p-4"><input type="checkbox" checked={hasLimitations} onChange={(event) => setHasLimitations(event.target.checked)} className="mt-1"/><span><span className="font-medium">I have limitations to record</span><span className="mt-1 block text-sm text-muted-foreground">These are flagged for coach review.</span></span></label>{hasLimitations && <div className="mt-5 rounded-2xl border p-4"><fieldset><legend className="text-sm font-medium">Areas (optional)</legend><div className="mt-3 flex flex-wrap gap-3">{[["UPPER_BODY", "Upper body"], ["LOWER_BODY", "Lower body"], ["BACK", "Back"], ["CORE", "Core"], ["OTHER", "Other"]].map(([value, label]) => <label key={value} className="rounded-full border px-3 py-2 text-sm"><input className="mr-2" type="checkbox" name="limitationAreas" value={value}/>{label}</label>)}</div></fieldset><label className="mt-4 block text-sm font-medium">Brief details<textarea required name="limitationsText" maxLength={1000} className={textClass}/></label></div>}{error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}<button disabled={busy} className="mt-7 min-h-12 w-full rounded-2xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Creating programme…" : "Create and activate starter programme"}</button></form>;
}
