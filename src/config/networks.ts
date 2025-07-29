/**
 * networks.ts
 * 
 * Defines configuration for blockchain networks supported by StellarBridge Fusion+.
 * Includes network parameters for Ethereum and Stellar testnets/mainnets.
 * This config is used by monitors, coordinators, and services to connect to blockchains.
 */

export const networks = {
  ethereum: {
    name: 'ethereum',
    chainId: 11155111, // Sepolia testnet chainId
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',

    // Addresses of deployed StellarBridge contracts on Ethereum Sepolia
    contracts: {
      StellarBridge: '0xYourStellarBridgeContractAddress',
      PartialFillManager: '0xYourPartialFillManagerContractAddress',
    },

    confirmationsRequired: 12, // Number of block confirmations before event considered final
    pollingIntervalMs: 12_000, // Poll every 12 seconds
  },

  stellar: {
    name: 'stellar',
    networkPassphrase: 'Test SDF Network ; September 2022',
    rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',

    // Contract IDs / Account IDs on Stellar Soroban Testnet
    contracts: {
      StellarBridge: 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      PartialFillManager: 'GBYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    },

    pollingIntervalMs: 15_000, // Poll every 15 seconds
  },

  // Placeholder for future network expansion, e.g., Polygon, Arbitrum
  polygon: {
    name: 'polygon',
    chainId: 80001, // Mumbai testnet chainId
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-mumbai.g.alchemy.com/v2/demo',
    
    contracts: {
      StellarBridge: '',
      PartialFillManager: '',
    },

    confirmationsRequired: 15,
    pollingIntervalMs: 10_000,
  },
};
