export enum SwapState {
  INITIATED = 'INITIATED',
  LOCKED = 'LOCKED',
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
  EXPIRED = 'EXPIRED',
}

export interface AtomicSwap {
  swapId: string;
  initiator: string;
  resolver: string;
  amount: string;  // ETH in wei or decimal string
  hashlock: string;
  timelock: number;
  stellarAccount: string;
  state: SwapState;
  enablePartialFill: boolean;
  minimumFill?: string;
  filledAmount?: string;
  merkleRoot?: string;
  createdAt: string;
  updatedAt: string;
}
