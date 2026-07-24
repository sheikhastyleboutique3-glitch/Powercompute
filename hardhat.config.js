/**
 * Hardhat configuration for running the test suite in /test against the
 * contracts in /contracts. This repo ships as static HTML + Solidity for
 * a $0-budget Vercel deployment — this config file exists ONLY to make the
 * tests in /test runnable locally; it is not required for deploying the
 * dApp itself (deployment is via Remix, per README.md).
 *
 * Setup:
 *   npm init -y
 *   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
 *   npx hardhat test
 *
 * Optional: to also deploy to Base Sepolia via Hardhat instead of Remix,
 * add a `baseSepolia` network block here with your RPC URL and a private
 * key loaded from an environment variable (never commit a private key).
 */

require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    hardhat: {
      // Default in-memory network used by `npx hardhat test`.
    }
    // Uncomment and fill in to deploy/test against Base Sepolia directly
    // via Hardhat instead of Remix:
    // baseSepolia: {
    //   url: "https://sepolia.base.org",
    //   accounts: [process.env.DEPLOYER_PRIVATE_KEY]
    // }
  }
};
