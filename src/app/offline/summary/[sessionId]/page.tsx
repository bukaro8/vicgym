import type { RoutePageProps } from "@/lib/page-props";
import { OfflineSummaryView } from "@/components/offline-summary-view";

export default async function OfflineSummaryPage({ params }: RoutePageProps<{ sessionId: string }>) { const { sessionId } = await params; return <OfflineSummaryView sessionId={sessionId}/>; }
