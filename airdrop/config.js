// Edit these values for your own token and airdrop.
window.AIRDROP_CONFIG = {
  projectName: "Meridian",
  tokenSymbol: "MRD",
  tokenDecimals: 18,

  // Ethereum network the distributor contract lives on (hex chain id).
  // Mainnet: "0x1" / https://etherscan.io
  // Sepolia testnet (for testing): "0xaa36a7" / https://sepolia.etherscan.io
  chainId: "0x1",
  chainName: "Ethereum",
  explorerUrl: "https://etherscan.io",

  // Deployed MerkleAirdrop contract (see contracts/MerkleAirdrop.sol).
  // Leave empty to run the site in demo mode: eligibility works, claims are simulated.
  distributorAddress: "",

  // Output of scripts/generate-claims.mjs.
  claimsUrl: "data/claims.json",

  // ISO date when claiming closes.
  claimDeadline: "2026-12-31T23:59:59Z",

  links: {
    website: "#",
    docs: "#",
    x: "#",
    discord: "#",
  },
};
