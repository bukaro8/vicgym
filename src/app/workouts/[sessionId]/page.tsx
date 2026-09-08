import { notFound, redirect } from "next/navigation";

import { getPrisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";
export default async function WorkoutSessionPage({ params }: PageProps<"/workouts/[sessionId]">) {
  const { sessionId } = await params;
  const user = await requireCurrentUser();
  const session = await getPrisma().workoutSession.findFirst({ where: { id: sessionId, userId: user.id }, include: { exerciseSessions: { orderBy: { position: "asc" }, take: 1 } } });
  if (!session) notFound();
  if (session.status === "COMPLETED") redirect(`/workouts/${sessionId}/summary`);
  const first = session.exerciseSessions[0]; if (!first) notFound();
  redirect(`/workouts/${sessionId}/exercises/${first.id}`);
}
