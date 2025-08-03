import { ethers } from "hardhat";

async function testDeployment() {
  console.log("🔍 Testing contract deployments...");
  
  // Contract addresses from deployments.json
  const contracts = {
    SimpleHTLC: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    StellarBridgeFusionPlus: "0x742d35Cc6639C19532DD5A7b0f0b8e1e74b74F61",
    PartialFillManager: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    ResolverRegistry: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
  };

  try {
    // Get provider
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name} (${network.chainId})`);

    // Test each contract
    for (const [name, address] of Object.entries(contracts)) {
      try {
        const code = await provider.getCode(address);
        if (code === "0x") {
          console.log(`❌ ${name}: No contract deployed at ${address}`);
        } else {
          console.log(`✅ ${name}: Contract found at ${address} (${code.length} bytes)`);
          
          // Try to read contract functions if it's SimpleHTLC
          if (name === "SimpleHTLC") {
            try {
              const SimpleHTLC = await ethers.getContractFactory("SimpleHTLC");
              const simpleHTLC = SimpleHTLC.attach(address);
              
              // Test a simple view function
              const testSwapId = ethers.keccak256(ethers.toUtf8Bytes("test"));
              const hasSwap = await simpleHTLC.haveSwap(testSwapId);
              console.log(`   📋 SimpleHTLC.haveSwap test: ${hasSwap}`);
            } catch (contractError) {
              console.log(`   ⚠️ Contract interaction failed:`, contractError.message);
            }
          }
        }
      } catch (error) {
        console.log(`❌ ${name}: Error checking contract at ${address}:`, error.message);
      }
    }

    // Test network connectivity
    const blockNumber = await provider.getBlockNumber();
    console.log(`📊 Current block number: ${blockNumber}`);
    
    const gasPrice = await provider.getFeeData();
    console.log(`⛽ Current gas price: ${ethers.formatUnits(gasPrice.gasPrice || 0, "gwei")} gwei`);

  } catch (error) {
    console.error("❌ Deployment test failed:", error);
  }
}

// Run the test
testDeployment()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });