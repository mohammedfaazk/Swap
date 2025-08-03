"use client";

import { useSwap } from "@/hooks/useSwap";
export function SwapHistory() {
  const { history = [] } = useSwap();
  
  return (
    <div className="p-8 bg-slate-800/80 backdrop-blur-sm rounded-lg shadow-xl border border-slate-700">
      <h4 className="text-xl font-bold mb-4 text-white">Recent Swaps</h4>
      
      {history.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <p>No swaps yet</p>
          <p className="text-sm mt-2">Your completed swaps will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((swap, i) => (
            <div key={i} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-semibold text-brand">
                    {swap.direction === "ETH_TO_XLM" ? "ETH → XLM" : "XLM → ETH"}
                  </span>
                  <span className="ml-2 text-white">{swap.fromAmount}</span>
                </div>
                <div className="text-sm text-slate-400">
                  {swap.partial ? "Partial Fill" : "Full Swap"}
                </div>
              </div>
              {swap.toAccount && (
                <div className="mt-2 text-xs text-slate-400">
                  To: {swap.toAccount.slice(0, 8)}...{swap.toAccount.slice(-6)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}