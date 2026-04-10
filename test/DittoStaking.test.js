const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DittoStaking", function () {
  let dittoCoin;
  let staking;
  let owner;
  let treasury;
  let staker1;
  let staker2;

  const INITIAL_SUPPLY = ethers.parseEther("420000000000"); // 420 billion
  const REWARD_POOL = ethers.parseEther("5000000000"); // 5B for rewards
  const STAKE_AMOUNT = ethers.parseEther("1000000");   // 1M per stake

  beforeEach(async function () {
    [owner, treasury, staker1, staker2] = await ethers.getSigners();

    // Deploy DittoCoin
    const DittoCoin = await ethers.getContractFactory("DittoCoin");
    dittoCoin = await DittoCoin.deploy(treasury.address);
    await dittoCoin.waitForDeployment();

    // Deploy DittoStaking
    const DittoStaking = await ethers.getContractFactory("DittoStaking");
    staking = await DittoStaking.deploy(await dittoCoin.getAddress());
    await staking.waitForDeployment();

    // Exempt staking contract from fees
    await dittoCoin.setExempt(await staking.getAddress(), true);

    // Fund reward pool
    await dittoCoin.approve(await staking.getAddress(), REWARD_POOL);
    await staking.fundRewardPool(REWARD_POOL);

    // Give stakers some tokens (owner is exempt, no fees)
    await dittoCoin.transfer(staker1.address, ethers.parseEther("10000000"));
    await dittoCoin.transfer(staker2.address, ethers.parseEther("10000000"));
  });

  // ── Deployment ────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set the correct token address", async function () {
      expect(await staking.dittoToken()).to.equal(await dittoCoin.getAddress());
    });

    it("should have the reward pool funded", async function () {
      expect(await staking.rewardPool()).to.equal(REWARD_POOL);
    });

    it("should have 10% base APR", async function () {
      expect(await staking.baseAprBps()).to.equal(1000);
    });

    it("should have four tiers configured", async function () {
      const [name0, lock0, mult0] = await staking.getTierInfo(0);
      expect(name0).to.equal("Paper Hands");
      expect(lock0).to.equal(7 * 24 * 60 * 60);
      expect(mult0).to.equal(100);

      const [name3, lock3, mult3] = await staking.getTierInfo(3);
      expect(name3).to.equal("Whale");
      expect(lock3).to.equal(365 * 24 * 60 * 60);
      expect(mult3).to.equal(800);
    });
  });

  // ── Staking ───────────────────────────────────────────────

  describe("Staking", function () {
    it("should allow staking into Paper Hands tier", async function () {
      await dittoCoin.connect(staker1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(staker1).stake(STAKE_AMOUNT, 0); // PaperHands

      expect(await staking.totalStaked()).to.equal(STAKE_AMOUNT);
      expect(await staking.getStakeCount(staker1.address)).to.equal(1);
    });

    it("should allow multiple stakes from same user", async function () {
      const stakingAddr = await staking.getAddress();
      await dittoCoin.connect(staker1).approve(stakingAddr, STAKE_AMOUNT * 2n);
      await staking.connect(staker1).stake(STAKE_AMOUNT, 0);
      await staking.connect(staker1).stake(STAKE_AMOUNT, 1); // Hodler

      expect(await staking.getStakeCount(staker1.address)).to.equal(2);
      expect(await staking.totalStaked()).to.equal(STAKE_AMOUNT * 2n);
    });

    it("should reject staking zero tokens", async function () {
      await expect(
        staking.connect(staker1).stake(0, 0)
      ).to.be.revertedWith("Cannot stake zero");
    });

    it("should reject staking below minimum", async function () {
      const tooLittle = ethers.parseEther("100"); // below 1000 minimum
      await dittoCoin.connect(staker1).approve(await staking.getAddress(), tooLittle);
      await expect(
        staking.connect(staker1).stake(tooLittle, 0)
      ).to.be.revertedWith("Below minimum stake");
    });

    it("should reject invalid stake index on unstake", async function () {
      await expect(
        staking.connect(staker1).unstake(999)
      ).to.be.revertedWith("Invalid stake index");
    });
  });

  // ── Unstaking ─────────────────────────────────────────────

  describe("Unstaking", function () {
    beforeEach(async function () {
      await dittoCoin.connect(staker1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(staker1).stake(STAKE_AMOUNT, 0); // Paper Hands (7 days)
    });

    it("should reject unstaking before lock period ends", async function () {
      await expect(
        staking.connect(staker1).unstake(0)
      ).to.be.revertedWith("Still locked");
    });

    it("should allow unstaking after lock period with rewards", async function () {
      // Fast-forward 7 days
      await time.increase(7 * 24 * 60 * 60);

      // Check that reward is non-zero BEFORE unstaking
      const pendingReward = await staking.calculateReward(staker1.address, 0);
      expect(pendingReward).to.be.gt(0, "Reward should be non-zero before unstaking");

      const balanceBefore = await dittoCoin.balanceOf(staker1.address);
      await staking.connect(staker1).unstake(0);
      const balanceAfter = await dittoCoin.balanceOf(staker1.address);

      const received = balanceAfter - balanceBefore;

      // Must receive MORE than just the principal (principal + reward)
      expect(received).to.be.gt(STAKE_AMOUNT, "Should receive principal + non-zero reward");
    });

    it("should not allow double-unstaking", async function () {
      await time.increase(7 * 24 * 60 * 60);
      await staking.connect(staker1).unstake(0);

      await expect(
        staking.connect(staker1).unstake(0)
      ).to.be.revertedWith("Already withdrawn");
    });
  });

  // ── Emergency unstake ─────────────────────────────────────

  describe("Emergency unstake", function () {
    it("should return principal only, no rewards", async function () {
      await dittoCoin.connect(staker1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(staker1).stake(STAKE_AMOUNT, 3); // Whale (365 days)

      const balanceBefore = await dittoCoin.balanceOf(staker1.address);
      await staking.connect(staker1).emergencyUnstake(0);
      const balanceAfter = await dittoCoin.balanceOf(staker1.address);

      expect(balanceAfter - balanceBefore).to.equal(STAKE_AMOUNT);
      expect(await staking.totalStaked()).to.equal(0);
    });
  });

  // ── Reward calculation ────────────────────────────────────

  describe("Reward calculation", function () {
    it("should give higher rewards for higher tiers", async function () {
      const stakingAddr = await staking.getAddress();

      // Staker1 in Paper Hands, Staker2 in Diamond Hands
      await dittoCoin.connect(staker1).approve(stakingAddr, STAKE_AMOUNT);
      await staking.connect(staker1).stake(STAKE_AMOUNT, 0);

      await dittoCoin.connect(staker2).approve(stakingAddr, STAKE_AMOUNT);
      await staking.connect(staker2).stake(STAKE_AMOUNT, 2); // DiamondHands (4x)

      // Fast-forward 90 days (so both are unlocked)
      await time.increase(90 * 24 * 60 * 60);

      const reward1 = await staking.calculateReward(staker1.address, 0);
      const reward2 = await staking.calculateReward(staker2.address, 0);

      // Diamond Hands (4x) should earn roughly 4x Paper Hands (1x)
      // Allow small rounding tolerance
      expect(reward2).to.be.gt(reward1 * 3n);
    });

    it("should return zero for withdrawn stakes", async function () {
      await dittoCoin.connect(staker1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(staker1).stake(STAKE_AMOUNT, 0);

      await time.increase(7 * 24 * 60 * 60);
      await staking.connect(staker1).unstake(0);

      expect(await staking.calculateReward(staker1.address, 0)).to.equal(0);
    });
  });

  // ── Owner functions ───────────────────────────────────────

  describe("Owner functions", function () {
    it("should allow owner to update base APR", async function () {
      await staking.setBaseApr(2000); // 20%
      expect(await staking.baseAprBps()).to.equal(2000);
    });

    it("should reject APR over 50%", async function () {
      await expect(staking.setBaseApr(6000)).to.be.revertedWith(
        "APR cannot exceed 50%"
      );
    });

    it("should reject non-owner from changing APR", async function () {
      await expect(
        staking.connect(staker1).setBaseApr(2000)
      ).to.be.reverted;
    });
  });

  // ── Pausable ──────────────────────────────────────────────────

  describe("Pausable", function () {
    it("should prevent staking when paused", async function () {
      await staking.pause();
      await dittoCoin.connect(staker1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await expect(
        staking.connect(staker1).stake(STAKE_AMOUNT, 0)
      ).to.be.reverted;
      await staking.unpause();
    });
  });
});
