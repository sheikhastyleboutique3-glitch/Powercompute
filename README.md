# PowerCompute ($PWR)

**Decentralized Energy-to-Compute Orchestration Protocol.**

PowerCompute routes stranded/curtailed renewable grid energy into verified,
on-demand GPU compute for AI workloads — rewarding node operators and stakers
in **$PWR**. This repo contains everything you need to deploy a full testnet
dApp for **$0**, in under 3 minutes.

## What's in this repo

| File | Purpose |
|---|---|
| [`PowerComputeToken.sol`](./PowerComputeToken.sol) | Self-contained ERC-20 ($PWR) + built-in staking module (`stake`, `unstake`, `claimRewards`). No external imports — pastes directly into Remix. |
| [`index.html`](./index.html) | Full single-file landing page + dApp (Tailwind CSS, Ethers.js v5, Chart.js, Lucide icons). Wallet connect, live metrics, yield calculator, staking portal, roadmap, tokenomics. |

---

## 🚀 Step 1 — Deploy the Smart Contract (Remix IDE + Base Sepolia)

**Time: ~90 seconds**

1. Open [Remix IDE](https://remix.ethereum.org) in your browser.
2. In the **File Explorer** (left sidebar), create a new file named `PowerComputeToken.sol` and paste in the full contents of [`PowerComputeToken.sol`](./PowerComputeToken.sol) from this repo.
3. Go to the **Solidity Compiler** tab (left sidebar). Set the compiler version to `0.8.20` or higher, then click **Compile PowerComputeToken.sol**. It should compile with no errors and no external imports required.
4. Get free Base Sepolia testnet ETH for gas from a faucet, e.g. the [Coinbase Base Sepolia Faucet](https://www.coinbase.com/faucets/base-sepolia-faucet) or [Alchemy's Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia) (requires a small mainnet balance / free sign-in).
5. Go to the **Deploy & Run Transactions** tab:
   - Set **Environment** to `Injected Provider - MetaMask` (this connects Remix to your browser wallet).
   - In MetaMask, switch/add the **Base Sepolia** network:
     - Network Name: `Base Sepolia`
     - RPC URL: `https://sepolia.base.org`
     - Chain ID: `84532`
     - Currency Symbol: `ETH`
     - Block Explorer: `https://sepolia.basescan.org`
   - Under **Contract**, select `PowerComputeToken`.
   - Fill in the constructor parameters next to the **Deploy** button:
     - `INITIALSUPPLY`: e.g. `200000000` (mints 200,000,000 $PWR to your wallet — do NOT add 18 zeros, the contract handles decimals internally)
     - `INITIALREWARDRATEPERSECOND`: e.g. `1000000000000000` (1e15 = 0.001 $PWR/sec shared across all stakers)
   - Click **Deploy**, then confirm the transaction in MetaMask.
6. Once mined, copy the **deployed contract address** shown under "Deployed Contracts" in Remix. Optionally verify it on [BaseScan Sepolia](https://sepolia.basescan.org) by pasting the flattened source (this file has zero imports, so it flattens as-is).
7. (Optional but recommended) Call `fundRewardsPool(amount)` from the owner account to seed the staking rewards pool so `stake()` / `claimRewards()` have rewards to distribute — e.g. fund it with `50000000000000000000000000` wei (50,000,000 $PWR with 18 decimals). No prior `approve()` call is needed since the owner is calling directly and the function pulls from the caller's own balance.

---

## 🎨 Step 2 — Wire the Contract Address into the dApp

1. Open [`index.html`](./index.html) in a text editor.
2. Find this line near the top of the `<script>` block (search for `CONTRACT_ADDRESS`):
   ```js
   const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
   ```
3. Replace it with your deployed address from Step 1:
   ```js
   const CONTRACT_ADDRESS = "0xYourDeployedContractAddressHere";
   ```
4. Save the file. That's it — no build step, no `npm install`, no bundler. It's a single static HTML file.

---

## 🌐 Step 3 — Deploy to Vercel for Free (under 3 minutes)

**Option A — Vercel Web UI (no CLI needed)**

1. Push this repo (with your updated `index.html`) to GitHub — it's already set up if you're reading this from the repo.
2. Go to [vercel.com/new](https://vercel.com/new) and sign in with your GitHub account.
3. Click **Import** next to this repository.
4. Framework Preset: choose **Other** (it's a static file, no framework needed).
5. Leave Build Command and Output Directory blank — Vercel will auto-detect and serve `index.html` as a static site.
6. Click **Deploy**. Your live dApp URL will be ready in under a minute (e.g. `https://powercompute.vercel.app`).

**Option B — Vercel CLI**

```bash
npm i -g vercel
vercel --prod
```

Run this from the folder containing `index.html` and follow the prompts (accept all defaults). Vercel will give you a live URL immediately.

---

## ✅ Post-Deploy Checklist

- [ ] Confirm `CONTRACT_ADDRESS` in `index.html` matches your deployed contract on Base Sepolia.
- [ ] Confirm your wallet is set to the **Base Sepolia** network before testing Connect Wallet / Stake / Unstake.
- [ ] Fund the on-chain `rewardsPool` (via `fundRewardsPool`) so stakers actually accrue rewards.
- [ ] Update the social links, GitHub link, and docs link in the footer of `index.html` to your real project links.
- [ ] (Optional) Verify the contract source on [BaseScan Sepolia](https://sepolia.basescan.org) for the "Contract Verified" trust badge.

## Local Preview

No build tools required. Just open `index.html` directly in a browser, or serve it locally:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

## ⚠️ Disclaimer

This is testnet software for demonstration purposes. Testnet $PWR and ETH hold
no monetary value. `PowerComputeToken.sol` has not been professionally
audited — do not deploy to a production mainnet or use with real funds
without a full third-party security audit.
