export interface ResolverInfo {
  address: string;
  endpoint: string;
  stake: string;       // ETH amount staked as string
  reputation: number;  // Reputation score
  successfulSwaps: number;
  totalSwaps: number;
}
