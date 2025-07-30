import { expect } from "chai";
import { ethers } from "hardhat";
import type { StellarBridge, PartialFillManager, ResolverRegistry } from "../../typechain-types";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("🔗 StellarBridge Cross-Chain Integration Tests", function () {
  let stellarBridge: StellarBridge;
  let partialFillManager: PartialFillManager;
  let resolverRegistry: ResolverRegistry;

  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let resolver1: HardhatEthersSigner;
  let resolver2: HardhatEthersSigner;
  let resolver3: HardhatEthersSigner;

  // Deploy fixture with contracts and signer setup
  async function deployFixture() {
    [owner, user, resolver1, resolver2, resolver3] = await ethers.getSigners() as HardhatEthersSigner[];

    // Deploy ResolverRegistry
    const ResolverRegFactory = await ethers.getContractFactory("ResolverRegistry");
    resolverRegistry = (await ResolverRegFactory.deploy()) as ResolverRegistry;
    await resolverRegistry.waitForDeployment();

    // Deploy PartialFillManager with resolverRegistry address
    const PartialFillFactory = await ethers.getContractFactory("PartialFillManager");
    partialFillManager = (await PartialFillFactory.deploy(resolverRegistry.target)) as PartialFillManager;
    await partialFillManager.waitForDeployment();

    // Deploy StellarBridge with addresses of PartialFillManager and ResolverRegistry
    const StellarBridgeFactory = await ethers.getContractFactory("StellarBridge");
    stellarBridge = (await StellarBridgeFactory.deploy(partialFillManager.target, resolverRegistry.target)) as StellarBridge;
    await stellarBridge.waitForDeployment();

    // Configure contracts
    await partialFillManager.connect(owner).setBridgeContract(stellarBridge.target);
    await resolverRegistry.connect(owner).setBridgeContract(stellarBridge.target);

    return { stellarBridge, partialFillManager, resolverRegistry, owner, user, resolver1, resolver2, resolver3 };
  }

  beforeEach(async () => {
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

  it("performs a successful atomic ETH to XLM swap", async () => {
    const swapAmount = ethers.parseEther("2.0");
    const secret = ethers.randomBytes(32);
    const secretHash = ethers.keccak256(secret);
    const timelock = (await time.latest()) + 3600n; // 1 hour later
    const stellarAccount = "GDRXE2BQUC3AZCBZUAQYDS3HDUOE7Z6B6WFX6VZ4RPZT6WZGZPSHQ7LX";

    const tx = await stellarBridge.connect(user).initiateSwap(
      ethers.ZeroAddress,
      swapAmount,
      secretHash,
      timelock,
      stellarAccount,
      false,
      ethers.HashZero,
      { value: swapAmount }
    );
    const receipt = await tx.wait();

    const event = receipt.events?.find(e => e.event === "SwapInitiated");
    expect(event).to.exist;
    const swapId = event!.args!.swapId;

    const swap = await stellarBridge.getSwap(swapId);
    expect(swap.initiator).to.equal(user.address);
    expect(swap.amount).to.equal(swapAmount);
    expect(swap.hashlock).to.equal(secretHash);
    expect(swap.state).to.equal(0); // Initiated

    await expect(stellarBridge.connect(user).completeSwap(swapId, secret))
      .to.emit(stellarBridge, "SwapCompleted");

    const completed = await stellarBridge.getSwap(swapId);
    expect(completed.state).to.equal(2); // Completed
  });

  it("handles multiple partial fills correctly from different resolvers", async () => {
    const swapAmount = ethers.parseEther("10.0");
    const secret = ethers.randomBytes(32);
    const secretHash = ethers.keccak256(secret);
    const timelock = (await time.latest()) + 7200n; // 2 hours later
    const stellarAccount = "GD37P4PM7P7SHBH7TFHUPXSNHHTPFOUL5WBTEGGD6G536PYRM7KYKQRY";

    const stakeAmount = ethers.parseEther("5.0");
    await resolverRegistry.connect(resolver1).register({ stake: stakeAmount });
    await resolverRegistry.connect(resolver2).register({ stake: stakeAmount });
    await resolverRegistry.connect(resolver3).register({ stake: stakeAmount });

    const leaves = [
      ethers.solidityPackedKeccak256(["address", "uint256", "uint256"], [resolver1.address, stakeAmount, 0]),
      ethers.solidityPackedKeccak256(["address", "uint256", "uint256"], [resolver2.address, stakeAmount, 1]),
      ethers.solidityPackedKeccak256(["address", "uint256", "uint256"], [resolver3.address, stakeAmount, 2]),
    ];
    const merkleRoot = ethers.keccak256(ethers.concat(leaves));

    const tx = await stellarBridge.connect(user).initiateSwap(
      ethers.ZeroAddress,
      swapAmount,
      secretHash,
      timelock,
      stellarAccount,
      true,
      merkleRoot,
      { value: swapAmount }
    );
    const receipt = await tx.wait();

    const event = receipt.events?.find(e => e.event === "SwapInitiated");
    expect(event).to.exist;
    const swapId = event!.args!.swapId;

    // Partial fill simulation (merkle proof arrays left empty for demonstration)
    await expect(
      stellarBridge.connect(resolver1).executePartialFill(swapId, ethers.parseEther("3.0"), [], 0)
    ).to.emit(stellarBridge, "PartialFillExecuted");

    await expect(
      stellarBridge.connect(resolver2).executePartialFill(swapId, ethers.parseEther("3.0"), [], 1)
    ).to.emit(stellarBridge, "PartialFillExecuted");

    await expect(
      stellarBridge.connect(resolver3).executePartialFill(swapId, ethers.parseEther("4.0"), [], 2)
    ).to.emit(stellarBridge, "PartialFillExecuted");

    const finalSwap = await stellarBridge.getSwap(swapId);
    expect(finalSwap.state).to.equal(2);
    expect(finalSwap.filled).to.equal(swapAmount);
  });

  it("allows refund after timelock expires", async () => {
    const swapAmount = ethers.parseEther("1.0");
    const secretHash = ethers.keccak256(ethers.toUtf8Bytes("timeoutsecret"));
    const timelock = (await time.latest()) + 60n; // 1 min later
    const stellarAccount = "GTIMEOUT90ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJK";

    const userBalanceBefore = await ethers.provider.getBalance(user.address);

    await stellarBridge.connect(user).initiateSwap(
      ethers.ZeroAddress,
      swapAmount,
      secretHash,
      timelock,
      stellarAccount,
      false,
      ethers.HashZero,
      { value: swapAmount }
    );

    const filter = stellarBridge.filters.SwapInitiated();
    const events = await stellarBridge.queryFilter(filter);
    const swapId = events[events.length - 1].args.swapId;

    await time.increaseTo(timelock + 1n);

    await expect(stellarBridge.connect(user).refundSwap(swapId)).to.emit(
      stellarBridge,
      "SwapRefunded"
    );

    const swapDetails = await stellarBridge.getSwap(swapId);
    expect(swapDetails.state).to.equal(3);

    const userBalanceAfter = await ethers.provider.getBalance(user.address);
    expect(userBalanceAfter).to.be.gt(userBalanceBefore.sub(ethers.parseEther("0.1")));
  });

  it("blocks replay and double spending", async () => {
    const swapAmount = ethers.parseEther("1.0");
    const secret = ethers.randomBytes(32);
    const secretHash = ethers.keccak256(secret);
    const timelock = (await time.latest()) + 3600n;
    const stellarAccount = "GREPLAY567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJK";

    await stellarBridge.connect(user).initiateSwap(
      ethers.ZeroAddress,
      swapAmount,
      secretHash,
      timelock,
      stellarAccount,
      false,
      ethers.HashZero,
      { value: swapAmount }
    );

    const filter = stellarBridge.filters.SwapInitiated();
    const events = await stellarBridge.queryFilter(filter);
    const swapId = events[events.length - 1].args.swapId;

    await stellarBridge.connect(user).completeSwap(swapId, secret);

    await expect(stellarBridge.completeSwap(swapId, secret)).to.be.revertedWith(
      "Swap already completed"
    );

    await expect(stellarBridge.connect(user).refundSwap(swapId)).to.be.revertedWith(
      "Swap not refundable"
    );
  });
});
