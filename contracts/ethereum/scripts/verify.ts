import { run, ethers } from "hardhat";
import { readFileSync } from "fs";
import path from "path";

interface DeploymentInfo {
  stellarBridge: string;
  partialFillManager: string;
  resolverRegistry: string;
  constructorArgs: {
    stellarBridge: any[];
    partialFillManager: any[];
    resolverRegistry: any[];
  };
}

async function main() {
  console.log("🔍 Starting contract verification process...");

  // Load deployment info
  const deploymentPath = path.join(__dirname, "../deployments/deployment.json");
  let deploymentInfo: DeploymentInfo;

  try {
    if (!require("fs").existsSync(deploymentPath)) {
      throw new Error(`Deployment file not found at ${deploymentPath}`);
    }
    deploymentInfo = JSON.parse(readFileSync(deploymentPath, "utf8"));
    if (!deploymentInfo.stellarBridge || !deploymentInfo.partialFillManager || !deploymentInfo.resolverRegistry) {
      throw new Error("Deployment file is missing contract addresses.");
    }
    if (!deploymentInfo.constructorArgs ||
        !deploymentInfo.constructorArgs.stellarBridge ||
        !deploymentInfo.constructorArgs.partialFillManager ||
        !deploymentInfo.constructorArgs.resolverRegistry) {
      throw new Error("Deployment file is missing constructor arguments.");
    }
  } catch (error) {
    console.error("❌ Could not read deployment file:", error);
    process.exit(1);
  }

  const network = await ethers.provider.getNetwork();
  console.log(`📡 Verifying contracts on ${network.name} (chainId: ${network.chainId})`);

  // Verify StellarBridgeFusionPlus
  try {
    if (!deploymentInfo.stellarBridge) throw new Error("stellarBridge address missing");
    console.log("🔍 Verifying StellarBridgeFusionPlus...");
    await run("verify:verify", {
      address: deploymentInfo.stellarBridge,
      constructorArguments: deploymentInfo.constructorArgs.stellarBridge,
      contract: "contracts/StellarBridgeFusionPlus.sol:StellarBridgeFusionPlus"
    });
    console.log("✅ StellarBridgeFusionPlus verified successfully");
  } catch (error: any) {
    console.error("❌ StellarBridgeFusionPlus verification failed:", error?.message || error);
  }

  // Verify PartialFillManager
  try {
    if (!deploymentInfo.partialFillManager) throw new Error("partialFillManager address missing");
    console.log("🔍 Verifying PartialFillManager...");
    await run("verify:verify", {
      address: deploymentInfo.partialFillManager,
      constructorArguments: deploymentInfo.constructorArgs.partialFillManager,
      contract: "contracts/PartialFillManager.sol:PartialFillManager"
    });
    console.log("✅ PartialFillManager verified successfully");
  } catch (error: any) {
    console.error("❌ PartialFillManager verification failed:", error?.message || error);
  }

  // Verify ResolverRegistry
  try {
    if (!deploymentInfo.resolverRegistry) throw new Error("resolverRegistry address missing");
    console.log("🔍 Verifying ResolverRegistry...");
    await run("verify:verify", {
      address: deploymentInfo.resolverRegistry,
      constructorArguments: deploymentInfo.constructorArgs.resolverRegistry,
      contract: "contracts/ResolverRegistry.sol:ResolverRegistry"
    });
    console.log("✅ ResolverRegistry verified successfully");
  } catch (error: any) {
    console.error("❌ ResolverRegistry verification failed:", error?.message || error);
  }

  // Verify libraries if deployed separately
  console.log("🔍 Verifying libraries...");
  // MerkleProof library verification (skipped if not deployed separately)
  try {
    // If MerkleProof is deployed as a library, add verification here
    // Otherwise, skip
    // const merkleProofFactory = await ethers.getContractFactory("MerkleProof");
    // const merkleProofBytecode = merkleProofFactory.bytecode;
    console.log("📚 MerkleProof library is embedded in contracts or not deployed separately");
  } catch (error: any) {
    console.log("ℹ️ MerkleProof library verification skipped (embedded or not found)");
  }

  console.log("🎉 Contract verification process completed!");
  console.log("\n📋 Verification Summary:");
  console.log(`   StellarBridge: ${deploymentInfo.stellarBridge}`);
  console.log(`   PartialFillManager: ${deploymentInfo.partialFillManager}`);
  console.log(`   ResolverRegistry: ${deploymentInfo.resolverRegistry}`);
  console.log("\n🔗 View on Etherscan:");
  
  const etherscanBaseUrl = getEtherscanUrl(Number(network.chainId));
  if (etherscanBaseUrl) {
    console.log(`   StellarBridge: ${etherscanBaseUrl}/address/${deploymentInfo.stellarBridge}`);
    console.log(`   PartialFillManager: ${etherscanBaseUrl}/address/${deploymentInfo.partialFillManager}`);
    console.log(`   ResolverRegistry: ${etherscanBaseUrl}/address/${deploymentInfo.resolverRegistry}`);
  }
}

function getEtherscanUrl(chainId: number): string | null {
  switch (chainId) {
    case 1:
      return "https://etherscan.io";
    case 5:
      return "https://goerli.etherscan.io";
    case 11155111:
      return "https://sepolia.etherscan.io";
    case 137:
      return "https://polygonscan.com";
    case 80001:
      return "https://mumbai.polygonscan.com";
    default:
      return null;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
