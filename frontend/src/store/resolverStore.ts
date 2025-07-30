import { create } from "zustand";
interface ResolverOrder { orderId: number|string; fromToken:string; toToken:string; amount:number; }
interface ResolverAuction { details: string; }
interface State {
  orders: ResolverOrder[];
  auctions: ResolverAuction[];
}
export const useResolverStore = create<State>(() => ({
  orders: [{ orderId: 1, fromToken: "ETH", toToken: "XLM", amount: 5.3 }],
  auctions: [{ details: "Partial fill: 1.2 ETH remaining - Dutch Auction" }]
}));