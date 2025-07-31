import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";

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
      url: process.env.ETHEREUM_RPC_URL || "https://sepolia.infura.io/v3/0991505b2d6443e8809864f478c88904",
      accounts: process.env.ETHEREUM_PRIVATE_KEY ? ["6bfe057e2fa44a53d145586f63f6850c37351c34322fdf93f6e8bce91201da85"] : ["6bfe057e2fa44a53d145586f63f6850c37351c34322fdf93f6e8bce91201da85"],
      chainId: 11155111,
      gas: 50,
      gasPrice: 10, // 10 gwei
      blockGasLimit: 30
    },
    hardhat: {
      chainId: 1337,
      forking: {
        url: process.env.ETHEREUM_RPC_URL || "https://sepolia.infura.io/v3/0991505b2d6443e8809864f478c88904",
        blockNumber: parseInt(process.env.START_BLOCK || "0", 10)
      }
    }
    
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6"
  }
};

export default config;
