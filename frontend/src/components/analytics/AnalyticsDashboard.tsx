import { useAnalytics } from "@/hooks/useAnalytics";
import { VolumeChart } from "./VolumeChart";
import { LiveMetrics } from "./LiveMetrics";
import { PerformanceStats } from "./PerformanceStats";
export function AnalyticsDashboard() {
  const { overview, volumeData, metrics, performance } = useAnalytics();
  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <VolumeChart data={volumeData} />
      <LiveMetrics stats={metrics} />
      <PerformanceStats stats={performance} />
    </div>
  );
}