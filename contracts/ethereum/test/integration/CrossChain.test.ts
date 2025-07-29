import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { StellarBridgeFusionPlus, PartialFillManager, ResolverRegistry } from "../../typechain-types";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("🔗 Cross-Chain Integration Tests", function () {
  let stellarBridge: StellarBridgeFusionPlus;
  let partialFillManager: PartialFillManager;
  let resolverRegistry: ResolverRegistry;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let resolver1: SignerWithAddress;
  let resolver2: SignerWithAddress;
  let resolver3: SignerWithAddress;

  async function deployFixture() {
    const [owner, user, resolver1, resolver2, resolver3] = await ethers.getSigners();

    // Deploy ResolverRegistry
    const ResolverRegistry = await ethers.getContractFactory("ResolverRegistry");
    const resolverRegistry = await ResolverRegistry.deploy();

    // Deploy PartialFillManager
    const PartialFillManager = await ethers.getContractFactory("PartialFillManager");
    const partialFillManager = await PartialFillManager.deploy(resolverRegistry.address);

    // Deploy StellarBridgeFusionPlus
    const StellarBridge = await ethers.getContractFactory("StellarBridgeFusionPlus");
    const stellarBridge = await StellarBridge.deploy(
      partialFillManager.address,
      resolverRegistry.address
    );

    // Setup permissions
    await partialFillManager.setBridgeContract(stellarBridge.address);
    await resolverRegistry.setBridgeContract(stellarBridge.address);

    return {
      stellarBridge,
      partialFillManager,
      resolverRegistry,
      owner,
      user,
      resolver1,
      resolver2,
      resolver3
    };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployFixture);
    stellarBridge = fixture.stellarBridge;
    partialFillManager = fixture.partialFillManager;
    resolverRegistry = fixture.resolverRegistry;
    owner = fixture.owner;
    user = fixture.user;
    resolver1 = fixture.resolver1;
    resolver2 = fixture.resolver2;
    resolver3 = fixture.resolver3;
  });

  describe("Complete Cross-Chain Swap Flow", function () {
    it("Should execute complete ETH->XLM atomic swap", async function () {
      const swapAmount = ethers.utils.parseEther("2.0");
      const secret = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("secret123"));
      const secretHash = ethers.utils.keccak256(secret);
      const timelock = (await time.latest()) + 3600; // 1 hour
      const stellarAccount = "GDEMO1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJK";

      // User initiates swap
      await expect(
        stellarBridge.connect(user).initiateSwap(
          ethers.constants.AddressZero, // ETH
          swapAmount,
          secretHash,
          timelock,
          stellarAccount,
          false, // No partial fills
          ethers.constants.HashZero, // No merkle root needed
          { value: swapAmount }
        )
      ).to.emit(stellarBridge, "SwapInitiated");

      // Get swap ID from events
      const filter = stellarBridge.filters.SwapInitiated();
      const events = await stellarBridge.queryFilter(filter);
      const swapId = events[events.length - 1].args.swapId;

      // Verify swap details
      const swapDetails = await stellarBridge.getSwapDetails(swapId);
      expect(swapDetails.initiator).to.equal(user.address);
      expect(swapDetails.amount).to.equal(swapAmount);
      expect(swapDetails.secretHash).to.equal(secretHash);
      expect(swapDetails.state).to.equal(0); // INITIATED

      // Simulate Stellar-side completion by revealing secret
      await expect(
        stellarBridge.completeSwap(swapId, secret)
      ).to.emit(stellarBridge, "SwapCompleted");

      // Verify final state
      const finalDetails = await stellarBridge.getSwapDetails(swapId);
      expect(finalDetails.state).to.equal(2); // COMPLETED
    });

    it("Should handle partial fills with multiple resolvers", async function () {
      const swapAmount = ethers.utils.parseEther("10.0");
      const secret = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("partialsecret"));
      const secretHash = ethers.utils.keccak256(secret);
      const timelock = (await time.latest()) + 7200; // 2 hours
      const stellarAccount = "GPARTIAL567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJK";

      // Register resolvers
      const stakeAmount = ethers.utils.parseEther("5.0");
      await resolverRegistry.connect(resolver1).registerResolver({ value: stakeAmount });
      await resolverRegistry.connect(resolver2).registerResolver({ value: stakeAmount });
      await resolverRegistry.connect(resolver3).registerResolver({ value: stakeAmount });

      // Create merkle tree for partial fills
      const leaves = [
        ethers.utils.solidityKeccak256(["address", "uint256", "uint256"], [resolver1.address, ethers.utils.parseEther("3.0"), 1]),
        ethers.utils.solidityKeccak256(["address", "uint256", "uint256"], [resolver2.address, ethers.utils.parseEther("3.0"), 2]),
        ethers.utils.solidityKeccak256(["address", "uint256", "uint256"], [resolver3.address, ethers.utils.parseEther("4.0"), 3])
      ];
      
      // Simple merkle root calculation (in production, use proper merkle tree library)
      const merkleRoot = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "bytes32", "bytes32"], leaves)
      );

      // User initiates swap with partial fills enabled
      await stellarBridge.connect(user).initiateSwap(
        ethers.constants.AddressZero,
        swapAmount,
        secretHash,
        timelock,
        stellarAccount,
        true, // Enable partial fills
        merkleRoot,
        { value: swapAmount }
      );

      // Get swap ID
      const filter = stellarBridge.filters.SwapInitiated();
      const events = await stellarBridge.queryFilter(filter);
      const swapId = events[events.length - 1].args.swapId;

      // Resolvers execute partial fills
      const fillAmount1 = ethers.utils.parseEther("3.0");
      const fillAmount2 = ethers.utils.parseEther("3.0");
      const fillAmount3 = ethers.utils.parseEther("4.0");

      // Create merkle proofs (simplified)
      const proof1 = [leaves[1], leaves[2]];
      const proof2 = [leaves[0], leaves[2]];
      const proof3 = [leaves[0], leaves[1]];

      // Execute partial fills
      await expect(
        stellarBridge.connect(resolver1).executePartialFill(
          swapId,
          fillAmount1,
          proof1,
          1
        )
      ).to.emit(stellarBridge, "PartialFillExecuted");

      await expect(
        stellarBridge.connect(resolver2).executePartialFill(
          swapId,
          fillAmount2,
          proof2,
          2
        )
      ).to.emit(stellarBridge, "PartialFillExecuted");

      await expect(
        stellarBridge.connect(resolver3).executePartialFill(
          swapId,
          fillAmount3,
          proof3,
          3
        )
      ).to.emit(stellarBridge, "PartialFillExecuted");

      // Verify swap completion
      const finalDetails = await stellarBridge.getSwapDetails(swapId);
      expect(finalDetails.state).to.equal(2); // COMPLETED
      expect(finalDetails.filled).to.equal(swapAmount);

      // Verify resolver rewards
      const resolver1Balance = await ethers.provider.getBalance(resolver1.address);
      const resolver2Balance = await ethers.provider.getBalance(resolver2.address);
      const resolver3Balance = await ethers.provider.getBalance(resolver3.address);
      
      // Resolvers should have received rewards (accounting for gas costs)
      expect(resolver1Balance).to.be.gt(ethers.utils.parseEther("4.9"));
      expect(resolver2Balance).to.be.gt(ethers.utils.parseEther("4.9"));
      expect(resolver3Balance).to.be.gt(ethers.utils.parseEther("4.9"));
    });

    it("Should handle swap timeout and refund", async function () {
      const swapAmount = ethers.utils.parseEther("1.0");
      const secretHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("timeoutsecret"));
      const timelock = (await time.latest()) + 60; // 1 minute
      const stellarAccount = "GTIMEOUT90ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJK";

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      // User initiates swap
      await stellarBridge.connect(user).initiateSwap(
        ethers.constants.AddressZero,
        swapAmount,
        secretHash,
        timelock,
        stellarAccount,
        false,
        ethers.constants.HashZero,
        { value: swapAmount }
      );

      // Get swap ID
      const filter = stellarBridge.filters.SwapInitiated();
      const events = await stellarBridge.queryFilter(filter);
      const swapId = events[events.length - 1].args.swapId;

      // Advance time past timelock
      await time.increaseTo(timelock + 1);

      // User should be able to refund
      await expect(
        stellarBridge.connect(user).refundSwap(swapId)
      ).to.emit(stellarBridge, "SwapRefunded");

      // Verify swap state
      const swapDetails = await stellarBridge.getSwapDetails(swapId);
      expect(swapDetails.state).to.equal(3); // REFUNDED

      // Verify user got refund (accounting for gas costs)
      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      expect(userBalanceAfter).to.be.gt(userBalanceBefore.sub(ethers.utils.parseEther("0.1")));
    });

    it("Should prevent double spending and replay attacks", async function () {
      const swapAmount = ethers.utils.parseEther("1.0");
      const secret = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("replaytest"));
      const secretHash = ethers.utils.keccak256(secret);
      const timelock = (await time.latest()) + 3600;
      const stellarAccount = "GREPLAY567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJK";

      // Initiate first swap
      await stellarBridge.connect(user).initiateSwap(
        ethers.constants.AddressZero,
        swapAmount,
        secretHash,
        timelock,
        stellarAccount,
        false,
        ethers.constants.HashZero,
        { value: swapAmount }
      );

      // Get swap ID
      const filter = stellarBridge.filters.SwapInitiated();
      const events = await stellarBridge.queryFilter(filter);
      const swapId = events[events.length - 1].args.swapId;

      // Complete the swap
      await stellarBridge.completeSwap(swapId, secret);

      // Try to complete again - should fail
      await expect(
        stellarBridge.completeSwap(swapId, secret)
      ).to.be.revertedWith("Swap already completed");

      // Try to refund completed swap - should fail
      await expect(
        stellarBridge.connect(user).refundSwap(swapId)
      ).to.be.revertedWith("Swap not refundable");
    });

    it("Should handle cross-chain state synchronization", async function () {
      const swapAmount = ethers.utils.parseEther("5.0");
      const secretHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("synctest"));
      const timelock = (await time.latest()) + 3600;
      const stellarAccount = "GSYNC34567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJK";

      // Initiate swap
      await stellarBridge.connect(user).initiateSwap(
        ethers.constants.AddressZero,
        swapAmount,
        secretHash,
        timelock,
        stellarAccount,
        false,
        ethers.constants.HashZero,
        { value: swapAmount }
      );

      // Get swap ID and verify initial state
      const filter = stellarBridge.filters.SwapInitiated();
      const events = await stellarBridge.queryFilter(filter);
      const swapId = events[events.length - 1].args.swapId;

      let swapDetails = await stellarBridge.getSwapDetails(swapId);
      expect(swapDetails.state).to.equal(0); // INITIATED

      // Simulate Stellar-side lock confirmation
      // In a real scenario, this would be triggered by Stellar monitoring
      await stellarBridge.updateSwapState(swapId, 1); // LOCKED_SOURCE

      swapDetails = await stellarBridge.getSwapDetails(swapId);
      expect(swapDetails.state).to.equal(1); // LOCKED_SOURCE

      // Verify analytics are updated
      const analytics = await stellarBridge.getAnalytics();
      expect(analytics.activeSwaps).to.be.gt(0);
      expect(analytics.totalSwapVolume).to.be.gte(swapAmount);
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("Should handle insufficient balance gracefully", async function () {
      const swapAmount = ethers.utils.parseEther("1000.0"); // More than user has
      const secretHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("pooruser"));
      const timelock = (await time.latest()) + 3600;
      const stellarAccount = "GPOOR567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJK";

      await expect(
        stellarBridge.connect(user).initiateSwap(
          ethers.constants.AddressZero,
          swapAmount,
          secretHash,
          timelock,
          stellarAccount,
          false,
          ethers.constants.HashZero,
          { value: ethers.utils.parseEther("1.0") } // Insufficient value
        )
      ).to.be.revertedWith("Insufficient value sent");
    });

    it("Should handle malformed Stellar addresses", async function () {
      const swapAmount = ethers.utils.parseEther("1.0");
      const secretHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("malformed"));
      const timelock = (await time.latest()) + 3600;
      const badStellarAccount = "INVALID_STELLAR_ADDRESS";

      await expect(
        stellarBridge.connect(user).initiateSwap(
          ethers.constants.AddressZero,
          swapAmount,
          secretHash,
          timelock,
          badStellarAccount,
          false,
          ethers.constants.HashZero,
          { value: swapAmount }
        )
      ).to.be.revertedWith("Invalid Stellar address");
    });

    it("Should prevent unauthorized resolver operations", async function () {
      const swapAmount = ethers.utils.parseEther("2.0");
      const secretHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("unauthorized"));
      const timelock = (await time.latest()) + 3600;
      const stellarAccount = "GUNAUTH567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJK";

      // Create merkle root
      const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fake_root"));

      // Initiate swap with partial fills
      await stellarBridge.connect(user).initiateSwap(
        ethers.constants.AddressZero,
        swapAmount,
        secretHash,
        timelock,
        stellarAccount,
        true,
        merkleRoot,
        { value: swapAmount }
      );

      // Get swap ID
      const filter = stellarBridge.filters.SwapInitiated();
      const events = await stellarBridge.queryFilter(filter);
      const swapId = events[events.length - 1].args.swapId;

      // Unregistered resolver tries to execute partial fill
      await expect(
        stellarBridge.connect(resolver1).executePartialFill(
          swapId,
          ethers.utils.parseEther("1.0"),
          [],
          1
        )
      ).to.be.revertedWith("Resolver not registered");
    });
  });
});
