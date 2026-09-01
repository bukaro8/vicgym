import { notFound, redirect } from "next/navigation";

import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function WorkoutSessionPage({ params }: PageProps<"/workouts/[sessionId]">) {
  const { sessionId } = await params;
  const session = await getPrisma().workoutSession.findUnique({ where: { id: sessionId }, include: { exerciseSessions: { orderBy: { position: "asc" }, take: 1 } } });
  if (!session) notFound();
  if (session.status === "COMPLETED") redirect(`/workouts/${sessionId}/summary`);
  const first = session.exerciseSessions[0]; if (!first) notFound();
  redirect(`/workouts/${sessionId}/exercises/${first.id}`);
}
