import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "solidity-coverage";

// Load environment variables
require('dotenv').config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    sepolia: {
      url: process.env.ETHEREUM_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
      accounts: (process.env.ETHEREUM_PRIVATE_KEY && process.env.ETHEREUM_PRIVATE_KEY !== "YOUR_PRIVATE_KEY_HERE") 
        ? [process.env.ETHEREUM_PRIVATE_KEY.startsWith('0x') ? process.env.ETHEREUM_PRIVATE_KEY : `0x${process.env.ETHEREUM_PRIVATE_KEY}`] 
        : [],
      chainId: 11155111,
      gas: 5000000, // 5M gas limit
      gasPrice: 20000000000, // 20 gwei in wei
      timeout: 60000
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL || `https://goerli.infura.io/v3/${process.env.INFURA_KEY || 'YOUR_INFURA_KEY'}`,
      accounts: (process.env.ETHEREUM_PRIVATE_KEY && process.env.ETHEREUM_PRIVATE_KEY !== "YOUR_PRIVATE_KEY_HERE") 
        ? [process.env.ETHEREUM_PRIVATE_KEY.startsWith('0x') ? process.env.ETHEREUM_PRIVATE_KEY : `0x${process.env.ETHEREUM_PRIVATE_KEY}`] 
        : [],
      chainId: 5,
      gas: 5000000,
      gasPrice: 20000000000,
      timeout: 60000
    },
    hardhat: {
      chainId: 1337,
      gas: 12000000,
      blockGasLimit: 12000000,
      allowUnlimitedContractSize: true,
      forking: process.env.ETHEREUM_RPC_URL ? {
        url: process.env.ETHEREUM_RPC_URL,
        blockNumber: process.env.START_BLOCK ? parseInt(process.env.START_BLOCK, 10) : undefined
      } : undefined
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      gas: 12000000,
      gasPrice: 1000000000 // 1 gwei
    }
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6"
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD"
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || ""
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 60000
  }
};

export default config;
