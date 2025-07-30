import { useWallet } from "@/hooks/useWallet";
import { Button } from "../ui/button";
export function WalletConnection() {
  const { connected, address, connect, disconnect, chain } = useWallet();
  return (
    <div>
      <Button onClick={connected?disconnect:connect}>{connected?"Disconnect":"Connect Wallet"}</Button>
      {connected && <div className="mt-2 text-xs text-green-400">Connected: {address} on {chain}</div>}
    </div>
  );
}