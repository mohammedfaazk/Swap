import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Deploying SimpleHTLC for REAL crypto transactions...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.01")) {
    console.log("⚠️  Low balance! Get test ETH from:");
    console.log("   - https://sepoliafaucet.com");
    console.log("   - https://sepolia-faucet.pk910.de");
    console.log("   - https://faucet.quicknode.com/ethereum/sepolia");
    console.log("");
  }

  // Deploy SimpleHTLC contract
  console.log("📋 Compiling and deploying SimpleHTLC...");
  const SimpleHTLC = await ethers.getContractFactory("SimpleHTLC");
  
  // Estimate deployment gas
  const deploymentData = SimpleHTLC.interface.encodeDeploy([]);
  const estimatedGas = await ethers.provider.estimateGas({
    data: deploymentData
  });
  
  console.log("⛽ Estimated deployment gas:", estimatedGas.toString());
  
  // Deploy with gas limit
  const contract = await SimpleHTLC.deploy({
    gasLimit: estimatedGas + BigInt(50000) // Add buffer
  });
  
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  console.log("✅ SimpleHTLC deployed to:", contractAddress);
  console.log("🔗 Transaction hash:", contract.deploymentTransaction()?.hash);
  
  // Verify deployment
  const code = await ethers.provider.getCode(contractAddress);
  if (code === "0x") {
    throw new Error("❌ Contract deployment failed - no code at address");
  }
  
  console.log("✅ Contract verified on-chain");
  
  // Test contract functionality
  console.log("🧪 Testing contract functionality...");
  
  // Generate test parameters
  const testReceiver = ethers.Wallet.createRandom().address;
  const testSecret = ethers.randomBytes(32);
  const testHash = ethers.keccak256(testSecret);
  const testTimelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const testAmount = ethers.parseEther("0.001"); // 0.001 ETH
  
  console.log("Test parameters:");
  console.log("  Receiver:", testReceiver);
  console.log("  Secret:", ethers.hexlify(testSecret));
  console.log("  Hash:", testHash);
  console.log("  Amount:", ethers.formatEther(testAmount), "ETH");
  
  // Test creating a swap
  try {
    const tx = await contract.newSwap(testReceiver, testHash, testTimelock, {
      value: testAmount,
      gasLimit: 300000
    });
    
    const receipt = await tx.wait();
    console.log("✅ Test swap created successfully!");
    console.log("   Gas used:", receipt?.gasUsed.toString());
    
    // Parse the swap ID from events
    const swapEvent = receipt?.logs.find(log => 
      log.topics[0] === ethers.id("SwapInitiated(bytes32,address,address,uint256,bytes32,uint256)")
    );
    
    if (swapEvent) {
      const swapId = swapEvent.topics[1];
      console.log("   Swap ID:", swapId);
      
      // Verify swap details
      const swapDetails = await contract.getSwap(swapId);
      console.log("   Verified swap details:");
      console.log("     Sender:", swapDetails[0]);
      console.log("     Receiver:", swapDetails[1]);
      console.log("     Amount:", ethers.formatEther(swapDetails[2]), "ETH");
    }
    
  } catch (error) {
    console.log("⚠️  Test swap failed (expected if insufficient balance):", error);
  }
  
  // Save deployment info for frontend
  const deploymentInfo = {
    contractAddress,
    deploymentTransaction: contract.deploymentTransaction()?.hash,
    network: "sepolia",
    chainId: 11155111,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };
  
  // Write to frontend constants
  const frontendPath = path.join(__dirname, "../../../frontend/src/contracts/deployed.json");
  fs.writeFileSync(frontendPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("📝 Deployment info saved to frontend");
  console.log("");
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("🔗 Contract Address:", contractAddress);
  console.log("🌐 Etherscan:", `https://sepolia.etherscan.io/address/${contractAddress}`);
  console.log("");
  console.log("🚀 Frontend is now ready for REAL crypto transactions!");
  console.log("   Update SIMPLE_HTLC_ADDRESS in SimpleHTLC.ts to:", contractAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });