export interface ResolverProfile {
  address: string;
  name: string;
  endpoint: string;
  stake: string;
  reputation: number;
  supportedChains: string[];
}
export interface ResolverOrder {
  orderId: number|string;
  fromToken:string;
  toToken:string;
  amount:number;
}
export interface ResolverAuction {
  details: string;
}