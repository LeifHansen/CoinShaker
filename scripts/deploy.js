const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("===============================================");
  console.log("  DittoCoin Deployment");
  console.log("===============================================");
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance: ", ethers.formatEther(balance), "ETH\n");

  // 1. Deploy DittoCoin
  const treasuryAddress = deployer.address;

  console.log("[1/3] Deploying DittoCoin...");
  const DittoCoin = await ethers.getContractFactory("DittoCoin");
  const dittoCoin = await DittoCoin.deploy(treasuryAddress);
  await dittoCoin.waitForDeployment();

  const tokenAddress = await dittoCoin.getAddress();
  console.log("  DittoCoin deployed to:", tokenAddress);
  console.log("  Total supply:", ethers.formatEther(await dittoCoin.totalSupply()), "DITTO");
  console.log("  Treasury:", treasuryAddress);

  // 2. Deploy DittoStaking
  console.log("\n[2/3] Deploying DittoStaking...");
  const DittoStaking = await ethers.getContractFactory("DittoStaking");
  const dittoStaking = await DittoStaking.deploy(tokenAddress);
  await dittoStaking.waitForDeployment();

  const stakingAddress = await dittoStaking.getAddress();
  console.log("  DittoStaking deployed to:", stakingAddress);

  // 3. Configure
  console.log("\n[3/3] Configuring...");
  await dittoCoin.setExempt(stakingAddress, true);
  console.log("  Staking contract marked fee-exempt");

  const rewardAmount = ethers.parseEther("5000000000"); // 5 billion
  await dittoCoin.approve(stakingAddress, rewardAmount);
  await dittoStaking.fundRewardPool(rewardAmount);
  console.log("  Reward pool funded with 5,000,000,000 DITTO");

  console.log("\n===============================================");
  console.log("  Deployment Complete!");
  console.log("===============================================");
  console.log("  DittoCoin:    ", tokenAddress);
  console.log("  DittoStaking: ", stakingAddress);
  console.log("  Treasury:     ", treasuryAddress);
  console.log("===============================================");
  console.log("\nNext steps:");
  console.log("  1. Verify contracts on Etherscan");
  console.log("  2. Set up a dedicated treasury multisig and call setTreasury()");
  console.log("  3. Add liquidity on Uniswap");
  console.log("  4. Consider calling renounceOwnership() once settled");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
