import { OfflineWorkoutView } from "@/components/offline-workout-view";

export default async function OfflineWorkoutPage({ params }: PageProps<"/offline/workout/[sessionId]/[exerciseSessionId]">) { const { sessionId, exerciseSessionId } = await params; return <OfflineWorkoutView sessionId={sessionId} exerciseSessionId={exerciseSessionId}/>; }
