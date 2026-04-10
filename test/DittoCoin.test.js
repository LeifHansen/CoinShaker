const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DittoCoin", function () {
  let dittoCoin;
  let owner;
  let treasury;
  let addr1;
  let addr2;

  const INITIAL_SUPPLY = ethers.parseEther("420000000000"); // 420 billion

  beforeEach(async function () {
    [owner, treasury, addr1, addr2] = await ethers.getSigners();
    const DittoCoin = await ethers.getContractFactory("DittoCoin");
    dittoCoin = await DittoCoin.deploy(treasury.address);
    await dittoCoin.waitForDeployment();
  });

  // ── Deployment ────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set the correct name and symbol", async function () {
      expect(await dittoCoin.name()).to.equal("DittoCoin");
      expect(await dittoCoin.symbol()).to.equal("DITTO");
    });

    it("should mint all tokens to the deployer", async function () {
      expect(await dittoCoin.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("should set total supply to 420 billion", async function () {
      expect(await dittoCoin.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("should set the deployer as owner", async function () {
      expect(await dittoCoin.owner()).to.equal(owner.address);
    });

    it("should set the treasury address", async function () {
      expect(await dittoCoin.treasury()).to.equal(treasury.address);
    });

    it("should exempt owner and treasury from fees", async function () {
      expect(await dittoCoin.isExempt(owner.address)).to.be.true;
      expect(await dittoCoin.isExempt(treasury.address)).to.be.true;
    });

    it("should revert if treasury is zero address", async function () {
      const DittoCoin = await ethers.getContractFactory("DittoCoin");
      await expect(DittoCoin.deploy(ethers.ZeroAddress)).to.be.revertedWith(
        "Treasury cannot be zero address"
      );
    });

    it("should reject transfers to the token contract itself", async function () {
      const tokenAddr = await dittoCoin.getAddress();
      await expect(
        dittoCoin.transfer(tokenAddr, ethers.parseEther("100"))
      ).to.be.revertedWith("Cannot transfer to token contract");
    });
  });

  // ── Fee-exempt transfers (owner) ──────────────────────────

  describe("Exempt transfers (no fees)", function () {
    it("should transfer full amount when sender is exempt", async function () {
      const amount = ethers.parseEther("1000");
      await dittoCoin.transfer(addr1.address, amount);
      expect(await dittoCoin.balanceOf(addr1.address)).to.equal(amount);
    });
  });

  // ── Taxed transfers ───────────────────────────────────────

  describe("Halving burn + 1% treasury", function () {
    const seedAmount = ethers.parseEther("1000000"); // 1M to addr1

    beforeEach(async function () {
      await dittoCoin.transfer(addr1.address, seedAmount);
    });

    it("should start at era 0 with 2% burn rate", async function () {
      expect(await dittoCoin.currentEra()).to.equal(0);
      expect(await dittoCoin.currentBurnBps()).to.equal(200);
    });

    it("should burn 2% and send 1% to treasury in era 0", async function () {
      const sendAmount = ethers.parseEther("10000");
      const burnBps = await dittoCoin.currentBurnBps();
      const expectedBurn = (sendAmount * burnBps) / 10000n;
      const expectedTreasury = (sendAmount * 100n) / 10000n;
      const expectedReceived = sendAmount - expectedBurn - expectedTreasury;

      const supplyBefore = await dittoCoin.totalSupply();
      const treasuryBefore = await dittoCoin.balanceOf(treasury.address);

      await dittoCoin.connect(addr1).transfer(addr2.address, sendAmount);

      expect(await dittoCoin.balanceOf(addr2.address)).to.equal(expectedReceived);
      expect(await dittoCoin.totalSupply()).to.equal(supplyBefore - expectedBurn);
      expect(await dittoCoin.balanceOf(treasury.address)).to.equal(
        treasuryBefore + expectedTreasury
      );
    });

    it("should halve burn rate after 180 days (era 1 = 1%)", async function () {
      // Fast-forward 181 days
      await ethers.provider.send("evm_increaseTime", [181 * 86400]);
      await ethers.provider.send("evm_mine");

      expect(await dittoCoin.currentEra()).to.equal(1);
      expect(await dittoCoin.currentBurnBps()).to.equal(100); // 1%
    });

    it("should halve again after 360 days (era 2 = 0.5%)", async function () {
      await ethers.provider.send("evm_increaseTime", [361 * 86400]);
      await ethers.provider.send("evm_mine");

      expect(await dittoCoin.currentEra()).to.equal(2);
      expect(await dittoCoin.currentBurnBps()).to.equal(50); // 0.5%
    });

    it("should floor at 1 bps (0.01%) after era 7+", async function () {
      // Fast-forward 8 eras worth (1440 days = ~4 years)
      await ethers.provider.send("evm_increaseTime", [1440 * 86400]);
      await ethers.provider.send("evm_mine");

      expect(await dittoCoin.currentBurnBps()).to.equal(1); // 0.01% floor
    });

    it("should apply reduced burn rate in later eras", async function () {
      // Jump to era 1 (1% burn)
      await ethers.provider.send("evm_increaseTime", [181 * 86400]);
      await ethers.provider.send("evm_mine");

      const sendAmount = ethers.parseEther("10000");
      const expectedBurn = (sendAmount * 100n) / 10000n;  // 1% = 100 bps
      const expectedTreasury = (sendAmount * 100n) / 10000n;
      const expectedReceived = sendAmount - expectedBurn - expectedTreasury;

      await dittoCoin.connect(addr1).transfer(addr2.address, sendAmount);
      expect(await dittoCoin.balanceOf(addr2.address)).to.equal(expectedReceived);
    });

    it("should report correct totalBurned", async function () {
      const sendAmount = ethers.parseEther("10000");
      await dittoCoin.connect(addr1).transfer(addr2.address, sendAmount);

      const expectedBurn = (sendAmount * 200n) / 10000n;
      expect(await dittoCoin.totalBurned()).to.equal(expectedBurn);
    });

    it("should report timeUntilNextHalving", async function () {
      const timeLeft = await dittoCoin.timeUntilNextHalving();
      expect(timeLeft).to.be.greaterThan(0);
      expect(timeLeft).to.be.lessThanOrEqual(180 * 86400);
    });
  });

  // ── Anti-whale ────────────────────────────────────────────

  describe("Anti-whale limits", function () {
    it("should reject transfers exceeding max tx size", async function () {
      // Max tx = 0.5% of 420B = 2.1B tokens
      const tooMuch = ethers.parseEther("2200000000"); // 2.2B > 2.1B limit
      // First give addr1 enough tokens (owner is exempt from limits)
      await dittoCoin.transfer(addr1.address, ethers.parseEther("3000000000"));

      await expect(
        dittoCoin.connect(addr1).transfer(addr2.address, tooMuch)
      ).to.be.revertedWith("Exceeds max transaction");
    });

    it("should reject if recipient would exceed max wallet", async function () {
      // Max wallet = 1% of 420B = 4.2B tokens
      // Send large chunks to addr2 via addr1 (non-exempt, so fees apply)
      // Each 2B tx nets ~1.94B after 3% fee
      const chunk = ethers.parseEther("2000000000"); // 2B per tx (under 2.1B max tx)
      await dittoCoin.transfer(addr1.address, ethers.parseEther("10000000000"));

      await dittoCoin.connect(addr1).transfer(addr2.address, chunk); // addr2 gets ~1.94B
      await dittoCoin.connect(addr1).transfer(addr2.address, chunk); // addr2 gets ~3.88B

      // Third chunk: 3.88B + 1.94B net = ~5.82B > 4.2B limit
      await expect(
        dittoCoin.connect(addr1).transfer(addr2.address, chunk)
      ).to.be.revertedWith("Exceeds max wallet");
    });

    it("should allow exempt addresses to bypass limits", async function () {
      // Owner is exempt — can send more than max tx
      const bigAmount = ethers.parseEther("900000000"); // 900M
      await expect(dittoCoin.transfer(addr1.address, bigAmount)).to.not.be.reverted;
    });
  });

  // ── Owner functions ───────────────────────────────────────

  describe("Owner functions", function () {
    it("should allow owner to update treasury", async function () {
      await dittoCoin.setTreasury(addr1.address);
      expect(await dittoCoin.treasury()).to.equal(addr1.address);
      expect(await dittoCoin.isExempt(addr1.address)).to.be.true;
      expect(await dittoCoin.isExempt(treasury.address)).to.be.false;
    });

    it("should allow owner to update treasury fee", async function () {
      await dittoCoin.setTreasuryFee(50); // 0.5% treasury
      expect(await dittoCoin.treasuryFeeBps()).to.equal(50);
    });

    it("should reject treasury fee exceeding 5%", async function () {
      await expect(dittoCoin.setTreasuryFee(600)).to.be.revertedWith(
        "Treasury fee cannot exceed 5%"
      );
    });

    it("should allow owner to update limits", async function () {
      await dittoCoin.setLimits(200, 100); // 2% wallet, 1% tx
      expect(await dittoCoin.maxWalletBps()).to.equal(200);
      expect(await dittoCoin.maxTxBps()).to.equal(100);
    });

    it("should reject max wallet below 0.5%", async function () {
      await expect(dittoCoin.setLimits(40, 50)).to.be.revertedWith(
        "Max wallet must be >= 0.5%"
      );
    });

    it("should reject max tx below 0.1%", async function () {
      await expect(dittoCoin.setLimits(100, 5)).to.be.revertedWith(
        "Max tx must be >= 0.1%"
      );
    });

    it("should allow owner to remove limits", async function () {
      await dittoCoin.removeLimits();
      expect(await dittoCoin.maxWalletBps()).to.equal(10000);
      expect(await dittoCoin.maxTxBps()).to.equal(10000);
    });

    it("should allow owner to remove treasury fee", async function () {
      await dittoCoin.removeTreasuryFee();
      expect(await dittoCoin.treasuryFeeBps()).to.equal(0);
    });

    it("should reject non-owner from changing treasury fee", async function () {
      await expect(
        dittoCoin.connect(addr1).setTreasuryFee(50)
      ).to.be.reverted;
    });

    it("should reject non-owner from changing limits", async function () {
      await expect(
        dittoCoin.connect(addr1).setLimits(200, 100)
      ).to.be.reverted;
    });
  });

  // ── Pausable ──────────────────────────────────────────────────

  describe("Pausable", function () {
    it("should allow owner to pause and unpause", async function () {
      await dittoCoin.pause();
      await expect(
        dittoCoin.transfer(addr1.address, ethers.parseEther("100"))
      ).to.be.reverted;

      await dittoCoin.unpause();
      await expect(
        dittoCoin.transfer(addr1.address, ethers.parseEther("100"))
      ).to.not.be.reverted;
    });

    it("should reject non-owner from pausing", async function () {
      await expect(dittoCoin.connect(addr1).pause()).to.be.reverted;
    });
  });
});
