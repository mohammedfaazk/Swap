export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  wormholeRelayerAddress?: string; // For example, if using messaging relayer
}

export const Networks: { [key: string]: NetworkConfig } = {
  ethereumSepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
    explorerUrl: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
  },
  stellarTestnet: {
    chainId: 1024, // custom chainId for identification
    name: "Stellar Testnet",
    rpcUrl: process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org",
    nativeCurrency: { name: "Stellar Lumens", symbol: "XLM", decimals: 7 }
  },
  // Extend with other networks (Avalanche, Polygon, etc.) as needed
};
