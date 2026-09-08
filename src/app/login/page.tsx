import { Dumbbell } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  if (await getCurrentUser()) redirect("/");
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : null;
  return <main className="grid min-h-dvh place-items-center bg-background px-4 py-10"><div className="w-full max-w-md"><div className="mb-7 text-center"><span className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-sm"><Dumbbell className="size-8"/></span><h1 className="mt-4 text-4xl font-semibold tracking-tight">Welcome to VicGym</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Your programmes, workouts, and progress stay private to your account.</p></div>{error && <p role="alert" className="mb-4 rounded-2xl border border-destructive/20 bg-card p-4 text-sm text-destructive">{error === "expired-link" ? "That sign-in link has expired or was already used. Request a new one." : "That sign-in link is invalid. Request a new one."}</p>}<LoginForm/></div></main>;
}
