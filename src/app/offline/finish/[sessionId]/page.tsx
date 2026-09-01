import { OfflineFinishView } from "@/components/offline-finish-view";

export default async function OfflineFinishPage({ params }: PageProps<"/offline/finish/[sessionId]">) { const { sessionId } = await params; return <OfflineFinishView sessionId={sessionId}/>; }
