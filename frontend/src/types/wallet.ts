export interface WalletInfo {
  address: string;
  chain: "ethereum" | "stellar";
  connected: boolean;
}