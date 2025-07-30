import { useResolverStore } from "@/store/resolverStore";

/** Hook for resolver (liquidity provider/market maker) UI */
export function useResolver() {
  const { orders, auctions } = useResolverStore();
  return { orders, auctions };
}
