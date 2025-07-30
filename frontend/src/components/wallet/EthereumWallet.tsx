import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "../ui/button";
export function EthereumWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  return (
    <div>
      {!isConnected ? (
        <Button onClick={()=>connect({ connector: connectors[0] })}>Connect MetaMask</Button>
      ) : (
        <Button onClick={()=>disconnect()}>Disconnect ({address?.slice(0,6)}...{address?.slice(-4)})</Button>
      )}
    </div>
  );
}