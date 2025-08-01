import { ethers } from "ethers";

async function main() {
  // Generate a new random wallet for testnet deployment
  const wallet = ethers.Wallet.createRandom();
  
  console.log("🔐 Generated new testnet wallet:");
  console.log("Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);
  console.log("");
  console.log("⚠️  IMPORTANT: This is for TESTNET only!");
  console.log("📝 Save this private key in your .env file:");
  console.log(`ETHEREUM_PRIVATE_KEY=${wallet.privateKey}`);
  console.log("");
  console.log("💰 Fund this address with Sepolia ETH from:");
  console.log("   - https://sepoliafaucet.com");
  console.log("   - https://sepolia-faucet.pk910.de");
  console.log("   - https://faucet.quicknode.com/ethereum/sepolia");
  console.log("");
  console.log("🔍 Check balance at:");
  console.log(`   - https://sepolia.etherscan.io/address/${wallet.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });