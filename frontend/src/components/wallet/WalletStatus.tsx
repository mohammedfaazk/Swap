import { useWallet } from "@/hooks/useWallet";
export function WalletStatus() {
  const { connected, address } = useWallet();
  return <div>{connected ? Connected: ${address} : "Not connected"}</div>;
}