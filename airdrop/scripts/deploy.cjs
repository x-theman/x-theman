// Deploy the token (unless TOKEN_ADDRESS is set) and the MerkleAirdrop distributor,
// fund the distributor, and point config.js at it.
// Usage: npx hardhat run scripts/deploy.cjs --network sepolia
const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");
require("dotenv").config({ quiet: true });

const { ethers, network } = hre;
const root = path.join(__dirname, "..");
const configPath = path.join(root, "config.js");

const NETWORKS = {
  1: { chainName: "Ethereum", explorerUrl: "https://etherscan.io" },
  11155111: { chainName: "Sepolia", explorerUrl: "https://sepolia.etherscan.io" },
};

function readDeadline() {
  const iso =
    process.env.CLAIM_DEADLINE ||
    fs.readFileSync(configPath, "utf8").match(/claimDeadline:\s*"([^"]+)"/)?.[1];
  const ts = Math.floor(new Date(iso).getTime() / 1000);
  if (!ts) throw new Error("Set CLAIM_DEADLINE or claimDeadline in config.js.");
  if (ts <= Math.floor(Date.now() / 1000)) throw new Error(`Claim deadline ${iso} is in the past.`);
  return { iso, ts };
}

function updateConfig(fields) {
  let src = fs.readFileSync(configPath, "utf8");
  for (const [key, value] of Object.entries(fields)) {
    src = src.replace(new RegExp(`(${key}:\\s*)"[^"]*"`), `$1"${value}"`);
  }
  fs.writeFileSync(configPath, src);
}

async function main() {
  const claims = JSON.parse(fs.readFileSync(path.join(root, "data/claims.json"), "utf8"));
  const total = BigInt(claims.tokenTotal);
  const deadline = readDeadline();
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  console.log(`Network:   ${network.name} (chain ${chainId})`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Root:      ${claims.merkleRoot}`);
  console.log(`Airdrop:   ${ethers.formatUnits(total, 18)} tokens to ${Object.keys(claims.claims).length} wallets`);
  console.log(`Deadline:  ${deadline.iso}\n`);

  let token;
  let tokenArgs = null;
  if (process.env.TOKEN_ADDRESS) {
    token = await ethers.getContractAt("IERC20", process.env.TOKEN_ADDRESS);
    console.log(`Using existing token ${process.env.TOKEN_ADDRESS}`);
  } else {
    const name = process.env.TOKEN_NAME || "Meridian";
    const symbol = process.env.TOKEN_SYMBOL || "MRD";
    const supply = ethers.parseUnits(process.env.TOKEN_SUPPLY || "1000000000", 18);
    if (supply < total) throw new Error("TOKEN_SUPPLY is smaller than the airdrop total.");
    tokenArgs = [name, symbol, supply.toString(), deployer.address];
    token = await ethers.deployContract("AirdropToken", tokenArgs);
    await token.waitForDeployment();
    console.log(`AirdropToken (${symbol}) deployed at ${await token.getAddress()}`);
  }
  const tokenAddress = await token.getAddress();

  const balance = await token.balanceOf(deployer.address);
  if (balance < total) {
    throw new Error(`Deployer holds ${ethers.formatUnits(balance, 18)} tokens; the airdrop needs ${ethers.formatUnits(total, 18)}.`);
  }

  const airdropArgs = [tokenAddress, claims.merkleRoot, deadline.ts];
  const airdrop = await ethers.deployContract("MerkleAirdrop", airdropArgs);
  await airdrop.waitForDeployment();
  const airdropAddress = await airdrop.getAddress();
  console.log(`MerkleAirdrop deployed at ${airdropAddress}`);

  await (await token.transfer(airdropAddress, total)).wait();
  console.log(`Funded distributor with ${ethers.formatUnits(total, 18)} tokens`);

  const record = {
    network: network.name,
    chainId: Number(chainId),
    token: { address: tokenAddress, args: tokenArgs },
    airdrop: { address: airdropAddress, args: airdropArgs.map(String) },
    deployedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.join(root, "deployments"), { recursive: true });
  fs.writeFileSync(path.join(root, `deployments/${network.name}.json`), JSON.stringify(record, null, 2) + "\n");

  const known = NETWORKS[Number(chainId)];
  if (known) {
    updateConfig({ distributorAddress: airdropAddress, chainId: `0x${chainId.toString(16)}`, ...known });
    console.log(`\nconfig.js now points at ${known.chainName}. The site is out of demo mode.`);
  }
  console.log(`Saved deployments/${network.name}.json. Verify with: npm run verify -- --network ${network.name}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
