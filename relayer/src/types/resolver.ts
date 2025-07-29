export interface Resolver {
  id: number;
  address: string;
  endpoint: string;
  stake: string;
  reputation: number;
  successfulSwaps: number;
  totalSwaps: number;
  isAuthorized: boolean;
}
