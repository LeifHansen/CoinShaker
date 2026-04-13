const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const tokenAddress = "0xE85644Ab000b8741837746335819F0AE750e1Fd6";
  const stakingAddress = "0x8F293C24E81FeF1f0aE3c381CBd6AD78236b810c";
  
  const dittoCoin = await ethers.getContractAt("DittoCoin", tokenAddress);
  const dittoStaking = await ethers.getContractAt("DittoStaking", stakingAddress);
  
  // Check current state
  console.log("Deployer:", deployer.address);
  console.log("Deployer exempt:", await dittoCoin.isExempt(deployer.address));
  console.log("Staking exempt:", await dittoCoin.isExempt(stakingAddress));
  console.log("Deployer DITTO balance:", ethers.formatEther(await dittoCoin.balanceOf(deployer.address)));
  console.log("Current reward pool:", ethers.formatEther(await dittoStaking.rewardPool()));
  
  // Fund reward pool
  const rewardAmount = ethers.parseEther("5000000000");
  
  console.log("\nApproving...");
  const approveTx = await dittoCoin.approve(stakingAddress, rewardAmount);
  await approveTx.wait();
  console.log("  ✓ Approved");
  
  console.log("Funding reward pool...");
  const fundTx = await dittoStaking.fundRewardPool(rewardAmount);
  await fundTx.wait();
  console.log("  ✓ Reward pool funded with 5,000,000,000 DITTO");
  
  console.log("\nFinal reward pool:", ethers.formatEther(await dittoStaking.rewardPool()));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error.message || error);
    process.exit(1);
  });
