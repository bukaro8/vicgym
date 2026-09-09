import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding-flow";
import { getPrisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/server/auth";
import { getOnboardingState } from "@/server/onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireCurrentUser();
  const state = await getOnboardingState(getPrisma(), user.id);
  if (state.mode === "READY") redirect("/");
  return <main className="min-h-dvh bg-background px-4 py-10 sm:px-8"><div className="mx-auto max-w-3xl"><div className="mb-8 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary font-bold text-primary-foreground">VG</span><span className="text-lg font-semibold">VicGym</span></div><OnboardingFlow initialMode={state.mode} initialPath={state.path}/></div></main>;
}
