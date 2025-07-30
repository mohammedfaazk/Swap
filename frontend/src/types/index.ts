export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export interface SwapParams {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  slippage: number;
  enablePartialFill: boolean;
  maxPartialFillPercentage?: number;
}

export interface SwapQuote {
  amountOut: string;
  priceImpact: number;
  fee: string;
  route: string[];
}

export interface SwapProgress {
  status: 'idle' | 'pending' | 'success' | 'error' | 'partial';
  txHash?: string;
  filledAmount?: string;
  remainingAmount?: string;
  error?: string;
}

export interface WalletState {
  address?: string;
  isConnected: boolean;
  balance?: string;
  chainId?: number;
}
