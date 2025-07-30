export function PerformanceStats({ stats }: { stats: any }) {
  return (
    <div>
      <div className="font-bold mb-2 text-slate-300">Performance</div>
      <div className="flex justify-between py-1"><span>Avg Time</span> <span>{stats.avgCompletionTime}s</span></div>
      <div className="flex justify-between py-1"><span>Gas Used</span> <span>{stats.totalGasUsed}</span></div>
    </div>
  );
}