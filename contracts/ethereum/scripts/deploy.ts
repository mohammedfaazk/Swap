import { ethers } from "hardhat";
import { writeFileSync } from "fs";

async function main() {
  console.log("🚀 Deploying StellarBridge Fusion+ contracts...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy ResolverRegistry first
  console.log("\n📋 Deploying ResolverRegistry...");
  const ResolverRegistry = await ethers.getContractFactory("ResolverRegistry");
  const resolverRegistry = await ResolverRegistry.deploy();
  await resolverRegistry.deployed();
  console.log("✅ ResolverRegistry deployed to:", resolverRegistry.address);

  // Deploy PartialFillManager
  console.log("\n🔄 Deploying PartialFillManager...");
  const PartialFillManager = await ethers.getContractFactory("PartialFillManager");
  const partialFillManager = await PartialFillManager.deploy();
  await partialFillManager.deployed();
  console.log("✅ PartialFillManager deployed to:", partialFillManager.address);

  // Deploy main StellarBridgeFusionPlus contract
  console.log("\n🌟 Deploying StellarBridgeFusionPlus...");
  const StellarBridgeFusionPlus = await ethers.getContractFactory("StellarBridgeFusionPlus");
  const stellarBridge = await StellarBridgeFusionPlus.deploy(deployer.address); // Fee recipient
  await stellarBridge.deployed();
  console.log("✅ StellarBridgeFusionPlus deployed to:", stellarBridge.address);

  // Save deployment addresses
  const deployments = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    contracts: {
      StellarBridgeFusionPlus: stellarBridge.address,
      PartialFillManager: partialFillManager.address,
      ResolverRegistry: resolverRegistry.address,
    },
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  writeFileSync("deployments.json", JSON.stringify(deployments, null, 2));
  console.log("\n📄 Deployment addresses saved to deployments.json");

  // Verify contracts on block explorer
  console.log("\n🔍 Contract verification commands:");
  console.log(`npx hardhat verify --network ${(await ethers.provider.getNetwork()).name} ${stellarBridge.address} "${deployer.address}"`);
  console.log(`npx hardhat verify --network ${(await ethers.provider.getNetwork()).name} ${partialFillManager.address}`);
  console.log(`npx hardhat verify --network ${(await ethers.provider.getNetwork()).name} ${resolverRegistry.address}`);

  console.log("\n🎉 Deployment completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
