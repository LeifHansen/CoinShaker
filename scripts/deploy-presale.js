const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════");
  console.log("  DittoCoin Presale + Vesting Deployment");
  console.log("═══════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance: ", ethers.formatEther(balance), "ETH\n");

  // ── CONFIG ────────────────────────────────────────────────
  // Update this with your deployed DittoCoin address
  const DITTO_TOKEN = process.env.DITTO_TOKEN_ADDRESS;
  if (!DITTO_TOKEN || DITTO_TOKEN === "0x0000000000000000000000000000000000000000") {
    throw new Error("Set DITTO_TOKEN_ADDRESS in your .env file");
  }

  const dittoCoin = await ethers.getContractAt("DittoCoin", DITTO_TOKEN);
  console.log("Using DittoCoin at:", DITTO_TOKEN);

  // ── 1. Deploy DittoPresale ────────────────────────────────
  console.log("\n[1/4] Deploying DittoPresale...");
  const DittoPresale = await ethers.getContractFactory("DittoPresale");
  const presale = await DittoPresale.deploy(DITTO_TOKEN);
  await presale.waitForDeployment();

  const presaleAddress = await presale.getAddress();
  console.log("  ✓ DittoPresale deployed to:", presaleAddress);

  // ── 2. Deploy DittoVesting ────────────────────────────────
  console.log("\n[2/4] Deploying DittoVesting...");
  const DittoVesting = await ethers.getContractFactory("DittoVesting");
  const vesting = await DittoVesting.deploy(DITTO_TOKEN, presaleAddress);
  await vesting.waitForDeployment();

  const vestingAddress = await vesting.getAddress();
  console.log("  ✓ DittoVesting deployed to:", vestingAddress);

  // ── 3. Link contracts ─────────────────────────────────────
  console.log("\n[3/4] Linking contracts...");

  // Tell presale where vesting contract lives
  await presale.setVestingContract(vestingAddress);
  console.log("  ✓ Presale → Vesting linked");

  // Exempt presale and vesting from fees/limits
  await dittoCoin.setExempt(presaleAddress, true);
  console.log("  ✓ Presale marked fee-exempt");

  await dittoCoin.setExempt(vestingAddress, true);
  console.log("  ✓ Vesting marked fee-exempt");

  // ── 4. Configure presale rounds ───────────────────────────
  console.log("\n[4/4] Configuring presale rounds...");

  // Total presale allocation: 25% of 420B = 105B DITTO
  // Seed:      30B tokens — 60% discount — price ~2.5x base
  // EarlyBird: 35B tokens — 40% discount — price ~1.67x base
  // Public:    40B tokens — 20% discount — price ~1.25x base
  const SEED_ALLOCATION      = ethers.parseEther("30000000000");   // 30B
  const EARLYBIRD_ALLOCATION = ethers.parseEther("35000000000");   // 35B
  const PUBLIC_ALLOCATION    = ethers.parseEther("40000000000");    // 40B

  // Seed round: 60% off → if base is 20M DITTO/ETH, seed gets 50M DITTO/ETH
  await presale.configureRound(
    0, // Seed
    ethers.parseEther("50000000"),                   // 50M DITTO per ETH
    ethers.parseEther("300"),                        // 300 ETH hardcap
    ethers.parseEther("50"),                         // 50 ETH softcap
    ethers.parseEther("5"),                          // 5 ETH max per wallet
    SEED_ALLOCATION,                                 // 30B token allocation
    true                                             // whitelist required
  );
  console.log("  ✓ Seed round configured (300 ETH hardcap, whitelist)");

  // EarlyBird round: 40% off → 33.3M DITTO per ETH
  await presale.configureRound(
    1, // EarlyBird
    ethers.parseEther("33333333"),                   // ~33.3M DITTO per ETH
    ethers.parseEther("500"),                        // 500 ETH hardcap
    ethers.parseEther("100"),                        // 100 ETH softcap
    ethers.parseEther("10"),                         // 10 ETH max per wallet
    EARLYBIRD_ALLOCATION,                            // 35B token allocation
    false                                            // no whitelist
  );
  console.log("  ✓ EarlyBird round configured (500 ETH hardcap)");

  // Public round: 20% off → 25M DITTO per ETH
  await presale.configureRound(
    2, // Public
    ethers.parseEther("25000000"),                   // 25M DITTO per ETH
    ethers.parseEther("1000"),                       // 1000 ETH hardcap
    ethers.parseEther("200"),                        // 200 ETH softcap
    ethers.parseEther("20"),                         // 20 ETH max per wallet
    PUBLIC_ALLOCATION,                               // 40B token allocation
    false                                            // no whitelist
  );
  console.log("  ✓ Public round configured (1000 ETH hardcap)");

  // Transfer presale tokens to presale contract
  const totalPresaleTokens = SEED_ALLOCATION + EARLYBIRD_ALLOCATION + PUBLIC_ALLOCATION;
  console.log("\n  Transferring", ethers.formatEther(totalPresaleTokens), "DITTO to presale contract...");
  await dittoCoin.transfer(presaleAddress, totalPresaleTokens);
  console.log("  ✓ 105B DITTO deposited to presale contract");

  // ── Summary ───────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Presale Deployment Complete!");
  console.log("═══════════════════════════════════════════════");
  console.log("  DittoPresale:  ", presaleAddress);
  console.log("  DittoVesting:  ", vestingAddress);
  console.log("  DittoCoin:     ", DITTO_TOKEN);
  console.log("═══════════════════════════════════════════════");
  console.log("\nNext steps:");
  console.log("  1. Verify contracts on Etherscan:");
  console.log(`     npx hardhat verify --network <network> ${presaleAddress} ${DITTO_TOKEN}`);
  console.log(`     npx hardhat verify --network <network> ${vestingAddress} ${DITTO_TOKEN} ${presaleAddress}`);
  console.log("  2. Add whitelist addresses for Seed round: presale.setWhitelist([...], true)");
  console.log("  3. When ready, activate Seed round: presale.activateRound(0)");
  console.log("  4. After liquidity launch, set TGE: vesting.setTGE(timestamp)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
