import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  console.log("🎭 Setting up demo environment...");

  const deployments = JSON.parse(readFileSync("deployments.json", "utf8"));
  const [deployer, resolver1, resolver2, user1] = await ethers.getSigners();

  // Get contract instances
  const stellarBridge = await ethers.getContractAt("StellarBridgeFusionPlus", deployments.contracts.StellarBridgeFusionPlus);
  const resolverRegistry = await ethers.getContractAt("ResolverRegistry", deployments.contracts.ResolverRegistry);

  console.log("\n👥 Registering demo resolvers...");
  
  // Register resolver 1
  await resolverRegistry.connect(resolver1).registerResolver(ethers.utils.parseEther("1"), {
    value: ethers.utils.parseEther("2")
  });
  console.log("✅ Resolver 1 registered:", resolver1.address);

  // Register resolver 2
  await resolverRegistry.connect(resolver2).registerResolver(ethers.utils.parseEther("1"), {
    value: ethers.utils.parseEther("3")
  });
  console.log("✅ Resolver 2 registered:", resolver2.address);

  console.log("\n💰 Creating demo token for testing...");
  
  // Deploy a simple ERC20 token for demo
  const MockToken = await ethers.getContractFactory("MockERC20");
  const mockToken = await MockToken.deploy("Demo Token", "DEMO", ethers.utils.parseEther("1000000"));
  await mockToken.deployed();
  console.log("✅ Demo token deployed:", mockToken.address);

  // Transfer tokens to users for testing
  await mockToken.transfer(user1.address, ethers.utils.parseEther("1000"));
  console.log("✅ Transferred 1000 DEMO tokens to user1:", user1.address);

  // Create a demo swap
  console.log("\n🔄 Creating demo swap...");
  
  const secretHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("demo-secret-123"));
  const amount = ethers.utils.parseEther("100");
  
  // Approve tokens
  await mockToken.connect(user1).approve(stellarBridge.address, amount);
  
  // Initiate swap
  const tx = await stellarBridge.connect(user1).initiateSwap(
    mockToken.address,
    amount,
    secretHash,
    3600, // 1 hour timelock
    "GDEMO123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJK", // Demo Stellar address
    true, // Partial fills enabled
    ethers.utils.keccak256(ethers.utils.toUtf8Bytes("merkle-root-demo"))
  );
  
  const receipt = await tx.wait();
  const swapId = receipt.events?.[0]?.args?.swapId;
  console.log("✅ Demo swap created with ID:", swapId);

  // Save demo data
  const demoData = {
    contracts: deployments.contracts,
    demoToken: mockToken.address,
    accounts: {
      deployer: deployer.address,
      resolver1: resolver1.address,
      resolver2: resolver2.address,
      user1: user1.address,
    },
    demoSwap: {
      swapId: swapId,
      secret: "demo-secret-123",
      secretHash: secretHash,
    },
    timestamp: new Date().toISOString(),
  };

  require("fs").writeFileSync("demo-data.json", JSON.stringify(demoData, null, 2));
  console.log("\n📄 Demo data saved to demo-data.json");
  console.log("\n🎉 Demo environment setup completed!");
  console.log("\n🎯 Ready for judge demonstration!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
