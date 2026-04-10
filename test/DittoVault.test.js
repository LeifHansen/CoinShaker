const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DittoVault", function () {
  let dittoCoin, vault, mockPriceFeed;
  let owner, treasury, depositor1, depositor2;

  const INITIAL_SUPPLY = ethers.parseEther("420000000000"); // 420B
  const REWARD_POOL = ethers.parseEther("5000000000");      // 5B for rewards
  const ETH_PRICE = 2000_00000000n; // $2000 with 8 decimals (Chainlink format)

  // Deploy a mock Chainlink price feed
  async function deployMockPriceFeed(price, decimals = 8) {
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    return MockPriceFeed.deploy(price, decimals);
  }

  beforeEach(async function () {
    [owner, treasury, depositor1, depositor2] = await ethers.getSigners();

    // Deploy DittoCoin
    const DittoCoin = await ethers.getContractFactory("DittoCoin");
    dittoCoin = await DittoCoin.deploy(treasury.address);

    // Deploy mock price feed for ETH ($2000)
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockPriceFeed = await MockPriceFeed.deploy(ETH_PRICE, 8);

    // Deploy Vault
    const DittoVault = await ethers.getContractFactory("DittoVault");
    vault = await DittoVault.deploy(await dittoCoin.getAddress());

    // Exempt vault from fees
    await dittoCoin.setExempt(await vault.getAddress(), true);

    // Fund reward pool
    await dittoCoin.approve(await vault.getAddress(), REWARD_POOL);
    await vault.fundRewardPool(REWARD_POOL);

    // Add ETH as supported asset
    await vault.addAsset(ethers.ZeroAddress, await mockPriceFeed.getAddress(), 18);
  });

  // ── Deployment ──────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set correct token", async function () {
      expect(await vault.dittoToken()).to.equal(await dittoCoin.getAddress());
    });

    it("should have correct base APR", async function () {
      expect(await vault.baseAprBps()).to.equal(500); // 5%
    });

    it("should have funded reward pool", async function () {
      expect(await vault.rewardPool()).to.equal(REWARD_POOL);
    });
  });

  // ── Asset management ────────────────────────────────────────

  describe("Asset management", function () {
    it("should add ETH as supported asset", async function () {
      const config = await vault.assets(ethers.ZeroAddress);
      expect(config.supported).to.be.true;
    });

    it("should reject duplicate asset", async function () {
      await expect(
        vault.addAsset(ethers.ZeroAddress, await mockPriceFeed.getAddress(), 18)
      ).to.be.revertedWith("Already supported");
    });

    it("should remove asset", async function () {
      await vault.removeAsset(ethers.ZeroAddress);
      const config = await vault.assets(ethers.ZeroAddress);
      expect(config.supported).to.be.false;
    });

    it("should reject non-owner asset management", async function () {
      await expect(
        vault.connect(depositor1).addAsset(depositor1.address, await mockPriceFeed.getAddress(), 18)
      ).to.be.reverted;
    });

    it("should return supported assets list", async function () {
      const assets = await vault.getSupportedAssets();
      expect(assets.length).to.equal(1);
      expect(assets[0]).to.equal(ethers.ZeroAddress);
    });
  });

  // ── ETH Deposits ──────────────────────────────────────────

  describe("ETH deposits", function () {
    it("should accept ETH deposit", async function () {
      const ethAmount = ethers.parseEther("1"); // 1 ETH = $2000
      await vault.connect(depositor1).depositETH(1, { value: ethAmount }); // Tier.Hodler

      const deposits = await vault.getDeposits(depositor1.address);
      expect(deposits.length).to.equal(1);
      expect(deposits[0].amount).to.equal(ethAmount);
      expect(deposits[0].asset).to.equal(ethers.ZeroAddress);
    });

    it("should calculate correct USD value", async function () {
      const ethAmount = ethers.parseEther("1");
      await vault.connect(depositor1).depositETH(0, { value: ethAmount });

      const deposits = await vault.getDeposits(depositor1.address);
      // 1 ETH * $2000 = $2000 = 2000e18 in 18-decimal USD
      expect(deposits[0].usdValue).to.equal(ethers.parseEther("2000"));
    });

    it("should update total value locked", async function () {
      await vault.connect(depositor1).depositETH(0, { value: ethers.parseEther("1") });
      expect(await vault.totalValueLocked()).to.equal(ethers.parseEther("2000"));
    });

    it("should reject zero deposit", async function () {
      await expect(
        vault.connect(depositor1).depositETH(0, { value: 0 })
      ).to.be.revertedWith("Must send ETH");
    });

    it("should reject deposit below minimum", async function () {
      // Min is $10, so need > 0.005 ETH at $2000/ETH
      await expect(
        vault.connect(depositor1).depositETH(0, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Below minimum deposit");
    });

    it("should reject deposit when paused", async function () {
      await vault.pause();
      await expect(
        vault.connect(depositor1).depositETH(0, { value: ethers.parseEther("1") })
      ).to.be.reverted;
    });

    it("should set correct lock end based on tier", async function () {
      await vault.connect(depositor1).depositETH(2, { value: ethers.parseEther("1") }); // DiamondHands = 90 days

      const deposits = await vault.getDeposits(depositor1.address);
      const now = await time.latest();
      expect(deposits[0].lockEnd).to.be.closeTo(now + 90 * 86400, 5);
    });
  });

  // ── Withdrawals ───────────────────────────────────────────

  describe("Withdrawals", function () {
    beforeEach(async function () {
      await vault.connect(depositor1).depositETH(0, { value: ethers.parseEther("1") }); // PaperHands = 7 days
    });

    it("should reject withdrawal before lock ends", async function () {
      await expect(vault.connect(depositor1).withdraw(0)).to.be.revertedWith("Still locked");
    });

    it("should allow withdrawal after lock period", async function () {
      await time.increase(7 * 86400 + 1); // 7 days + 1 second

      const balBefore = await ethers.provider.getBalance(depositor1.address);
      const tx = await vault.connect(depositor1).withdraw(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(depositor1.address);

      // Should get back 1 ETH (minus gas)
      expect(balAfter + gasUsed - balBefore).to.be.closeTo(
        ethers.parseEther("1"),
        ethers.parseEther("0.01") // small tolerance for reward transfer gas
      );
    });

    it("should pay DITTO rewards on withdrawal", async function () {
      await time.increase(7 * 86400 + 1);

      const dittoBefore = await dittoCoin.balanceOf(depositor1.address);
      await vault.connect(depositor1).withdraw(0);
      const dittoAfter = await dittoCoin.balanceOf(depositor1.address);

      // Should have some DITTO rewards
      expect(dittoAfter).to.be.gt(dittoBefore);
    });

    it("should reject double withdrawal", async function () {
      await time.increase(7 * 86400 + 1);
      await vault.connect(depositor1).withdraw(0);
      await expect(vault.connect(depositor1).withdraw(0)).to.be.revertedWith("Already withdrawn");
    });

    it("should reduce TVL on withdrawal", async function () {
      await time.increase(7 * 86400 + 1);
      await vault.connect(depositor1).withdraw(0);
      expect(await vault.totalValueLocked()).to.equal(0);
    });
  });

  // ── Emergency withdrawals ─────────────────────────────────

  describe("Emergency withdrawals", function () {
    beforeEach(async function () {
      await vault.connect(depositor1).depositETH(3, { value: ethers.parseEther("1") }); // Whale = 365 days
    });

    it("should allow emergency withdraw before lock ends", async function () {
      const balBefore = await ethers.provider.getBalance(depositor1.address);
      const tx = await vault.connect(depositor1).emergencyWithdraw(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(depositor1.address);

      // Should get back deposited ETH
      expect(balAfter + gasUsed - balBefore).to.be.closeTo(
        ethers.parseEther("1"),
        ethers.parseEther("0.001")
      );
    });

    it("should NOT pay rewards on emergency withdraw", async function () {
      const dittoBefore = await dittoCoin.balanceOf(depositor1.address);
      await vault.connect(depositor1).emergencyWithdraw(0);
      const dittoAfter = await dittoCoin.balanceOf(depositor1.address);

      expect(dittoAfter).to.equal(dittoBefore); // no rewards
    });
  });

  // ── Reward calculation ────────────────────────────────────

  describe("Reward calculation", function () {
    it("should calculate rewards based on USD value and tier", async function () {
      await vault.connect(depositor1).depositETH(1, { value: ethers.parseEther("1") }); // Hodler = 2x

      // Fast forward 30 days
      await time.increase(30 * 86400);

      const reward = await vault.calculateReward(depositor1.address, 0);
      // reward = $2000 * 500bps * 200multiplier * 30days / (365days * 10000 * 100)
      // = 2000e18 * 500 * 200 * 30*86400 / (365*86400 * 10000 * 100)
      // ≈ 16.44e18 DITTO
      expect(reward).to.be.gt(0);
    });

    it("should give higher rewards for higher tiers", async function () {
      await vault.connect(depositor1).depositETH(0, { value: ethers.parseEther("1") }); // PaperHands = 1x
      await vault.connect(depositor2).depositETH(3, { value: ethers.parseEther("1") }); // Whale = 8x

      await time.increase(7 * 86400); // 7 days

      const reward1 = await vault.calculateReward(depositor1.address, 0);
      const reward2 = await vault.calculateReward(depositor2.address, 0);

      // Whale should earn 8x the Paper Hands reward
      expect(reward2).to.be.closeTo(reward1 * 8n, ethers.parseEther("1"));
    });

    it("should return zero for withdrawn deposit", async function () {
      await vault.connect(depositor1).depositETH(0, { value: ethers.parseEther("1") });
      await time.increase(7 * 86400 + 1);
      await vault.connect(depositor1).withdraw(0);

      expect(await vault.calculateReward(depositor1.address, 0)).to.equal(0);
    });
  });

  // ── Price feed ────────────────────────────────────────────

  describe("Price feed", function () {
    it("should return correct USD value for ETH", async function () {
      const usdValue = await vault.getUSDValue(ethers.ZeroAddress, ethers.parseEther("1"));
      expect(usdValue).to.equal(ethers.parseEther("2000"));
    });

    it("should reject unsupported asset", async function () {
      await expect(
        vault.getUSDValue(depositor1.address, 1000)
      ).to.be.revertedWith("Asset not supported");
    });
  });

  // ── Owner functions ───────────────────────────────────────

  describe("Owner functions", function () {
    it("should update base APR", async function () {
      await vault.setBaseApr(1000); // 10%
      expect(await vault.baseAprBps()).to.equal(1000);
    });

    it("should reject APR > 50%", async function () {
      await expect(vault.setBaseApr(5001)).to.be.revertedWith("APR cannot exceed 50%");
    });

    it("should update min deposit", async function () {
      await vault.setMinDeposit(ethers.parseEther("100")); // $100 min
      expect(await vault.minDepositUSD()).to.equal(ethers.parseEther("100"));
    });

    it("should allow owner to withdraw from reward pool", async function () {
      const amount = ethers.parseEther("1000000000"); // 1B
      const balBefore = await dittoCoin.balanceOf(owner.address);
      await vault.withdrawRewardPool(amount);
      const balAfter = await dittoCoin.balanceOf(owner.address);
      expect(balAfter - balBefore).to.equal(amount);
    });
  });
});
