const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DittoPresale", function () {
  let dittoCoin, presale, vesting;
  let owner, treasury, buyer1, buyer2, referrer1;

  const INITIAL_SUPPLY = ethers.parseEther("420000000000"); // 420 billion

  // Round config: Seed
  const SEED_PRICE = 50_000_000n; // 50M DITTO per ETH
  const SEED_HARDCAP = ethers.parseEther("10"); // 10 ETH
  const SEED_SOFTCAP = ethers.parseEther("2");  // 2 ETH
  const SEED_MAX_PER_WALLET = ethers.parseEther("5");
  const SEED_ALLOCATION = ethers.parseEther("500000000"); // 500M DITTO

  beforeEach(async function () {
    [owner, treasury, buyer1, buyer2, referrer1] = await ethers.getSigners();

    // Deploy DittoCoin
    const DittoCoin = await ethers.getContractFactory("DittoCoin");
    dittoCoin = await DittoCoin.deploy(treasury.address);

    // Deploy Vesting
    const DittoVesting = await ethers.getContractFactory("DittoVesting");
    vesting = await DittoVesting.deploy(await dittoCoin.getAddress());

    // Deploy Presale
    const DittoPresale = await ethers.getContractFactory("DittoPresale");
    presale = await DittoPresale.deploy(await dittoCoin.getAddress());

    // Set vesting contract on presale
    await presale.setVestingContract(await vesting.getAddress());

    // Set presale as authorized on vesting
    await vesting.setPresaleContract(await presale.getAddress());

    // Fund presale with tokens (owner is exempt from fees)
    await dittoCoin.setExempt(await presale.getAddress(), true);
    await dittoCoin.transfer(await presale.getAddress(), SEED_ALLOCATION * 2n);

    // Configure Seed round
    await presale.configureRound(
      0, // Seed
      SEED_PRICE,
      SEED_HARDCAP,
      SEED_SOFTCAP,
      SEED_MAX_PER_WALLET,
      SEED_ALLOCATION,
      true // whitelist required
    );
  });

  // ── Deployment ──────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set the correct token address", async function () {
      expect(await presale.dittoToken()).to.equal(await dittoCoin.getAddress());
    });

    it("should set the vesting contract", async function () {
      expect(await presale.vestingContract()).to.equal(await vesting.getAddress());
    });

    it("should set owner correctly", async function () {
      expect(await presale.owner()).to.equal(owner.address);
    });
  });

  // ── Round configuration ─────────────────────────────────────

  describe("Round configuration", function () {
    it("should configure a round correctly", async function () {
      const [config] = await Promise.all([
        presale.roundConfigs(0)
      ]);
      expect(config.tokenPrice).to.equal(SEED_PRICE);
      expect(config.hardcapETH).to.equal(SEED_HARDCAP);
      expect(config.softcapETH).to.equal(SEED_SOFTCAP);
      expect(config.whitelistRequired).to.be.true;
    });

    it("should reject invalid configuration", async function () {
      await expect(
        presale.configureRound(1, 0, SEED_HARDCAP, 0, SEED_MAX_PER_WALLET, SEED_ALLOCATION, false)
      ).to.be.revertedWith("Price must be > 0");
    });

    it("should reject softcap > hardcap", async function () {
      await expect(
        presale.configureRound(1, SEED_PRICE, ethers.parseEther("5"), ethers.parseEther("10"), SEED_MAX_PER_WALLET, SEED_ALLOCATION, false)
      ).to.be.revertedWith("Softcap > hardcap");
    });

    it("should reject non-owner configuration", async function () {
      await expect(
        presale.connect(buyer1).configureRound(1, SEED_PRICE, SEED_HARDCAP, 0, SEED_MAX_PER_WALLET, SEED_ALLOCATION, false)
      ).to.be.reverted;
    });
  });

  // ── Activation ──────────────────────────────────────────────

  describe("Round activation", function () {
    it("should activate a configured round", async function () {
      await presale.activateRound(0);
      const data = await presale.roundData(0);
      expect(data.state).to.equal(1); // Active
    });

    it("should reject activating unconfigured round", async function () {
      await expect(presale.activateRound(1)).to.be.revertedWith("Round not configured");
    });

    it("should reject double activation", async function () {
      await presale.activateRound(0);
      await expect(presale.activateRound(0)).to.be.revertedWith("Round not inactive");
    });
  });

  // ── Buying ──────────────────────────────────────────────────

  describe("Buying tokens", function () {
    beforeEach(async function () {
      await presale.setWhitelist([buyer1.address, buyer2.address, referrer1.address], true);
      await presale.activateRound(0);
    });

    it("should allow whitelisted buyer to purchase", async function () {
      const ethAmount = ethers.parseEther("1");
      await presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethAmount });

      const purchase = await presale.getPurchase(buyer1.address, 0);
      expect(purchase.ethSpent).to.equal(ethAmount);
      expect(purchase.tokensOwed).to.equal(ethAmount * SEED_PRICE);
    });

    it("should reject non-whitelisted buyer for Seed round", async function () {
      const nonWhitelisted = (await ethers.getSigners())[5];
      await expect(
        presale.connect(nonWhitelisted).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Not whitelisted");
    });

    it("should reject purchase exceeding wallet limit", async function () {
      await expect(
        presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("6") })
      ).to.be.revertedWith("Exceeds wallet limit");
    });

    it("should reject purchase when round is not active", async function () {
      await expect(
        presale.connect(buyer1).buy(1, ethers.ZeroAddress, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Round not active");
    });

    it("should reject zero ETH purchase", async function () {
      await expect(
        presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: 0 })
      ).to.be.revertedWith("Must send ETH");
    });

    it("should track total raised correctly", async function () {
      await presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("2") });
      await presale.connect(buyer2).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("3") });

      const data = await presale.roundData(0);
      expect(data.totalRaised).to.equal(ethers.parseEther("5"));
    });

    it("should allow multiple purchases up to wallet limit", async function () {
      await presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("2") });
      await presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("3") });

      const purchase = await presale.getPurchase(buyer1.address, 0);
      expect(purchase.ethSpent).to.equal(ethers.parseEther("5"));
    });
  });

  // ── Referrals ─────────────────────────────────────────────

  describe("Referral system", function () {
    beforeEach(async function () {
      await presale.setWhitelist([buyer1.address, buyer2.address, referrer1.address], true);
      await presale.activateRound(0);
    });

    it("should record referral and give bonus to both parties", async function () {
      const ethAmount = ethers.parseEther("1");
      await presale.connect(buyer1).buy(0, referrer1.address, { value: ethAmount });

      // Buyer should have referral bonus
      const purchase = await presale.getPurchase(buyer1.address, 0);
      const baseTokens = ethAmount * SEED_PRICE;
      const expectedBonus = baseTokens * 500n / 10_000n; // 5%
      expect(purchase.referralBonus).to.equal(expectedBonus);

      // Referrer should have bonus too
      const refPurchase = await presale.getPurchase(referrer1.address, 0);
      expect(refPurchase.referralBonus).to.equal(expectedBonus);

      // Referral count should increment
      expect(await presale.referralCount(referrer1.address)).to.equal(1);
    });

    it("should not allow self-referral", async function () {
      await presale.connect(buyer1).buy(0, buyer1.address, { value: ethers.parseEther("1") });
      expect(await presale.referrer(buyer1.address)).to.equal(ethers.ZeroAddress);
    });

    it("should not change referrer on subsequent purchases", async function () {
      await presale.connect(buyer1).buy(0, referrer1.address, { value: ethers.parseEther("1") });
      await presale.connect(buyer1).buy(0, buyer2.address, { value: ethers.parseEther("1") });
      expect(await presale.referrer(buyer1.address)).to.equal(referrer1.address);
    });

    it("should return correct referral tier", async function () {
      expect(await presale.getReferralTier(referrer1.address)).to.equal("None");

      await presale.connect(buyer1).buy(0, referrer1.address, { value: ethers.parseEther("1") });
      expect(await presale.getReferralTier(referrer1.address)).to.equal("Bronze");
    });
  });

  // ── Finalization ──────────────────────────────────────────

  describe("Round finalization", function () {
    beforeEach(async function () {
      await presale.setWhitelist([buyer1.address, buyer2.address], true);
      await presale.activateRound(0);
    });

    it("should finalize when softcap is met", async function () {
      // Buy enough to meet softcap (2 ETH)
      await presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("3") });

      await presale.finalizeRound(0);
      const data = await presale.roundData(0);
      expect(data.state).to.equal(2); // Finalized
    });

    it("should enable refunds when softcap not met", async function () {
      // Buy only 1 ETH (softcap is 2 ETH)
      await presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("1") });

      await presale.finalizeRound(0);
      const data = await presale.roundData(0);
      expect(data.state).to.equal(3); // Refunding
    });

    it("should reject finalizing non-active round", async function () {
      await expect(presale.finalizeRound(1)).to.be.revertedWith("Round not active");
    });
  });

  // ── Refunds ───────────────────────────────────────────────

  describe("Refunds", function () {
    it("should refund ETH when round fails softcap", async function () {
      await presale.setWhitelist([buyer1.address], true);
      await presale.activateRound(0);

      const ethAmount = ethers.parseEther("1");
      await presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethAmount });

      // Finalize — softcap not met
      await presale.finalizeRound(0);

      const balanceBefore = await ethers.provider.getBalance(buyer1.address);
      const tx = await presale.connect(buyer1).refund(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(buyer1.address);

      expect(balanceAfter + gasUsed - balanceBefore).to.equal(ethAmount);
    });

    it("should reject double refund", async function () {
      await presale.setWhitelist([buyer1.address], true);
      await presale.activateRound(0);
      await presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("1") });
      await presale.finalizeRound(0);
      await presale.connect(buyer1).refund(0);

      await expect(presale.connect(buyer1).refund(0)).to.be.revertedWith("Already refunded");
    });

    it("should reject refund when round is finalized (not refunding)", async function () {
      await presale.setWhitelist([buyer1.address], true);
      await presale.activateRound(0);
      await presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("3") });
      await presale.finalizeRound(0); // softcap met

      await expect(presale.connect(buyer1).refund(0)).to.be.revertedWith("Refunds not enabled");
    });
  });

  // ── ETH withdrawal ────────────────────────────────────────

  describe("ETH withdrawal", function () {
    it("should allow owner to withdraw ETH from finalized round", async function () {
      await presale.setWhitelist([buyer1.address], true);
      await presale.activateRound(0);
      await presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("3") });
      await presale.finalizeRound(0);

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await presale.withdrawETH(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      expect(balanceAfter + gasUsed - balanceBefore).to.equal(ethers.parseEther("3"));
    });

    it("should reject non-owner ETH withdrawal", async function () {
      await presale.setWhitelist([buyer1.address], true);
      await presale.activateRound(0);
      await presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("3") });
      await presale.finalizeRound(0);

      await expect(presale.connect(buyer1).withdrawETH(0)).to.be.reverted;
    });
  });

  // ── Whitelist ─────────────────────────────────────────────

  describe("Whitelist", function () {
    it("should add and remove from whitelist", async function () {
      await presale.setWhitelist([buyer1.address], true);
      expect(await presale.whitelisted(buyer1.address)).to.be.true;

      await presale.setWhitelist([buyer1.address], false);
      expect(await presale.whitelisted(buyer1.address)).to.be.false;
    });

    it("should batch whitelist", async function () {
      await presale.setWhitelist([buyer1.address, buyer2.address], true);
      expect(await presale.whitelisted(buyer1.address)).to.be.true;
      expect(await presale.whitelisted(buyer2.address)).to.be.true;
    });
  });

  // ── Pause ─────────────────────────────────────────────────

  describe("Pause", function () {
    it("should prevent purchases when paused", async function () {
      await presale.setWhitelist([buyer1.address], true);
      await presale.activateRound(0);
      await presale.pause();

      await expect(
        presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("1") })
      ).to.be.reverted;
    });

    it("should allow purchases after unpause", async function () {
      await presale.setWhitelist([buyer1.address], true);
      await presale.activateRound(0);
      await presale.pause();
      await presale.unpause();

      await expect(
        presale.connect(buyer1).buy(0, ethers.ZeroAddress, { value: ethers.parseEther("1") })
      ).to.not.be.reverted;
    });
  });
});
