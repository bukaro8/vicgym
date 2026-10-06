import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/server/auth";

export default async function ActiveExercisePage({ params }: PageProps<"/workouts/[sessionId]/exercises/[exerciseSessionId]">) {
  await requireCurrentUser();
  const { sessionId } = await params;
  redirect(`/workouts/${sessionId}`);
}
