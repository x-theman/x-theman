require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ quiet: true });

const { PRIVATE_KEY, SEPOLIA_RPC_URL, MAINNET_RPC_URL, ETHERSCAN_API_KEY } = process.env;
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  networks: {
    sepolia: { url: SEPOLIA_RPC_URL || "", accounts, chainId: 11155111 },
    mainnet: { url: MAINNET_RPC_URL || "", accounts, chainId: 1 },
  },
  etherscan: { apiKey: ETHERSCAN_API_KEY || "" },
};
