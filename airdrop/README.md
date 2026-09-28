# Token airdrop claim site

A static airdrop claim page for an ERC-20 token on **Ethereum**: connect wallet → check eligibility → claim.
Claims are checked on-chain against a Merkle root (OpenZeppelin `StandardMerkleTree` format).

The page runs in **demo mode** until you set a distributor address: eligibility checks work, and claims are simulated.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The site (plain HTML/CSS/JS, ethers v6 from cdnjs) |
| `config.js` | Project name, token symbol, chain, contract address, deadline, links |
| `data/allocations.csv` | Input list: `address,amount` (whole tokens) |
| `data/claims.json` | Generated amounts + Merkle proofs that the site loads |
| `scripts/generate-claims.mjs` | Builds `claims.json` from the CSV and prints the Merkle root |
| `contracts/AirdropToken.sol` | Fixed-supply ERC-20 (burnable, EIP-2612 permit). No owner, no minting after deploy |
| `contracts/MerkleAirdrop.sol` | Distributor contract: `claim`, `isClaimed`, `sweep` after the deadline |
| `scripts/deploy.cjs` | Deploys the token (or reuses `TOKEN_ADDRESS`) and distributor, funds it, updates `config.js` |
| `scripts/verify.cjs` | Verifies both contracts on Etherscan |
| `test/airdrop.test.cjs` | Hardhat tests for the token and claim flow |
| `hardhat.config.cjs`, `.env.example` | Networks (Sepolia, mainnet) and secrets template |

## Run locally

```bash
cd airdrop
npm install
npm run generate          # rebuild data/claims.json from data/allocations.csv
npx serve .               # or: python3 -m http.server
```

Demo allocations are for `0x1111…1111` through `0x5555…5555`. Paste one into the "Check" box.

## Contracts: test and deploy on Ethereum

```bash
npm test                  # compile + run the contract tests
cp .env.example .env      # then fill in PRIVATE_KEY, RPC URLs, ETHERSCAN_API_KEY, token settings
```

1. Put your real allocations in `data/allocations.csv` and run `npm run generate`.
2. Set `claimDeadline` in `config.js` (or `CLAIM_DEADLINE` in `.env`).
3. Deploy to Sepolia first:
   ```bash
   npm run deploy:sepolia
   npm run verify -- --network sepolia
   ```
   This deploys `AirdropToken` with the whole `TOKEN_SUPPLY` minted to your wallet (skipped if `TOKEN_ADDRESS`
   is set), deploys `MerkleAirdrop`, sends it exactly the airdrop total, saves `deployments/sepolia.json`,
   and points `config.js` at the new contract. The site leaves demo mode at that point.
4. Test a real claim on the site with a wallet from your list, then repeat with `npm run deploy:mainnet`.
5. Host the folder on any static host (GitHub Pages, Vercel, Netlify, IPFS).

The contracts target the Cancun EVM version (required by OpenZeppelin 5.x), which Ethereum mainnet and
Sepolia support.

## Security

The site's only write call is `claim(account, amount, proof)`, and tokens always go to the eligible `account`.
It never requests token approvals, `setApprovalForAll`, or permit signatures. Have the contract audited before
mainnet use.
