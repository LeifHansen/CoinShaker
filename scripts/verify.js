/**
 * Verify DittoCoin and DittoStaking on Etherscan after deployment.
 *
 * Usage:
 *   npx hardhat run scripts/verify.js --network sepolia
 *
 * Make sure ETHERSCAN_API_KEY is set in your .env file
 * and update the addresses below with your deployed addresses.
 */

const DITTOCOIN_ADDRESS = "0xE85644Ab000b8741837746335819F0AE750e1Fd6";
const TREASURY_ADDRESS = "0x3eF18A237078ADfc28873fd46E1182e9DB1Eaf9A";
const STAKING_ADDRESS = "0x8F293C24E81FeF1f0aE3c381CBd6AD78236b810c";

async function main() {
  if (DITTOCOIN_ADDRESS.startsWith("PASTE")) {
    console.error("ERROR: Update contract addresses in scripts/verify.js first.");
    process.exit(1);
  }

  // Verify DittoCoin
  console.log("Verifying DittoCoin at:", DITTOCOIN_ADDRESS);
  await hre.run("verify:verify", {
    address: DITTOCOIN_ADDRESS,
    constructorArguments: [TREASURY_ADDRESS],
  });
  console.log("✓ DittoCoin verified!\n");

  // Verify DittoStaking
  console.log("Verifying DittoStaking at:", STAKING_ADDRESS);
  await hre.run("verify:verify", {
    address: STAKING_ADDRESS,
    constructorArguments: [DITTOCOIN_ADDRESS],
  });
  console.log("✓ DittoStaking verified!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
