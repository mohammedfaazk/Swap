export function LiveMetrics({ stats }: { stats: any }) {
  return (
    <div>
      <div className="flex justify-between py-1"><span>Total Volume</span> <span className="font-bold text-blue-300">${stats.totalVolume}</span></div>
      <div className="flex justify-between py-1"><span>Total Swaps</span> <span>{stats.totalSwaps}</span></div>
      <div className="flex justify-between py-1"><span>Active Resolvers</span> <span>{stats.activeResolvers}</span></div>
      <div className="flex justify-between py-1"><span>Success Rate</span> <span className="text-green-400">{stats.successRate}%</span></div>
    </div>
  );
}
