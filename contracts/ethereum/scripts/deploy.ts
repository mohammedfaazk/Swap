import { ethers } from "hardhat";
import { writeFileSync } from "fs";

async function main() {
  console.log("🚀 Deploying StellarBridge Fusion+ contracts...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy ResolverRegistry first
  console.log("\n📋 Deploying ResolverRegistry...");
  const ResolverRegistry = await ethers.getContractFactory("ResolverRegistry");
  const resolverRegistry = await ResolverRegistry.deploy();
  await resolverRegistry.waitForDeployment();
  const resolverRegistryAddress = await resolverRegistry.getAddress();
  console.log("✅ ResolverRegistry deployed to:", resolverRegistryAddress);

  // Deploy PartialFillManager
  console.log("\n🔄 Deploying PartialFillManager...");
  const PartialFillManager = await ethers.getContractFactory("PartialFillManager");
  const partialFillManager = await PartialFillManager.deploy();
  await partialFillManager.waitForDeployment();
  const partialFillManagerAddress = await partialFillManager.getAddress();
  console.log("✅ PartialFillManager deployed to:", partialFillManagerAddress);

  // Deploy main StellarBridgeFusionPlus contract
  console.log("\n🌟 Deploying StellarBridgeFusionPlus...");
  const StellarBridgeFusionPlus = await ethers.getContractFactory("StellarBridgeFusionPlus");
  const stellarBridge = await StellarBridgeFusionPlus.deploy(deployer.address); // Fee recipient
  await stellarBridge.waitForDeployment();
  const stellarBridgeAddress = await stellarBridge.getAddress();
  console.log("✅ StellarBridgeFusionPlus deployed to:", stellarBridgeAddress);

  // Save deployment addresses
  const network = await ethers.provider.getNetwork();
  const deployments = {
    network: network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    contracts: {
      StellarBridgeFusionPlus: stellarBridgeAddress,
      PartialFillManager: partialFillManagerAddress,
      ResolverRegistry: resolverRegistryAddress,
    },
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  writeFileSync("deployments.json", JSON.stringify(deployments, null, 2));
  console.log("\n📄 Deployment addresses saved to deployments.json");

  // Verify contracts on block explorer
  console.log("\n🔍 Contract verification commands:");
  console.log(`npx hardhat verify --network ${network.name} ${stellarBridgeAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network ${network.name} ${partialFillManagerAddress}`);
  console.log(`npx hardhat verify --network ${network.name} ${resolverRegistryAddress}`);

  console.log("\n🎉 Deployment completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
