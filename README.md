# PowerCompute ($PWR)

**Decentralized Energy-to-Compute Orchestration Protocol.**

PowerCompute routes stranded/curtailed renewable grid energy into verified,
on-demand GPU compute for AI workloads — rewarding node operators and stakers
in **$PWR**. This repo is a complete, $0-budget dApp: three interlinked
smart contracts, a public landing page, a node-operator dashboard, and a
full admin panel — all deployable for free in under 10 minutes.

---

## 1. Project Structure

```
Powercompute/
├── contracts/
│   ├── common/
│   │   └── PowerComputeBase.sol      # Shared IERC20, Ownable, Pausable, ReentrancyGuard, ERC20 base
│   ├── PowerComputeToken.sol         # $PWR ERC-20 + staking + protocol emissions (mintReward)
│   ├── NodeRegistry.sol              # GPU node registry + Proof-of-Energy-Consumption (PoEC) rewards
│   └── PowerComputePresale.sol       # Phased ETH presale with claim/refund flow
├── assets/
│   ├── css/style.css                 # Shared cyberpunk/DePIN glassmorphism design system
│   └── js/
│       ├── config.js                 # ⚠️ EDIT THIS: contract addresses + ABIs (single source of truth)
│       └── wallet.js                 # Shared wallet connection, formatting helpers, toast system
├── index.html                        # Public landing page (hero, presale, calculator, chart, staking)
├── dashboard.html                    # Node operator portal (register nodes, submit energy proofs)
├── admin.html                        # Owner-only admin console (verify nodes, approve rewards, manage presale)
└── README.md                         # You are here
```

**Why 3 contracts instead of 1?** Splitting concerns keeps each contract
small, auditable, and independently upgradable:

- **`PowerComputeToken.sol`** — the $PWR ERC-20 itself, plus a generic
  staking module. It never talks to the other two contracts directly; it
  just exposes `mintReward()` to anyone on its `minters` allowlist.
- **`NodeRegistry.sol`** — the DePIN core. Tracks GPU nodes, verifies them,
  and runs the Proof-of-Energy-Consumption (PoEC) pipeline that mints $PWR
  rewards for verified energy routing. It's the *only* contract that needs
  to be added as a token minter.
- **`PowerComputePresale.sol`** — an isolated, self-contained ETH presale.
  It only needs read/transfer access to the token (no minter role), so a
  bug here can never affect token supply integrity.

All three contracts import shared primitives from
[`contracts/common/PowerComputeBase.sol`](./contracts/common/PowerComputeBase.sol)
— there are **zero external npm/OpenZeppelin dependencies** anywhere in this
repo, so everything compiles in Remix with no import resolution or network
access required.

---

## 2. Smart Contract Reference

### `PowerComputeToken.sol` ($PWR)
- Standard ERC-20 (`transfer`, `approve`, `transferFrom`), 18 decimals, hard-capped at **1,000,000,000 $PWR**.
- Built-in staking: `stake(amount)`, `unstake(amount)`, `claimRewards()` — rewards accrue continuously via a MasterChef-style accumulator, funded by `fundRewardsPool(amount)`.
- Protocol emissions: `mintReward(to, amount)` — callable only by addresses on the `minters` allowlist (set via `setMinter(addr, true)`). This is how `NodeRegistry` pays PoEC rewards without needing custody of tokens.
- Admin: `mint()` (grants/liquidity, capped), `setRewardRatePerSecond()`, `setUnstakeCooldown()`, `pause()/unpause()`, `recoverForeignToken()`.

