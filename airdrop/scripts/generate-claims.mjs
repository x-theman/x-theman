// Build data/claims.json from a CSV of `address,amount` rows (amount in whole tokens).
// Usage: node scripts/generate-claims.mjs allocations.csv [decimals=18]
import { readFileSync, writeFileSync } from "node:fs";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { getAddress, parseUnits } from "ethers";

const [, , csvPath, decimalsArg = "18"] = process.argv;
if (!csvPath) {
  console.error("Usage: node scripts/generate-claims.mjs allocations.csv [decimals]");
  process.exit(1);
}
const decimals = Number(decimalsArg);

const rows = readFileSync(csvPath, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.toLowerCase().startsWith("address"))
  .map((l) => {
    const [addr, amount] = l.split(",").map((s) => s.trim());
    return [getAddress(addr), parseUnits(amount, decimals).toString()];
  });

const seen = new Set();
for (const [addr] of rows) {
  if (seen.has(addr)) throw new Error(`Duplicate address: ${addr}`);
  seen.add(addr);
}

const tree = StandardMerkleTree.of(rows, ["address", "uint256"]);

const claims = {};
let total = 0n;
for (const [i, [addr, amount]] of tree.entries()) {
  claims[addr] = { amount, proof: tree.getProof(i) };
  total += BigInt(amount);
}

const out = { merkleRoot: tree.root, tokenTotal: total.toString(), claims };
writeFileSync(new URL("../data/claims.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${rows.length} claims. Merkle root: ${tree.root}`);
