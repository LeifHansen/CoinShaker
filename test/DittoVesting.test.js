const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DittoVesting", function () {
  let dittoCoin, vesting;
  let owner, treasury, beneficiary1, beneficiary2;

  const INITIAL_SUPPLY = ethers.parseEther("420000000000"); // 420 billion
  const VESTING_FUND = ethers.parseEther("1000000000");     // 1B for vesting
  const SCHEDULE_AMOUNT = ethers.parseEther("100000000");    // 100M per beneficiary

  beforeEach(async function () {
    [owner, treasury, beneficiary1, beneficiary2] = await ethers.getSigners();

    const DittoCoin = await ethers.getContractFactory("DittoCoin");
    dittoCoin = await DittoCoin.deploy(treasury.address);

    const DittoVesting = await ethers.getContractFactory("DittoVesting");
    vesting = await DittoVesting.deploy(await dittoCoin.getAddress());

    // Exempt vesting from fees
    await dittoCoin.setExempt(await vesting.getAddress(), true);

    // Fund vesting contract
    await dittoCoin.transfer(await vesting.getAddress(), VESTING_FUND);
  });

  // ── Deployment ──────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set correct token", async function () {
      expect(await vesting.dittoToken()).to.equal(await dittoCoin.getAddress());
    });

    it("should have zero TGE timestamp initially", async function () {
      expect(await vesting.tgeTimestamp()).to.equal(0);
    });
  });

  // ── TGE ─────────────────────────────────────────────────────

  describe("TGE configuration", function () {
    it("should allow owner to set TGE", async function () {
      const tge = (await time.latest()) + 3600;
      await vesting.setTGE(tge);
      expect(await vesting.tgeTimestamp()).to.equal(tge);
    });

    it("should reject setting TGE twice", async function () {
      const tge = (await time.latest()) + 3600;
      await vesting.setTGE(tge);
      await expect(vesting.setTGE(tge + 1000)).to.be.revertedWith("TGE already set");
    });

    it("should reject non-owner setting TGE", async function () {
      await expect(
        vesting.connect(beneficiary1).setTGE((await time.latest()) + 3600)
      ).to.be.reverted;
    });
  });

  // ── Schedule registration ───────────────────────────────────

  describe("Schedule registration", function () {
    it("should register a new schedule", async function () {
      await vesting.registerSchedule(beneficiary1.address, SCHEDULE_AMOUNT, 25, 90 * 86400);

      const schedule = await vesting.getSchedule(beneficiary1.address);
      expect(schedule.totalAmount).to.equal(SCHEDULE_AMOUNT);
      expect(schedule.tgePercent).to.equal(25);
      expect(schedule.vestingDuration).to.equal(90 * 86400);
    });

    it("should add to existing schedule", async function () {
      await vesting.registerSchedule(beneficiary1.address, SCHEDULE_AMOUNT, 25, 90 * 86400);
      await vesting.registerSchedule(beneficiary1.address, SCHEDULE_AMOUNT, 25, 90 * 86400);

      const schedule = await vesting.getSchedule(beneficiary1.address);
      expect(schedule.totalAmount).to.equal(SCHEDULE_AMOUNT * 2n);
    });

    it("should reject invalid beneficiary", async function () {
      await expect(
        vesting.registerSchedule(ethers.ZeroAddress, SCHEDULE_AMOUNT, 25, 90 * 86400)
      ).to.be.revertedWith("Invalid beneficiary");
    });

    it("should reject zero amount", async function () {
      await expect(
        vesting.registerSchedule(beneficiary1.address, 0, 25, 90 * 86400)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("should reject TGE percent > 100", async function () {
      await expect(
        vesting.registerSchedule(beneficiary1.address, SCHEDULE_AMOUNT, 101, 90 * 86400)
      ).to.be.revertedWith("TGE percent > 100");
    });

    it("should allow presale contract to register", async function () {
      await vesting.setPresaleContract(beneficiary2.address); // use beneficiary2 as mock presale
      await vesting.connect(beneficiary2).registerSchedule(
        beneficiary1.address, SCHEDULE_AMOUNT, 50, 60 * 86400
      );

      const schedule = await vesting.getSchedule(beneficiary1.address);
      expect(schedule.totalAmount).to.equal(SCHEDULE_AMOUNT);
    });

    it("should reject unauthorized registration", async function () {
      await expect(
        vesting.connect(beneficiary1).registerSchedule(
          beneficiary1.address, SCHEDULE_AMOUNT, 25, 90 * 86400
        )
      ).to.be.revertedWith("Not authorized");
    });
  });

  // ── Batch registration ────────────────────────────────────

  describe("Batch registration", function () {
    it("should register multiple beneficiaries", async function () {
      await vesting.batchRegister(
        [beneficiary1.address, beneficiary2.address],
        [SCHEDULE_AMOUNT, SCHEDULE_AMOUNT * 2n],
        50,
        60 * 86400
      );

      const s1 = await vesting.getSchedule(beneficiary1.address);
      const s2 = await vesting.getSchedule(beneficiary2.address);
      expect(s1.totalAmount).to.equal(SCHEDULE_AMOUNT);
      expect(s2.totalAmount).to.equal(SCHEDULE_AMOUNT * 2n);
    });

    it("should reject mismatched array lengths", async function () {
      await expect(
        vesting.batchRegister(
          [beneficiary1.address],
          [SCHEDULE_AMOUNT, SCHEDULE_AMOUNT],
          50,
          60 * 86400
        )
      ).to.be.revertedWith("Length mismatch");
    });
  });

  // ── Claiming ──────────────────────────────────────────────

  describe("Claiming", function () {
    beforeEach(async function () {
      // Register schedule: 25% at TGE, 75% over 90 days
      await vesting.registerSchedule(beneficiary1.address, SCHEDULE_AMOUNT, 25, 90 * 86400);
    });

    it("should reject claim before TGE is set", async function () {
      await expect(vesting.connect(beneficiary1).claim()).to.be.revertedWith("TGE not set");
    });

    it("should reject claim before TGE timestamp", async function () {
      const tge = (await time.latest()) + 3600; // 1 hour from now
      await vesting.setTGE(tge);
      await expect(vesting.connect(beneficiary1).claim()).to.be.revertedWith("Before TGE");
    });

    it("should release TGE amount immediately at TGE", async function () {
      const tge = (await time.latest()) + 10;
      await vesting.setTGE(tge);
      await time.increaseTo(tge);

      const balBefore = await dittoCoin.balanceOf(beneficiary1.address);
      await vesting.connect(beneficiary1).claim();
      const balAfter = await dittoCoin.balanceOf(beneficiary1.address);

      const tgeAmount = SCHEDULE_AMOUNT * 25n / 100n;
      // Allow some tolerance — a tiny bit of linear vesting may accrue in the same block
      expect(balAfter - balBefore).to.be.closeTo(tgeAmount, ethers.parseEther("1000"));
    });

    it("should release linearly over vesting duration", async function () {
      const tge = (await time.latest()) + 10;
      await vesting.setTGE(tge);
      await time.increaseTo(tge);

      // Claim TGE portion
      await vesting.connect(beneficiary1).claim();

      // Fast forward 45 days (half of 90-day vesting)
      await time.increase(45 * 86400);

      const balBefore = await dittoCoin.balanceOf(beneficiary1.address);
      await vesting.connect(beneficiary1).claim();
      const balAfter = await dittoCoin.balanceOf(beneficiary1.address);

      // Should get ~half of the 75% vesting portion
      const vestingPortion = SCHEDULE_AMOUNT * 75n / 100n;
      const expectedHalf = vestingPortion / 2n;
      expect(balAfter - balBefore).to.be.closeTo(expectedHalf, ethers.parseEther("100"));
    });

    it("should release everything after full vesting period", async function () {
      const tge = (await time.latest()) + 10;
      await vesting.setTGE(tge);
      await time.increaseTo(tge);

      // Fast forward past full vesting
      await time.increase(91 * 86400);

      await vesting.connect(beneficiary1).claim();
      const balance = await dittoCoin.balanceOf(beneficiary1.address);

      expect(balance).to.be.closeTo(SCHEDULE_AMOUNT, ethers.parseEther("1"));
    });

    it("should handle 100% TGE (Public round) correctly", async function () {
      // Register a 100% at TGE schedule
      await vesting.registerSchedule(beneficiary2.address, SCHEDULE_AMOUNT, 100, 0);

      const tge = (await time.latest()) + 10;
      await vesting.setTGE(tge);
      await time.increaseTo(tge);

      await vesting.connect(beneficiary2).claim();
      const balance = await dittoCoin.balanceOf(beneficiary2.address);
      expect(balance).to.be.closeTo(SCHEDULE_AMOUNT, ethers.parseEther("1"));
    });

    it("should reject claim with no schedule", async function () {
      const tge = (await time.latest()) + 10;
      await vesting.setTGE(tge);
      await time.increaseTo(tge);

      await expect(vesting.connect(beneficiary2).claim()).to.be.revertedWith("No vesting schedule");
    });

    it("should reject claim when nothing new is claimable", async function () {
      // Use a 100% TGE schedule so there's no linear vesting to accrue between blocks
      await vesting.registerSchedule(beneficiary2.address, SCHEDULE_AMOUNT, 100, 0);

      const tge = (await time.latest()) + 10;
      await vesting.setTGE(tge);
      await time.increaseTo(tge);

      await vesting.connect(beneficiary2).claim();

      // Claim again immediately — 100% already claimed, nothing new
      await expect(vesting.connect(beneficiary2).claim()).to.be.revertedWith("Nothing to claim");
    });
  });

  // ── View helpers ──────────────────────────────────────────

  describe("View helpers", function () {
    it("should return correct claimable amount", async function () {
      await vesting.registerSchedule(beneficiary1.address, SCHEDULE_AMOUNT, 25, 90 * 86400);

      // Before TGE
      expect(await vesting.claimable(beneficiary1.address)).to.equal(0);

      // After TGE
      const tge = (await time.latest()) + 10;
      await vesting.setTGE(tge);
      await time.increaseTo(tge);

      const claimableAmt = await vesting.claimable(beneficiary1.address);
      const expectedTGE = SCHEDULE_AMOUNT * 25n / 100n;
      expect(claimableAmt).to.be.closeTo(expectedTGE, ethers.parseEther("1"));
    });

    it("should return zero for address with no schedule", async function () {
      expect(await vesting.claimable(beneficiary2.address)).to.equal(0);
    });
  });

  // ── Token recovery ────────────────────────────────────────

  describe("Token recovery", function () {
    it("should reject recovering DITTO tokens", async function () {
      await expect(
        vesting.recoverToken(await dittoCoin.getAddress(), 1000)
      ).to.be.revertedWith("Cannot recover DITTO");
    });
  });
});
