// Verify the contracts from deployments/<network>.json on Etherscan.
// Usage: npx hardhat run scripts/verify.cjs --network sepolia
const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

async function verify(address, constructorArguments) {
  try {
    await hre.run("verify:verify", { address, constructorArguments });
  } catch (err) {
    if (/already verified/i.test(err.message)) console.log(`${address} is already verified`);
    else throw err;
  }
}

async function main() {
  const file = path.join(__dirname, "..", `deployments/${hre.network.name}.json`);
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  if (record.token.args) await verify(record.token.address, record.token.args);
  await verify(record.airdrop.address, record.airdrop.args);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
