const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════");
  console.log("  DittoVault Deployment");
  console.log("═══════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance: ", ethers.formatEther(balance), "ETH\n");

  // ── CONFIG ────────────────────────────────────────────────
  const DITTO_TOKEN = process.env.DITTO_TOKEN_ADDRESS;
  if (!DITTO_TOKEN || DITTO_TOKEN === "0x0000000000000000000000000000000000000000") {
    throw new Error("Set DITTO_TOKEN_ADDRESS in your .env file");
  }

  const dittoCoin = await ethers.getContractAt("DittoCoin", DITTO_TOKEN);
  console.log("Using DittoCoin at:", DITTO_TOKEN);

  // ── 1. Deploy DittoVault ──────────────────────────────────
  console.log("\n[1/3] Deploying DittoVault...");
  const DittoVault = await ethers.getContractFactory("DittoVault");
  const vault = await DittoVault.deploy(DITTO_TOKEN);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("  ✓ DittoVault deployed to:", vaultAddress);

  // ── 2. Configure supported assets ─────────────────────────
  console.log("\n[2/3] Adding supported assets...");

  // Mainnet Chainlink price feeds
  // ETH/USD: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
  // USDC/USD: 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6
  // USDT/USD: 0x3E7d1eAB13ad0104d2750B8863b489D65364e32D
  // DAI/USD:  0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9
  //
  // Sepolia feeds (for testing):
  // ETH/USD: 0x694AA1769357215DE4FAC081bf1f309aDC325306

  const isMainnet = (await ethers.provider.getNetwork()).chainId === 1n;

  if (isMainnet) {
    // Mainnet asset setup
    await vault.addAsset(
      "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // ETH sentinel
      "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // ETH/USD feed
      18
    );
    console.log("  ✓ ETH added (Chainlink ETH/USD)");

    await vault.addAsset(
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", // USDC/USD feed
      6
    );
    console.log("  ✓ USDC added (Chainlink USDC/USD)");

    await vault.addAsset(
      "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", // USDT/USD feed
      6
    );
    console.log("  ✓ USDT added (Chainlink USDT/USD)");

    await vault.addAsset(
      "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
      "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9", // DAI/USD feed
      18
    );
    console.log("  ✓ DAI added (Chainlink DAI/USD)");
  } else {
    // Sepolia — only ETH available with a reliable feed
    await vault.addAsset(
      "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      "0x694AA1769357215DE4FAC081bf1f309aDC325306",
      18
    );
    console.log("  ✓ ETH added (Sepolia ETH/USD feed)");
    console.log("  ⓘ Add stablecoin feeds manually for Sepolia if needed");
  }

  // ── 3. Fund reward pool & exempt ──────────────────────────
  console.log("\n[3/3] Funding reward pool...");

  // Exempt vault from fees
  await dittoCoin.setExempt(vaultAddress, true);
  console.log("  ✓ Vault marked fee-exempt");

  // Fund with 20% of vault rewards allocation (start with 16.8B, top up later)
  const rewardFunding = ethers.parseEther("16800000000"); // 16.8B DITTO
  await dittoCoin.approve(vaultAddress, rewardFunding);
  await vault.fundRewardPool(rewardFunding);
  console.log("  ✓ Reward pool funded with 16,800,000,000 DITTO");

  // ── Summary ───────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Vault Deployment Complete!");
  console.log("═══════════════════════════════════════════════");
  console.log("  DittoVault:   ", vaultAddress);
  console.log("  DittoCoin:    ", DITTO_TOKEN);
  console.log("  Network:      ", isMainnet ? "Mainnet" : "Sepolia");
  console.log("═══════════════════════════════════════════════");
  console.log("\nNext steps:");
  console.log("  1. Verify contract on Etherscan:");
  console.log(`     npx hardhat verify --network <network> ${vaultAddress} ${DITTO_TOKEN}`);
  console.log("  2. Monitor reward pool balance and top up as needed");
  console.log("  3. Adjust baseApr if needed: vault.setBaseApr(newBps)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
