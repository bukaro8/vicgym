import { OfflineSummaryView } from "@/components/offline-summary-view";

export default async function OfflineSummaryPage({ params }: PageProps<"/offline/summary/[sessionId]">) { const { sessionId } = await params; return <OfflineSummaryView sessionId={sessionId}/>; }
