import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PartialFillManager, ResolverRegistry } from "../typechain-types";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("🔗 Partial Fill Tests", function () {
  let partialFillManager: PartialFillManager;
  let resolverRegistry: ResolverRegistry;
  let owner: SignerWithAddress;
  let resolver1: SignerWithAddress;
  let resolver2: SignerWithAddress;
  let resolver3: SignerWithAddress;
  let user: SignerWithAddress;

  async function deployFixture() {
    const [owner, resolver1, resolver2, resolver3, user] = await ethers.getSigners();

    // Deploy ResolverRegistry
    const ResolverRegistry = await ethers.getContractFactory("ResolverRegistry");
    const resolverRegistry = await ResolverRegistry.deploy();

    // Deploy PartialFillManager
    const PartialFillManager = await ethers.getContractFactory("PartialFillManager");
    const partialFillManager = await PartialFillManager.deploy(resolverRegistry.address);

    // Register resolvers
    const stakeAmount = ethers.utils.parseEther("2.0");
    await resolverRegistry.connect(resolver1).registerResolver({ value: stakeAmount });
    await resolverRegistry.connect(resolver2).registerResolver({ value: stakeAmount });
    await resolverRegistry.connect(resolver3).registerResolver({ value: stakeAmount });

    return {
      partialFillManager,
      resolverRegistry,
      owner,
      resolver1,
      resolver2,
      resolver3,
      user
    };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployFixture);
    partialFillManager = fixture.partialFillManager;
    resolverRegistry = fixture.resolverRegistry;
    owner = fixture.owner;
    resolver1 = fixture.resolver1;
    resolver2 = fixture.resolver2;
    resolver3 = fixture.resolver3;
    user = fixture.user;
  });

  describe("Merkle Tree Partial Fills", function () {
    it("Should validate correct merkle proofs", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test_swap_1"));
      const totalAmount = ethers.utils.parseEther("10.0");

      // Create partial fill data
      const fills = [
        { resolver: resolver1.address, amount: ethers.utils.parseEther("3.0"), nonce: 1 },
        { resolver: resolver2.address, amount: ethers.utils.parseEther("3.0"), nonce: 2 },
        { resolver: resolver3.address, amount: ethers.utils.parseEther("4.0"), nonce: 3 }
      ];

      // Generate leaves
      const leaves = fills.map(fill => 
        ethers.utils.solidityKeccak256(
          ["address", "uint256", "uint256"],
          [fill.resolver, fill.amount, fill.nonce]
        )
      );

      // Simple merkle root (in production, use proper merkle tree)
      const merkleRoot = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "bytes32", "bytes32"], leaves)
      );

      // Initialize partial fill session
      await partialFillManager.initializePartialFill(
        swapId,
        totalAmount,
        merkleRoot,
        user.address
      );

      // Execute first partial fill
      const proof1 = [leaves[1], leaves[2]];
      await expect(
        partialFillManager.connect(resolver1).executePartialFill(
          swapId,
          fills[0].amount,
          proof1,
          fills[0].nonce
        )
      ).to.emit(partialFillManager, "PartialFillExecuted")
        .withArgs(swapId, resolver1.address, fills[0].amount);

      // Verify fill was recorded
      const fillInfo = await partialFillManager.getPartialFillInfo(swapId);
      expect(fillInfo.totalFilled).to.equal(fills[0].amount);
      expect(fillInfo.fillCount).to.equal(1);
    });

    it("Should reject invalid merkle proofs", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test_swap_2"));
      const totalAmount = ethers.utils.parseEther("10.0");
      const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fake_root"));

      await partialFillManager.initializePartialFill(
        swapId,
        totalAmount,
        merkleRoot,
        user.address
      );

      // Try to execute with invalid proof
      const invalidProof = [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fake"))];
      await expect(
        partialFillManager.connect(resolver1).executePartialFill(
          swapId,
          ethers.utils.parseEther("3.0"),
          invalidProof,
          1
        )
      ).to.be.revertedWith("Invalid merkle proof");
    });

    it("Should prevent double spending with nonces", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test_swap_3"));
      const totalAmount = ethers.utils.parseEther("6.0");
      const fillAmount = ethers.utils.parseEther("3.0");
      const nonce = 1;

      // Create single leaf merkle tree
      const leaf = ethers.utils.solidityKeccak256(
        ["address", "uint256", "uint256"],
        [resolver1.address, fillAmount, nonce]
      );
      const merkleRoot = leaf; // Single leaf is its own root

      await partialFillManager.initializePartialFill(
        swapId,
        totalAmount,
        merkleRoot,
        user.address
      );

      // First execution should succeed
      await partialFillManager.connect(resolver1).executePartialFill(
        swapId,
        fillAmount,
        [],
        nonce
      );

      // Second execution with same nonce should fail
      await expect(
        partialFillManager.connect(resolver1).executePartialFill(
          swapId,
          fillAmount,
          [],
          nonce
        )
      ).to.be.revertedWith("Nonce already used");
    });

    it("Should handle partial fill completion correctly", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test_swap_4"));
      const totalAmount = ethers.utils.parseEther("9.0");

      const fills = [
        { resolver: resolver1.address, amount: ethers.utils.parseEther("3.0"), nonce: 1 },
        { resolver: resolver2.address, amount: ethers.utils.parseEther("3.0"), nonce: 2 },
        { resolver: resolver3.address, amount: ethers.utils.parseEther("3.0"), nonce: 3 }
      ];

      const leaves = fills.map(fill => 
        ethers.utils.solidityKeccak256(
          ["address", "uint256", "uint256"],
          [fill.resolver, fill.amount, fill.nonce]
        )
      );

      const merkleRoot = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "bytes32", "bytes32"], leaves)
      );

      await partialFillManager.initializePartialFill(
        swapId,
        totalAmount,
        merkleRoot,
        user.address
      );

      // Execute all partial fills
      for (let i = 0; i < fills.length; i++) {
        const fill = fills[i];
        const proof = leaves.filter((_, index) => index !== i);
        
        await partialFillManager.connect(ethers.provider.getSigner(fill.resolver)).executePartialFill(
          swapId,
          fill.amount,
          proof,
          fill.nonce
        );
      }

      // Verify completion
      const fillInfo = await partialFillManager.getPartialFillInfo(swapId);
      expect(fillInfo.totalFilled).to.equal(totalAmount);
      expect(fillInfo.completed).to.be.true;
      expect(fillInfo.fillCount).to.equal(3);
    });

    it("Should prevent overfilling", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test_swap_5"));
      const totalAmount = ethers.utils.parseEther("5.0");
      const fillAmount = ethers.utils.parseEther("6.0"); // More than total

      const leaf = ethers.utils.solidityKeccak256(
        ["address", "uint256", "uint256"],
        [resolver1.address, fillAmount, 1]
      );

      await partialFillManager.initializePartialFill(
        swapId,
        totalAmount,
        leaf,
        user.address
      );

      await expect(
        partialFillManager.connect(resolver1).executePartialFill(
          swapId,
          fillAmount,
          [],
          1
        )
      ).to.be.revertedWith("Fill amount exceeds remaining");
    });
  });

  describe("Dutch Auction Mechanism", function () {
    it("Should implement proper price decay", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("auction_test_1"));
      const totalAmount = ethers.utils.parseEther("10.0");
      const startPrice = 10000; // 100.00% (in basis points)
      const reservePrice = 9500; // 95.00%
      const duration = 300; // 5 minutes

      const currentTime = await time.latest();
      
      await partialFillManager.startDutchAuction(
        swapId,
        totalAmount,
        startPrice,
        reservePrice,
        duration,
        user.address
      );

      // Check initial price
      let currentPrice = await partialFillManager.getCurrentPrice(swapId);
      expect(currentPrice).to.equal(startPrice);

      // Advance time to middle of auction
      await time.increaseTo(currentTime + 150); // 2.5 minutes

      // Check price has decreased
      currentPrice = await partialFillManager.getCurrentPrice(swapId);
      expect(currentPrice).to.be.lt(startPrice);
      expect(currentPrice).to.be.gt(reservePrice);

      // Advance to end of auction
      await time.increaseTo(currentTime + duration);

      // Check price has reached reserve
      currentPrice = await partialFillManager.getCurrentPrice(swapId);
      expect(currentPrice).to.equal(reservePrice);
    });

    it("Should accept bids at or above current price", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("auction_test_2"));
      const totalAmount = ethers.utils.parseEther("6.0");
      const startPrice = 10000;
      const reservePrice = 9500;
      const duration = 600;

      await partialFillManager.startDutchAuction(
        swapId,
        totalAmount,
        startPrice,
        reservePrice,
        duration,
        user.address
      );

      const fillAmount = ethers.utils.parseEther("2.0");
      const bidPrice = 9900; // 99%

      // Advance time so current price is below bid price
      await time.increase(180); // 3 minutes

      const currentPrice = await partialFillManager.getCurrentPrice(swapId);
      expect(bidPrice).to.be.gte(currentPrice);

      // Submit bid
      await expect(
        partialFillManager.connect(resolver1).submitAuctionBid(
          swapId,
          fillAmount,
          bidPrice
        )
      ).to.emit(partialFillManager, "AuctionBidSubmitted")
        .withArgs(swapId, resolver1.address, fillAmount, bidPrice);
    });

    it("Should reject bids below current price", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("auction_test_3"));
      const totalAmount = ethers.utils.parseEther("4.0");
      const startPrice = 10000;
      const reservePrice = 9000;
      const duration = 600;

      await partialFillManager.startDutchAuction(
        swapId,
        totalAmount,
        startPrice,
        reservePrice,
        duration,
        user.address
      );

      const fillAmount = ethers.utils.parseEther("2.0");
      const lowBidPrice = 8000; // 80% - too low

      await expect(
        partialFillManager.connect(resolver1).submitAuctionBid(
          swapId,
          fillAmount,
          lowBidPrice
        )
      ).to.be.revertedWith("Bid below current price");
    });

    it("Should finalize auction and execute winning bids", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("auction_test_4"));
      const totalAmount = ethers.utils.parseEther("9.0");
      const startPrice = 10000;
      const reservePrice = 9500;
      const duration = 300;

      await partialFillManager.startDutchAuction(
        swapId,
        totalAmount,
        startPrice,
        reservePrice,
        duration,
        user.address
      );

      // Submit multiple bids
      await partialFillManager.connect(resolver1).submitAuctionBid(
        swapId,
        ethers.utils.parseEther("3.0"),
        9900
      );

      await partialFillManager.connect(resolver2).submitAuctionBid(
        swapId,
        ethers.utils.parseEther("3.0"),
        9800
      );

      await partialFillManager.connect(resolver3).submitAuctionBid(
        swapId,
        ethers.utils.parseEther("3.0"),
        9700
      );

      // End auction
      await time.increase(duration + 1);

      // Finalize auction
      await expect(
        partialFillManager.finalizeAuction(swapId)
      ).to.emit(partialFillManager, "AuctionFinalized");

      // Check that all bids were accepted (total exactly matches)
      const auctionInfo = await partialFillManager.getAuctionInfo(swapId);
      expect(auctionInfo.totalFilled).to.equal(totalAmount);
      expect(auctionInfo.finalized).to.be.true;
    });
  });

  describe("Gas Optimization", function () {
    it("Should batch multiple partial fills efficiently", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("batch_test_1"));
      const totalAmount = ethers.utils.parseEther("12.0");

      // Create batch fill data
      const batchFills = [
        { resolver: resolver1.address, amount: ethers.utils.parseEther("4.0"), nonce: 1 },
        { resolver: resolver2.address, amount: ethers.utils.parseEther("4.0"), nonce: 2 },
        { resolver: resolver3.address, amount: ethers.utils.parseEther("4.0"), nonce: 3 }
      ];

      const leaves = batchFills.map(fill => 
        ethers.utils.solidityKeccak256(
          ["address", "uint256", "uint256"],
          [fill.resolver, fill.amount, fill.nonce]
        )
      );

      const merkleRoot = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "bytes32", "bytes32"], leaves)
      );

      await partialFillManager.initializePartialFill(
        swapId,
        totalAmount,
        merkleRoot,
        user.address
      );

      // Execute batch fill
      const resolvers = batchFills.map(fill => fill.resolver);
      const amounts = batchFills.map(fill => fill.amount);
      const nonces = batchFills.map(fill => fill.nonce);
      const proofs = batchFills.map((_, i) => leaves.filter((_, j) => i !== j));

      await expect(
        partialFillManager.executeBatchPartialFill(
          swapId,
          resolvers,
          amounts,
          proofs,
          nonces
        )
      ).to.emit(partialFillManager, "BatchPartialFillExecuted");

      // Verify all fills were processed
      const fillInfo = await partialFillManager.getPartialFillInfo(swapId);
      expect(fillInfo.totalFilled).to.equal(totalAmount);
      expect(fillInfo.fillCount).to.equal(3);
      expect(fillInfo.completed).to.be.true;
    });

    it("Should optimize gas for large numbers of resolvers", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("gas_test_1"));
      const totalAmount = ethers.utils.parseEther("100.0");

      // Test with many small fills
      const numResolvers = 10;
      const fillAmount = ethers.utils.parseEther("10.0");

      // Create leaves for all resolvers
      const leaves = [];
      for (let i = 0; i < numResolvers; i++) {
        const resolverAddress = ethers.Wallet.createRandom().address;
        leaves.push(
          ethers.utils.solidityKeccak256(
            ["address", "uint256", "uint256"],
            [resolverAddress, fillAmount, i + 1]
          )
        );
      }

      // Create merkle root
      let merkleRoot = leaves[0];
      for (let i = 1; i < leaves.length; i++) {
        merkleRoot = ethers.utils.keccak256(
          ethers.utils.solidityPack(["bytes32", "bytes32"], [merkleRoot, leaves[i]])
        );
      }

      await partialFillManager.initializePartialFill(
        swapId,
        totalAmount,
        merkleRoot,
        user.address
      );

      // Measure gas for batch operation vs individual operations
      const batchTx = await partialFillManager.populateTransaction.executeBatchPartialFill(
        swapId,
        leaves.slice(0, 3).map(() => resolver1.address), // Use same resolver for simplicity
        Array(3).fill(fillAmount.div(10)),
        Array(3).fill([]),
        [1, 2, 3]
      );

      const estimatedBatchGas = await ethers.provider.estimateGas(batchTx);
      
      // Batch operation should be more efficient than individual operations
      expect(estimatedBatchGas).to.be.lt(200000 * 3); // Less than 3 individual operations
    });
  });

  describe("MEV Protection", function () {
    it("Should prevent front-running with commit-reveal", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("mev_test_1"));
      const totalAmount = ethers.utils.parseEther("8.0");
      const fillAmount = ethers.utils.parseEther("4.0");

      // Enable commit-reveal protection
      await partialFillManager.enableMEVProtection(swapId, 60); // 1 minute commit phase

      // Resolver commits to a fill
      const secret = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("secret123"));
      const commitment = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["address", "uint256", "bytes32"],
          [resolver1.address, fillAmount, secret]
        )
      );

      await partialFillManager.connect(resolver1).commitToFill(swapId, commitment);

      // Try to reveal before commit phase ends - should fail
      await expect(
        partialFillManager.connect(resolver1).revealFill(
          swapId,
          fillAmount,
          secret
        )
      ).to.be.revertedWith("Commit phase not ended");

      // Advance time past commit phase
      await time.increase(61);

      // Now reveal should work
      await expect(
        partialFillManager.connect(resolver1).revealFill(
          swapId,
          fillAmount,
          secret
        )
      ).to.emit(partialFillManager, "FillRevealed");
    });

    it("Should reject invalid reveals", async function () {
      const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("mev_test_2"));
      const fillAmount = ethers.utils.parseEther("3.0");

      await partialFillManager.enableMEVProtection(swapId, 30);

      const secret = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("secret456"));
      const commitment = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["address", "uint256", "bytes32"],
          [resolver1.address, fillAmount, secret]
        )
      );

      await partialFillManager.connect(resolver1).commitToFill(swapId, commitment);
      await time.increase(31);

      // Try to reveal with wrong secret
      const wrongSecret = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("wrongsecret"));
      await expect(
        partialFillManager.connect(resolver1).revealFill(
          swapId,
          fillAmount,
          wrongSecret
        )
      ).to.be.revertedWith("Invalid reveal");

      // Try to reveal with wrong amount
      await expect(
        partialFillManager.connect(resolver1).revealFill(
          swapId,
          ethers.utils.parseEther("5.0"), // Wrong amount
          secret
        )
      ).to.be.revertedWith("Invalid reveal");
    });
  });
});