### `NodeRegistry.sol`
- **Node lifecycle:** `registerNode(gpuModel, gpuCount, energySiteId, region)` → starts `Pending` → `verifyNode()` (oracle/owner) → `Active` → optionally `suspendNode()` / `reinstateNode()` → `retireNode()` (operator or oracle/owner, permanent).
- **PoEC reward pipeline:** operator calls `submitEnergyProof(nodeId, kWhRouted, periodStart, periodEnd)` → oracle/owner calls `approveEnergyProof(proofId)` (mints `kWhRouted * rewardPerKwh` in $PWR directly to the operator) or `rejectEnergyProof(proofId, reason)`.
- **Admin:** `setOracle(addr, allowed)` (multiple oracles supported), `setRewardPerKwh()`, `setMaxKwhPerProof()` (bounds a single proof's mint size), `pause()/unpause()`.
- **⚠️ Must be approved as a token minter** — see deployment step 4 below.

### `PowerComputePresale.sol`
- Owner adds one or more phases via `addPhase(priceWeiPerToken, capWei)` while in `Configuring` state, then calls `startPresale()`.
- Contributors call `contribute()` with ETH attached — automatically splits across phase boundaries if a contribution would overflow the current phase's cap.
- Owner deposits enough $PWR to cover `totalTokensSold` via `depositTokensForClaims(amount)` (requires a prior `approve()` on the token), then calls `finalize()` to lock the raise and open claims.
- Contributors call `claim()` to receive their $PWR allocation.
- If cancelled instead (`cancelPresale()`), contributors call `claimRefund()` to get their ETH back.
- Owner sweeps raised ETH via `withdrawRaisedFunds(to)` once finalized.

---

## 3. Deploy Everything (Remix IDE + Base Sepolia) — ~10 minutes

**Time: ~10 minutes for all 3 contracts + wiring**

1. Open [Remix IDE](https://remix.ethereum.org). Use the **"Clone Git Repository"** option (or manually create matching files/folders) to bring in the entire `contracts/` folder from this repo, preserving the folder structure (`contracts/common/PowerComputeBase.sol` must stay a relative import target of the other three files).
2. **Solidity Compiler** tab → set version to `0.8.20+` → compile all 4 files. Zero external imports means zero network calls needed to compile.
3. Get free Base Sepolia testnet ETH from a faucet, e.g. the [Coinbase Base Sepolia Faucet](https://www.coinbase.com/faucets/base-sepolia-faucet) or [Alchemy's Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia).
4. **Deploy & Run Transactions** tab → Environment: `Injected Provider - MetaMask`. In MetaMask, add/switch to **Base Sepolia**:
   - Network Name: `Base Sepolia` · RPC URL: `https://sepolia.base.org` · Chain ID: `84532` · Currency: `ETH` · Explorer: `https://sepolia.basescan.org`

   **Deploy in this exact order:**

   **a) `PowerComputeToken`**
   - Constructor args: `initialSupply` (e.g. `200000000` for 200M $PWR — no decimals, contract handles that), `initialRewardRatePerSecond` (e.g. `1000000000000000` = 0.001 $PWR/sec shared across all stakers).
   - Deploy → copy the deployed address as `TOKEN_ADDRESS`.

   **b) `NodeRegistry`**
   - Constructor args: `pwrTokenAddress` (the address from step a), `initialOwner` (your wallet address).
   - Deploy → copy the deployed address as `NODE_REGISTRY_ADDRESS`.

   **c) `PowerComputePresale`**
   - Constructor args: `pwrTokenAddress` (from step a), `fundingGoalWei_` (e.g. `2000000000000000000` = 2 ETH goal), `initialOwner` (your wallet).
   - Deploy → copy the deployed address as `PRESALE_ADDRESS`.

5. **Critical wiring step** — on the deployed `PowerComputeToken` instance in Remix, call:
   ```
   setMinter(<NODE_REGISTRY_ADDRESS>, true)
   ```
   Without this, `NodeRegistry.approveEnergyProof()` will revert — it can't mint $PWR rewards until it's an approved minter.

6. (Optional) Fund the staking rewards pool: call `fundRewardsPool(amount)` on the token (e.g. `50000000000000000000000000` wei = 50,000,000 $PWR, 18 decimals) — no prior `approve()` needed since the owner calls it directly.
7. (Optional) Configure the presale: call `addPhase(priceWeiPerToken, capWei)` one or more times, then `startPresale()`. Example phase: price `14000000000000` wei/token (~$0.014 equiv. in ETH terms) with a cap of `1000000000000000000000` wei (1000 ETH).

