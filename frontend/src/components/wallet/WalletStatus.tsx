import { useWallet } from "@/hooks/useWallet";
import { FC } from 'react';

export const WalletStatus: FC = () => {
  const { isConnected, address } = useWallet();
  return (
    <div>
      {isConnected ? `Connected: ${address}` : "Not connected"}
    </div>
  );
}