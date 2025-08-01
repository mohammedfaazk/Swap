import { ethers } from 'ethers';

// SimpleHTLC ABI - extracted from compiled contract
export const SIMPLE_HTLC_ABI = [
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_swapId",
        "type": "bytes32"
      }
    ],
    "name": "getSwap",
    "outputs": [
      {
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "hashlock",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "timelock",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "withdrawn",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "refunded",
        "type": "bool"
      },
      {
        "internalType": "bytes32",
        "name": "preimage",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_swapId",
        "type": "bytes32"
      }
    ],
    "name": "haveSwap",
    "outputs": [
      {
        "internalType": "bool",
        "name": "exists",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address payable",
        "name": "_receiver",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "_hashlock",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "_timelock",
        "type": "uint256"
      }
    ],
    "name": "newSwap",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "swapId",
        "type": "bytes32"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_swapId",
        "type": "bytes32"
      }
    ],
    "name": "refund",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "swaps",
    "outputs": [
      {
        "internalType": "address payable",
        "name": "sender",
        "type": "address"
      },
      {
        "internalType": "address payable",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "hashlock",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "timelock",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "withdrawn",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "refunded",
        "type": "bool"
      },
      {
        "internalType": "bytes32",
        "name": "preimage",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_swapId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "_preimage",
        "type": "bytes32"
      }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "swapId",
        "type": "bytes32"
      }
    ],
    "name": "SwapRefunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "swapId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "hashlock",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "timelock",
        "type": "uint256"
      }
    ],
    "name": "SwapInitiated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "swapId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "preimage",
        "type": "bytes32"
      }
    ],
    "name": "SwapWithdrawn",
    "type": "event"
  }
];

// Deployed contract address - using pre-deployed Sepolia testnet address
// NOTE: This contract address should be updated with a real deployed HTLC contract
export const SIMPLE_HTLC_ADDRESS = "0x1234567890123456789012345678901234567890"; // Placeholder - needs real deployment

export interface HTLCSwapDetails {
  sender: string;
  receiver: string;
  amount: string;
  hashlock: string;
  timelock: number;
  withdrawn: boolean;
  refunded: boolean;
  preimage: string;
}

export class SimpleHTLCContract {
  private contract: ethers.Contract;
  private signer: ethers.Signer;

  constructor(signer: ethers.Signer, contractAddress?: string) {
    this.signer = signer;
    const address = contractAddress || SIMPLE_HTLC_ADDRESS;
    this.contract = new ethers.Contract(address, SIMPLE_HTLC_ABI, signer);
  }

  /**
   * Create a new atomic swap
   */
  async createSwap(
    receiver: string,
    hashlock: string,
    timelock: number,
    amount: string
  ): Promise<{ swapId: string; txHash: string }> {
    try {
      // For demo purposes, we'll simulate the transaction if the contract isn't available
      if (SIMPLE_HTLC_ADDRESS === "0x1234567890123456789012345678901234567890") {
        console.log("🎭 SIMULATING HTLC CONTRACT INTERACTION (No real contract deployed)");
        console.log("💰 This would create a real HTLC with the following parameters:");
        console.log("- Receiver:", receiver);
        console.log("- Amount:", amount, "ETH");
        console.log("- Hashlock:", hashlock);
        console.log("- Timelock:", new Date(timelock * 1000).toLocaleString());
        
        // Simulate transaction delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Generate deterministic swap ID
        const swapId = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'string', 'uint256', 'uint256'],
            [receiver, amount, timelock, Date.now()]
          )
        );
        
        const txHash = `0x${Math.random().toString(16).substr(2, 64)}`;
        
        console.log("✅ SIMULATED: HTLC Contract Created");
        console.log("Swap ID:", swapId);
        console.log("TX Hash:", txHash);
        
        return { swapId, txHash };
      }

      // Real contract interaction
      const tx = await this.contract.newSwap(
        receiver,
        hashlock,
        timelock,
        {
          value: ethers.parseEther(amount),
          gasLimit: 300000
        }
      );

      const receipt = await tx.wait();
      
      // Parse the SwapInitiated event to get the swap ID
      const event = receipt.logs.find((log: any) => 
        log.topics[0] === ethers.id("SwapInitiated(bytes32,address,address,uint256,bytes32,uint256)")
      );
      
      if (!event) {
        throw new Error("SwapInitiated event not found");
      }

      const swapId = event.topics[1];
      
      return {
        swapId,
        txHash: tx.hash
      };
    } catch (error: any) {
      console.error("Failed to create swap:", error);
      throw new Error(`Swap creation failed: ${error.message}`);
    }
  }

  /**
   * Withdraw from a swap by revealing the preimage
   */
  async withdrawSwap(swapId: string, preimage: string): Promise<string> {
    try {
      const tx = await this.contract.withdraw(swapId, preimage, {
        gasLimit: 200000
      });
      
      await tx.wait();
      return tx.hash;
    } catch (error: any) {
      console.error("Failed to withdraw swap:", error);
      throw new Error(`Swap withdrawal failed: ${error.message}`);
    }
  }

  /**
   * Refund an expired swap
   */
  async refundSwap(swapId: string): Promise<string> {
    try {
      const tx = await this.contract.refund(swapId, {
        gasLimit: 200000
      });
      
      await tx.wait();
      return tx.hash;
    } catch (error: any) {
      console.error("Failed to refund swap:", error);
      throw new Error(`Swap refund failed: ${error.message}`);
    }
  }

  /**
   * Get swap details
   */
  async getSwapDetails(swapId: string): Promise<HTLCSwapDetails> {
    try {
      const details = await this.contract.getSwap(swapId);
      return {
        sender: details[0],
        receiver: details[1],
        amount: ethers.formatEther(details[2]),
        hashlock: details[3],
        timelock: Number(details[4]),
        withdrawn: details[5],
        refunded: details[6],
        preimage: details[7]
      };
    } catch (error: any) {
      console.error("Failed to get swap details:", error);
      throw new Error(`Failed to get swap details: ${error.message}`);
    }
  }

  /**
   * Check if a swap exists
   */
  async swapExists(swapId: string): Promise<boolean> {
    try {
      return await this.contract.haveSwap(swapId);
    } catch (error: any) {
      console.error("Failed to check swap existence:", error);
      return false;
    }
  }

  /**
   * Generate a random secret and its hash
   */
  static generateSecret(): { secret: string; hash: string } {
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const hash = ethers.keccak256(secret);
    return { secret, hash };
  }

  /**
   * Calculate timelock timestamp (current time + hours)
   */
  static calculateTimelock(hours: number): number {
    return Math.floor(Date.now() / 1000) + (hours * 3600);
  }
}