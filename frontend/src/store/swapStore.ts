import create from "zustand";
import type { SwapOrder } from "@/types/swap";
interface State {
  activeSwaps: any[];
  history: SwapOrder[];
  addHistory: (order: SwapOrder) => void;
}
export const useSwapStore = create<State>(set => ({
  activeSwaps: [],
  history: [],
  addHistory: o => set(s => ({ history: [o, ...s.history] })),
}));
