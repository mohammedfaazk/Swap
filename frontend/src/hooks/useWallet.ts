import { useState } from "react";
import type { WalletInfo } from "@/types/wallet";

/** Demo: Replace with real wallet integration for production */
export function useWallet() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string|undefined>();
  const [chain, setChain] = useState<"ethereum"|"stellar">("ethereum");

  async function connect() {
    // TODO: Integrate Wallet SDKs
    setConnected(true);
    setAddress("0x1234...ETH");
  }
  async function disconnect() {
    setConnected(false);
    setAddress(undefined);
  }
  return { connected, address, chain, connect, disconnect };
}