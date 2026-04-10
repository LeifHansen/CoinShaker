const { run } = require("hardhat");

// Update these with your deployed addresses before running
const DITTO_COIN_ADDRESS = "0x0000000000000000000000000000000000000000";
const DITTO_STAKING_ADDRESS = "0x0000000000000000000000000000000000000000";
const TREASURY_ADDRESS = "0x0000000000000000000000000000000000000000";

async function verifyContract(address, constructorArgs, name) {
  console.log(`Verifying ${name} at ${address}...`);
  try {
    await run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
    });
    console.log(`  ${name} verified!`);
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log(`  ${name} is already verified`);
    } else {
      console.error(`  Error verifying ${name}:`, error.message);
    }
  }
}

async function main() {
  await verifyContract(DITTO_COIN_ADDRESS, [TREASURY_ADDRESS], "DittoCoin");
  await verifyContract(DITTO_STAKING_ADDRESS, [DITTO_COIN_ADDRESS], "DittoStaking");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
