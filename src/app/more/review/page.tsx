import { ArrowLeft, ClipboardList } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ReviewWorkflow } from "@/components/review-workflow";
import { getPrisma } from "@/lib/prisma";
import { getWeeklyReview } from "@/server/weekly-review";

export const dynamic = "force-dynamic";

export default async function WeeklyReviewPage() {
  const review = await getWeeklyReview(getPrisma());
  return <AppShell><main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-8 sm:py-10"><Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><ArrowLeft className="size-4"/>Home</Link><div className="mt-5 flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-primary"><ClipboardList className="size-5"/></span><div><p className="text-sm font-semibold text-primary">Weekly Review</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">ChatGPT coach loop</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">VicGym reports saved facts. ChatGPT can return structured programme changes; you review them before a new immutable version is created.</p></div></div><ReviewWorkflow initialReview={review}/></main></AppShell>;
}
