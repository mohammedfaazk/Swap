export type SwapDirection = "ETH_TO_XLM" | "XLM_TO_ETH";
export interface SwapOrder {
  orderId?: number|string;
  fromToken?: "ETH"|"XLM";
  toToken?: "ETH"|"XLM";
  amount?: number|string;
  direction: SwapDirection;
  minFill?: number;
  partial?: boolean;
  status?: string;
  fromAmount?: string;
  toAccount?: string;
}
