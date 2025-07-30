import { useState } from "react";
import { useSwapStore } from "@/store/swapStore";
import type { SwapOrder } from "@/types/swap";

/**
 * Hook for managing swaps and interacting with backend/relayer.
 * Replace setTimeout with real API logic.
 */
export function useSwap() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const { addHistory, history } = useSwapStore();

  async function initiateSwap(order: SwapOrder) {
    setStatus("Submitting swap...");
    setProgress(10);
    // TODO: Replace with real API call and event subscription
    setTimeout(() => setProgress(80), 1000);
    setTimeout(() => {
      setStatus("Completed!");
      setProgress(100);
      addHistory(order);
    }, 2000);
  }

  return { initiateSwap, progress, status, history };
}