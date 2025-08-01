import { ethers } from "ethers";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_RPC_URL = "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161";

// Simple HTLC contract ABI for atomic swaps
export const HTLC_ABI = [
  "function initiate(bytes32 _hashlock, uint256 _timelock, address _receiver) external payable returns (bytes32)",
  "function claim(bytes32 _swapId, bytes32 _secret) external",
  "function refund(bytes32 _swapId) external",
  "function getSwap(bytes32 _swapId) external view returns (uint256, uint256, address, address, bytes32, bool, bool)",
  "event SwapInitiated(bytes32 indexed swapId, address indexed initiator, address indexed receiver, uint256 amount, bytes32 hashlock, uint256 timelock)",
  "event SwapClaimed(bytes32 indexed swapId, bytes32 secret)",
  "event SwapRefunded(bytes32 indexed swapId)"
];

export function getEthereumProvider() {
  return typeof window !== "undefined" ? (window as any).ethereum : null;
}

export async function getEthereumSigner() {
  const provider = getEthereumProvider();
  if (!provider) throw new Error("MetaMask not found");
  
  const ethersProvider = new ethers.BrowserProvider(provider);
  return await ethersProvider.getSigner();
}

export async function getEthereumContract(contractAddress: string) {
  const signer = await getEthereumSigner();
  return new ethers.Contract(contractAddress, HTLC_ABI, signer);
}

export async function initiateEthereumSwap(
  contractAddress: string,
  amount: string,
  receiverAddress: string,
  hashlock: string,
  timelock: number
) {
  try {
    const contract = await getEthereumContract(contractAddress);
    const amountWei = ethers.parseEther(amount);
    
    const tx = await contract.initiate(hashlock, timelock, receiverAddress, {
      value: amountWei
    });
    
    console.log("Transaction submitted:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);
    
    return {
      success: true,
      txHash: tx.hash,
      swapId: receipt.logs[0]?.topics[1] // Get swapId from event
    };
  } catch (error) {
    console.error("Failed to initiate Ethereum swap:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export function generateSecret(): { secret: string; hashlock: string } {
  const secret = ethers.hexlify(ethers.randomBytes(32));
  const hashlock = ethers.keccak256(secret);
  return { secret, hashlock };
}
