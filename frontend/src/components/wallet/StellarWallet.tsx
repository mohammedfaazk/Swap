import { Button } from "../ui/button";
export function StellarWallet() {
  return (
    <Button onClick={() => alert("Connect to Stellar with Freighter/Albedo!")}>
      Connect Stellar Wallet
    </Button>
  );
}
