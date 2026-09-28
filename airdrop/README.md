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
| `contracts/MerkleAirdrop.sol` | Distributor contract: `claim`, `isClaimed`, `sweep` after the deadline |

## Run locally

```bash
cd airdrop
npm install
npm run generate          # rebuild data/claims.json from data/allocations.csv
npx serve .               # or: python3 -m http.server
```

Demo allocations are for `0x1111…1111` through `0x5555…5555`. Paste one into the "Check" box.

## Go live on Ethereum

1. Put your real allocations in `data/allocations.csv` and run `npm run generate`. Note the Merkle root it prints.
2. Deploy `contracts/MerkleAirdrop.sol` (Foundry/Hardhat with `@openzeppelin/contracts` v5) with
   `(tokenAddress, merkleRoot, claimDeadlineUnix)`. Try it on Sepolia first.
3. Transfer the total allocation of tokens to the deployed contract.
4. In `config.js`, set `distributorAddress`, `chainId` (`0x1` mainnet, `0xaa36a7` Sepolia), `explorerUrl`,
   `claimDeadline`, branding and links.
5. Host the folder on any static host (GitHub Pages, Vercel, Netlify, IPFS).

## Security

The site's only write call is `claim(account, amount, proof)`, and tokens always go to the eligible `account`.
It never requests token approvals, `setApprovalForAll`, or permit signatures. Have the contract audited before
mainnet use.
