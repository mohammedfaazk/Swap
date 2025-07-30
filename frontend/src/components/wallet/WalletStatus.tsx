import { useWallet } from "@/hooks/useWallet";
import { FC } from 'react';

export const WalletStatus: FC = () => {
  const { connected, address } = useWallet();
  return (
    <div>
      {connected ? `Connected: ${address}` : "Not connected"}
    </div>
  );
}