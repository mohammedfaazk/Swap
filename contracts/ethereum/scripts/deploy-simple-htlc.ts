import { ethers } from "hardhat";

async function main() {
  console.log("Deploying SimpleHTLC contract to Sepolia...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Deploy the SimpleHTLC contract
  const SimpleHTLC = await ethers.getContractFactory("SimpleHTLC");
  const simpleHTLC = await SimpleHTLC.deploy();
  
  await simpleHTLC.waitForDeployment();
  const contractAddress = await simpleHTLC.getAddress();

  console.log("SimpleHTLC deployed to:", contractAddress);
  
  // Verify deployment
  console.log("Verifying deployment...");
  const code = await ethers.provider.getCode(contractAddress);
  if (code === "0x") {
    throw new Error("Contract deployment failed");
  }
  
  console.log("✅ Contract deployed successfully!");
  console.log("Contract address:", contractAddress);
  console.log("Transaction hash:", simpleHTLC.deploymentTransaction()?.hash);
  
  // Save deployment info
  const deploymentInfo = {
    contractAddress,
    deploymentTransaction: simpleHTLC.deploymentTransaction()?.hash,
    network: "sepolia",
    timestamp: new Date().toISOString(),
  };
  
  console.log("Deployment info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });