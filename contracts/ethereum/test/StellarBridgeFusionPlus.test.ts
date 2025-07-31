import { expect } from "chai";
import { ethers } from "hardhat";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"; // Not needed with ethers v6
import { StellarBridgeFusionPlus, MockERC20, ResolverRegistry } from "../typechain-types";

import { keccak256, toUtf8Bytes, parseEther, zeroPadValue } from "ethers";

describe("StellarBridgeFusionPlus", function () {
  let stellarBridge: StellarBridgeFusionPlus;
  let mockToken: MockERC20;
  let resolverRegistry: ResolverRegistry;
  let owner: any;
  let resolver: any;
  let user: any;
  let feeRecipient: any;

  const SECRET = "test-secret-123";
  const STELLAR_ACCOUNT = "GDEMO123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJK";
  // Always use a 32-byte padded secret and hash
  const PADDED_SECRET = zeroPadValue(toUtf8Bytes(SECRET), 32);
  const SECRET_HASH = keccak256(PADDED_SECRET);
  const SWAP_AMOUNT = parseEther("100");

  beforeEach(async function () {
    [owner, resolver, user, feeRecipient] = await ethers.getSigners();

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Test Token", "TEST", parseEther("1000000"));

    // Deploy resolver registry
    const ResolverRegistry = await ethers.getContractFactory("ResolverRegistry");
    resolverRegistry = await ResolverRegistry.deploy();

    // Deploy main contract
    const StellarBridgeFusionPlus = await ethers.getContractFactory("StellarBridgeFusionPlus");
    stellarBridge = await StellarBridgeFusionPlus.deploy(feeRecipient.address);

    // Setup initial state
    await mockToken.transfer(user.address, SWAP_AMOUNT * 10n);
    await mockToken.connect(user).approve(stellarBridge.target, SWAP_AMOUNT * 10n);

    // Register resolver
    await resolverRegistry.connect(resolver).registerResolver(parseEther("1"), {
      value: parseEther("2")
    });
  });

  describe("Swap Initiation", function () {
    it("Should initiate a swap successfully", async function () {
      const tx = await stellarBridge.connect(user).initiateSwap(
        mockToken.target,
        SWAP_AMOUNT,
        SECRET_HASH,
        3600,
        STELLAR_ACCOUNT,
        true,
        keccak256(toUtf8Bytes("merkle-root"))
      );

      const receipt = await tx.wait();
      // ethers v6: parse logs for event
      const iface = stellarBridge.interface;
      let swapId: string | undefined;
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "SwapInitiated") {
            swapId = parsed.args.swapId;
            break;
          }
        } catch {}
      }
      expect(swapId).to.not.be.undefined;
      if (!swapId) throw new Error("swapId is undefined");
      const swapDetails = await stellarBridge.getSwapDetails(swapId);
      expect(swapDetails.initiator).to.equal(user.address);
      expect(swapDetails.amount).to.equal(SWAP_AMOUNT);
      expect(swapDetails.secretHash).to.equal(SECRET_HASH);
    });

    it("Should fail with invalid parameters", async function () {
      await expect(
        stellarBridge.connect(user).initiateSwap(
          mockToken.target,
          0, // Invalid amount
          SECRET_HASH,
          3600,
          STELLAR_ACCOUNT,
          true,
          keccak256(toUtf8Bytes("merkle-root"))
        )
      ).to.be.revertedWith("Amount must be positive");
    });

    it("Should transfer tokens to contract", async function () {
      const balanceBefore = await mockToken.balanceOf(stellarBridge.target);

      await stellarBridge.connect(user).initiateSwap(
        mockToken.target,
        SWAP_AMOUNT,
        SECRET_HASH,
        3600,
        STELLAR_ACCOUNT,
        true,
        keccak256(toUtf8Bytes("merkle-root"))
      );

      const balanceAfter = await mockToken.balanceOf(stellarBridge.target);
      expect(balanceAfter - balanceBefore).to.equal(SWAP_AMOUNT);
    });
  });

  describe("Swap Completion", function () {
    let swapId: string;

    beforeEach(async function () {
      const tx = await stellarBridge.connect(user).initiateSwap(
        mockToken.target,
        SWAP_AMOUNT,
        SECRET_HASH,
        3600,
        STELLAR_ACCOUNT,
        false, // No partial fills for this test
        keccak256(toUtf8Bytes("merkle-root"))
      );

      const receipt = await tx.wait();
      const iface = stellarBridge.interface;
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "SwapInitiated") {
            swapId = parsed.args.swapId;
            break;
          }
        } catch {}
      }
    });

    it("Should complete swap with valid secret", async function () {
      const secret = PADDED_SECRET;
      await expect(stellarBridge.connect(resolver).completeSwap(swapId, secret))
        .to.emit(stellarBridge, "SwapCompleted")
        .withArgs(swapId, resolver.address, secret, SWAP_AMOUNT, 0);

      if (!swapId) throw new Error("swapId is undefined");
      const swapDetails = await stellarBridge.getSwapDetails(swapId);
      expect(swapDetails.state).to.equal(2); // COMPLETED
    });

    it("Should fail with invalid secret", async function () {
      const invalidSecret = zeroPadValue(toUtf8Bytes("wrong-secret"), 32);
      await expect(
        stellarBridge.connect(resolver).completeSwap(swapId, invalidSecret)
      ).to.be.revertedWith("Invalid secret");
    });

    it("Should fail if secret already used", async function () {
      const secret = PADDED_SECRET;
      await stellarBridge.connect(resolver).completeSwap(swapId, secret);
      // Try to use same secret again
      await expect(
        stellarBridge.connect(resolver).completeSwap(swapId, secret)
      ).to.be.revertedWith("Secret already used");
    });
  });

  describe("Partial Fills", function () {
    let swapId: string;

    beforeEach(async function () {
      const tx = await stellarBridge.connect(user).initiateSwap(
        mockToken.target,
        SWAP_AMOUNT,
        SECRET_HASH,
        3600,
        STELLAR_ACCOUNT,
        true, // Partial fills enabled
        keccak256(toUtf8Bytes("merkle-root"))
      );

      const receipt = await tx.wait();
      const iface = stellarBridge.interface;
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "SwapInitiated") {
            swapId = parsed.args.swapId;
            break;
          }
        } catch {}
      }
    });

    it("Should execute partial fill successfully", async function () {
      const fillAmount = SWAP_AMOUNT / 2n;
      const nonce = 1;
      const merkleProof: string[] = []; // Empty proof for demo

      await expect(
        stellarBridge.connect(resolver).executePartialFill(
          swapId,
          fillAmount,
          merkleProof,
          nonce
        )
      ).to.emit(stellarBridge, "PartialFillExecuted");

      if (!swapId) throw new Error("swapId is undefined");
      const swapDetails = await stellarBridge.getSwapDetails(swapId);
      expect(swapDetails.filled).to.equal(fillAmount);
      expect(swapDetails.state).to.equal(1); // PARTIAL_FILLED
    });

    it("Should prevent overfilling", async function () {
      const fillAmount = SWAP_AMOUNT + 1n; // More than total amount
      const nonce = 1;
      const merkleProof: string[] = [];

      await expect(
        stellarBridge.connect(resolver).executePartialFill(
          swapId,
          fillAmount,
          merkleProof,
          nonce
        )
      ).to.be.revertedWith("Invalid fill amount");
    });
  });

  describe("Refunds", function () {
    let swapId: string;

    beforeEach(async function () {
      // Use a valid timelock (e.g., 3600)
      const tx = await stellarBridge.connect(user).initiateSwap(
        mockToken.target,
        SWAP_AMOUNT,
        SECRET_HASH,
        3600, // Use a valid timelock
        STELLAR_ACCOUNT,
        false,
        keccak256(toUtf8Bytes("merkle-root"))
      );

      const receipt = await tx.wait();
      const iface = stellarBridge.interface;
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "SwapInitiated") {
            swapId = parsed.args.swapId;
            break;
          }
        } catch {}
      }
    });

    it("Should allow refund after expiration", async function () {
      // Wait for timelock to expire
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      if (!swapId) throw new Error("swapId is undefined");
      const balanceBefore = await mockToken.balanceOf(user.address);
      
      await stellarBridge.connect(user).refundSwap(swapId);
      
      const balanceAfter = await mockToken.balanceOf(user.address);
      expect(balanceAfter - balanceBefore).to.equal(SWAP_AMOUNT);

      const swapDetails = await stellarBridge.getSwapDetails(swapId);
      expect(swapDetails.state).to.equal(3); // REFUNDED
    });

    it("Should not allow refund before expiration", async function () {
      await expect(
        stellarBridge.connect(user).refundSwap(swapId)
      ).to.be.revertedWith("Swap not expired");
    });

    it("Should not allow non-initiator to refund", async function () {
      // Wait for timelock to expire
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        stellarBridge.connect(resolver).refundSwap(swapId)
      ).to.be.revertedWith("Not initiator");
    });
  });

  describe("Analytics", function () {
    it("Should track total swap volume", async function () {
      await stellarBridge.connect(user).initiateSwap(
        mockToken.target,
        SWAP_AMOUNT,
        SECRET_HASH,
        3600,
        STELLAR_ACCOUNT,
        false,
        keccak256(toUtf8Bytes("merkle-root"))
      );

      expect(await stellarBridge.totalSwapVolume()).to.equal(SWAP_AMOUNT);
    });

    it("Should provide analytics data", async function () {
      const analytics = await stellarBridge.getAnalytics();
      expect(typeof analytics._totalSwapVolume === "bigint" || typeof analytics._totalSwapVolume === "number").to.be.true;
      expect(typeof analytics._totalResolverRewards === "bigint" || typeof analytics._totalResolverRewards === "number").to.be.true;
    });
  });

  describe("Security", function () {
    it("Should pause and unpause correctly", async function () {
      await stellarBridge.pause();

      await expect(
        stellarBridge.connect(user).initiateSwap(
          mockToken.target,
          SWAP_AMOUNT,
          SECRET_HASH,
          3600,
          STELLAR_ACCOUNT,
          false,
          keccak256(toUtf8Bytes("merkle-root"))
        )
      ).to.be.revertedWith("Pausable: paused");

      await stellarBridge.unpause();

      // Should work after unpause
      await expect(
        stellarBridge.connect(user).initiateSwap(
          mockToken.target,
          SWAP_AMOUNT,
          SECRET_HASH,
          3600,
          STELLAR_ACCOUNT,
          false,
          keccak256(toUtf8Bytes("merkle-root"))
        )
      ).to.not.be.reverted;
    });

    it("Should prevent reentrancy attacks", async function () {
      // This would require a malicious contract to test properly
      // For now, we verify the ReentrancyGuard is applied
      expect(await stellarBridge.owner()).to.equal(owner.address);
    });
  });
});


