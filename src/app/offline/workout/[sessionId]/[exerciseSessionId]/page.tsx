import type { RoutePageProps } from "@/lib/page-props";
import { OfflineWorkoutView } from "@/components/offline-workout-view";

export default async function OfflineWorkoutPage({ params }: RoutePageProps<{ sessionId: string; exerciseSessionId: string }>) { const { sessionId, exerciseSessionId } = await params; return <OfflineWorkoutView sessionId={sessionId} exerciseSessionId={exerciseSessionId}/>; }
