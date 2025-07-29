export interface Swap {
  id: string;
  initiator: string;
  resolver: string;
  amount: string;
  hashlock: string;
  timelock: number;
  stellarAccount: string;
  state: 'INITIATED' | 'LOCKED' | 'COMPLETED' | 'REFUNDED' | 'EXPIRED';
  enablePartialFill: boolean;
  minimumFill?: string;
  filledAmount?: string;
  merkleRoot?: string;
}
