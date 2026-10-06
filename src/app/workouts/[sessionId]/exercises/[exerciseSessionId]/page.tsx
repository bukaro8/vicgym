import type { RoutePageProps } from "@/lib/page-props";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/server/auth";

export default async function ActiveExercisePage({ params }: RoutePageProps<{ sessionId: string; exerciseSessionId: string }>) {
  await requireCurrentUser();
  const { sessionId } = await params;
  redirect(`/workouts/${sessionId}`);
}
