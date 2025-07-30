// Helper type for ethers.js v6 event filters
interface EventFilters {
  [SwapInitiated]: () => Promise<any>;
  [SwapCompleted]: () => Promise<any>;
  [SwapRefunded]: () => Promise<any>;
  [PartialFillExecuted]: () => Promise<any>;
}
