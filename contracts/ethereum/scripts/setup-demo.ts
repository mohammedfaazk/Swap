import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { parseEther, keccak256, toUtf8Bytes, ContractTransactionResponse } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { 
  StellarBridgeFusionPlus,
  ResolverRegistry,
  MockERC20 
} from "../typechain-types";

interface Deployments {
  contracts: {
    StellarBridgeFusionPlus: string;
    ResolverRegistry: string;
  }
}

async function main() {
  console.log("🎭 Setting up demo environment...");

  const deployments: Deployments = JSON.parse(readFileSync("deployments.json", "utf8"));
  const [deployer, resolver1, resolver2, user1]: HardhatEthersSigner[] = await ethers.getSigners();

  // Get contract instances
  const stellarBridge = (await ethers.getContractAt(
    "StellarBridgeFusionPlus",
    deployments.contracts.StellarBridgeFusionPlus
  )) as StellarBridgeFusionPlus;

  const resolverRegistry = (await ethers.getContractAt(
    "ResolverRegistry",
    deployments.contracts.ResolverRegistry
  )) as ResolverRegistry;

  console.log("\n👥 Registering demo resolvers...");
  
  // Register resolver 1
  const tx1 = await resolverRegistry.connect(resolver1).registerResolver(parseEther("1"), {
    value: parseEther("2")
  });
  await tx1.wait();
  console.log("✅ Resolver 1 registered:", resolver1.address);

  // Register resolver 2
  const tx2 = await resolverRegistry.connect(resolver2).registerResolver(parseEther("1"), {
    value: parseEther("3")
  });
  await tx2.wait();
  console.log("✅ Resolver 2 registered:", resolver2.address);

  console.log("\n💰 Creating demo token for testing...");
  
  // Deploy a simple ERC20 token for demo
  const mockToken = (await (await ethers.getContractFactory("MockERC20"))
    .deploy("Demo Token", "DEMO", parseEther("1000000"))) as MockERC20;
  await mockToken.waitForDeployment();
  const mockTokenAddress = await mockToken.getAddress();
  console.log("✅ Demo token deployed:", mockTokenAddress);

  // Transfer tokens to users for testing
  const tx3 = await mockToken.transfer(user1.address, parseEther("1000"));
  await tx3.wait();
  console.log("✅ Transferred 1000 DEMO tokens to user1:", user1.address);

  // Create a demo swap
  console.log("\n🔄 Creating demo swap...");
  
  const secretHash = keccak256(toUtf8Bytes("demo-secret-123"));
  const amount = parseEther("100");
  
  const stellarBridgeAddress = await stellarBridge.getAddress();
  
  // Approve tokens
  const tx4 = await mockToken.connect(user1).approve(stellarBridgeAddress, amount);
  await tx4.wait();
  
  // Initiate swap
  const tx5 = await stellarBridge.connect(user1).initiateSwap(
    mockTokenAddress,
    amount,
    secretHash,
    0n, // timelock
    "0xStellarDestinationAddressDemo", // stellarAccount
    true, // partialFillEnabled
    keccak256(toUtf8Bytes("merkle-root-demo")), // merkleRoot
    { gasLimit: 1000000 }
  );
  const receipt = await tx5.wait();
  const swapId = receipt?.logs[0]?.topics[1];
  console.log("✅ Demo swap created with ID:", swapId);

  // Save demo data
  const demoData = {
    contracts: deployments.contracts,
    demoToken: mockTokenAddress,
    accounts: {
      deployer: deployer.address,
      resolver1: resolver1.address,
      resolver2: resolver2.address,
      user1: user1.address,
    },
    demoSwap: {
      swapId,
      secret: "demo-secret-123",
      secretHash,
    },
    timestamp: new Date().toISOString(),
  };

  writeFileSync("demo-data.json", JSON.stringify(demoData, null, 2));
  console.log("\n📄 Demo data saved to demo-data.json");
  console.log("\n🎉 Demo environment setup completed!");
  console.log("\n🎯 Ready for judge demonstration!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