---

## 4. Wire the Frontend (1 file to edit)

Open [`assets/js/config.js`](./assets/js/config.js) and paste your three deployed addresses:

```js
const POWERCOMPUTE_CONFIG = {
  TOKEN_ADDRESS: "0xYourTokenAddress",
  NODE_REGISTRY_ADDRESS: "0xYourNodeRegistryAddress",
  PRESALE_ADDRESS: "0xYourPresaleAddress",
  // ...chain config below stays as-is for Base Sepolia
};
```

That's it — **`index.html`, `dashboard.html`, and `admin.html` all read from
this one file.** No build step, no bundler, no `npm install`.

---

## 5. What Each Page Does

| Page | Audience | Purpose |
|---|---|---|
| [`index.html`](./index.html) | Public / investors | Hero, live protocol metrics, presale contribution + claim, GPU yield calculator, live energy chart, staking portal, roadmap, tokenomics. |
| [`dashboard.html`](./dashboard.html) | Node operators | Register a GPU node, submit Proof-of-Energy-Consumption reports, track your nodes' status and $PWR rewards earned. |
| [`admin.html`](./admin.html) | Contract owner | Verify pending nodes, approve/reject energy proofs, mint/manage $PWR emissions, configure and run the presale, view a live protocol-wide activity log. Automatically hides all write-controls unless your connected wallet is the token's `owner()`. |

All three pages gracefully fall back to simulated demo data (clearly labeled)
wherever a contract isn't configured yet, so the site looks complete and
functional even before you deploy anything.

---

## 6. Deploy the Frontend to Vercel for Free (under 3 minutes)

**Option A — Vercel Web UI (no CLI needed)**

1. Push this repo (with your updated `assets/js/config.js`) to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
3. Click **Import** next to this repository.
4. Framework Preset: **Other**. Leave Build Command / Output Directory blank — it's a static multi-page site.
5. Click **Deploy**. You'll get a live URL (e.g. `https://powercompute.vercel.app`) with `/`, `/dashboard.html`, and `/admin.html` all working.

**Option B — Vercel CLI**

```bash
npm i -g vercel
vercel --prod
```

Run from the repo root and accept the defaults.

---

## 7. Post-Deploy Checklist

- [ ] All 3 addresses in `assets/js/config.js` match your deployed contracts on Base Sepolia.
- [ ] `PowerComputeToken.setMinter(NodeRegistry, true)` was called — otherwise energy proof approval reverts.
- [ ] Staking rewards pool funded via `fundRewardsPool()` if you want the staking portal to actually pay out.
- [ ] At least one presale phase added + `startPresale()` called if you want the presale section to accept contributions.
- [ ] Your wallet is on **Base Sepolia** before testing any button.
- [ ] Visit `admin.html` with the deployer wallet connected to confirm admin controls are visible (they're hidden for non-owner wallets).
- [ ] Update the social links, GitHub link, and docs link in `index.html`'s footer to your real project links.
- [ ] (Optional) Verify all 4 contract files on [BaseScan Sepolia](https://sepolia.basescan.org) — flatten `contracts/` into a single file per contract, or use the "Standard JSON Input" verification method with all 4 files.

## Local Preview

No build tools required.

```bash
python3 -m http.server 8080
# visit http://localhost:8080, http://localhost:8080/dashboard.html, http://localhost:8080/admin.html
```

## ⚠️ Disclaimer

This is testnet software for demonstration purposes. Testnet $PWR and ETH
hold no monetary value. None of the contracts in `contracts/` have been
professionally audited — do not deploy to mainnet or use with real funds
without a full third-party security audit. $PWR is a utility/governance
token; nothing in this repo constitutes financial or investment advice.
