import type { RoutePageProps } from "@/lib/page-props";
import { OfflineFinishView } from "@/components/offline-finish-view";

export default async function OfflineFinishPage({ params }: RoutePageProps<{ sessionId: string }>) { const { sessionId } = await params; return <OfflineFinishView sessionId={sessionId}/>; }
