"use client";

import { useState } from "react";

/** Demo analytics. Replace with live API for real stats. */
export function useAnalytics() {
  // Typically this would fetch from `/api/analytics`
  const [overview] = useState({ totalSwaps: 210, totalVolume: 8800, avgCompletionTime: 9.1 });
  const [volumeData] = useState(Array.from({ length: 24 }, (_, i) => ({ hour: i, volume: Math.random() * 100 })));
  const [metrics] = useState({ totalSwaps: 210, totalVolume: 8800, activeResolvers: 8, successRate: 97.4 });
  const [performance] = useState({ avgCompletionTime: 9.1, totalGasUsed: 29459120 });

  return { overview, volumeData, metrics, performance };
}
