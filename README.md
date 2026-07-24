# PowerCompute ($PWR)

**Decentralized Energy-to-Compute Orchestration Protocol.**

PowerCompute routes stranded/curtailed renewable grid energy into verified,
on-demand GPU compute for AI workloads — rewarding node operators and stakers
in **$PWR**. This repo is a complete, $0-budget dApp: **8 interlinked smart
contracts**, a public landing page, a node-operator dashboard, a public
governance page, a leaderboard, and a hardened, owner-only admin console —
all deployable for free.

---

## 1. Project Structure

```
Powercompute/
├── contracts/
│   ├── common/
│   │   └── PowerComputeBase.sol      # Shared IERC20, Ownable, Pausable, ReentrancyGuard, ERC20 base
│   ├── PowerComputeToken.sol         # $PWR ERC-20 + staking + protocol emissions (mintReward)
│   ├── NodeRegistry.sol              # GPU node registry + PoEC rewards + batch admin actions
│   ├── PowerComputePresale.sol       # Phased ETH presale + referral program + claim/refund flow
│   ├── PowerComputeAnnouncements.sol # On-chain CMS for articles/announcements (no server/database needed)
│   ├── PowerComputeVesting.sol       # Linear vesting w/ cliff for team/advisor $PWR allocations
│   ├── PowerComputeGovernor.sol      # Stake-weighted advisory governance (propose/vote)
│   └── PowerComputeTimelock.sol      # Optional timelock controller for delayed, transparent admin actions
├── assets/
│   ├── css/style.css                 # Shared cyberpunk/DePIN glassmorphism design system
│   └── js/
│       ├── config.js                 # ⚠️ EDIT THIS: contract addresses + ABIs (single source of truth)
│       └── wallet.js                 # Shared wallet connection (injected + WalletConnect), formatting, toasts
├── index.html                        # Public landing page (hero, presale+referrals, calculator, chart, staking, news)
├── dashboard.html                    # Node operator portal (register nodes, referral link, vesting, alerts)
├── governance.html                   # Public stake-weighted voting page
├── leaderboard.html                  # Public rankings: top node operators / stakers / referrers
├── admin.html                        # Owner-only admin console — see Section 6 for the access model
├── test/                             # Hardhat test suite (see Section 8 — Testing)
├── hardhat.config.js                 # Hardhat config, only needed to run /test locally
├── package.json                      # devDependencies for running /test locally
├── robots.txt / sitemap.xml          # Basic SEO — admin.html intentionally excluded from both
└── README.md                         # You are here
```

**Why 8 contracts instead of 1?** Splitting concerns keeps each contract
small, auditable, and independently upgradable — a bug in one (e.g. the
presale) can never touch the integrity of another (e.g. the token supply):

- **`PowerComputeToken.sol`** — the $PWR ERC-20 itself, plus a generic
  staking module. It never talks to the other contracts directly; it
  just exposes `mintReward()` to anyone on its `minters` allowlist.
- **`NodeRegistry.sol`** — the DePIN core. Tracks GPU nodes, verifies them,
  and runs the Proof-of-Energy-Consumption (PoEC) pipeline that mints $PWR
  rewards for verified energy routing. Includes batch functions
  (`batchVerifyNodes`, `batchApproveEnergyProofs`) so admins aren't stuck
  doing one transaction per item once volume grows.
- **`PowerComputePresale.sol`** — an isolated, self-contained ETH presale
  with a built-in **referral program** (see Section 4).
- **`PowerComputeAnnouncements.sol`** — a minimal on-chain CMS so the team
  can publish news/articles with zero backend/database.
- **`PowerComputeVesting.sol`** — makes "24-month linear, 6-month cliff"
  team/advisor allocations a real, enforced on-chain guarantee instead of
  a slide in a deck.
- **`PowerComputeGovernor.sol`** — lets staked $PWR holders actually vote
  on protocol decisions (advisory — see Section 5).
- **`PowerComputeTimelock.sol`** — an optional but strongly recommended
  layer that adds a public delay before sensitive admin actions execute
  (see Section 7 — Security Hardening).

All contracts import shared primitives from
[`contracts/common/PowerComputeBase.sol`](./contracts/common/PowerComputeBase.sol)
— there are **zero external npm/OpenZeppelin dependencies** anywhere in
`contracts/`, so everything compiles in Remix with no import resolution or
network access required.

---

## 2. Smart Contract Reference

### `PowerComputeToken.sol` ($PWR)
- Standard ERC-20, 18 decimals, hard-capped at **1,000,000,000 $PWR**.
- Built-in staking: `stake(amount)`, `unstake(amount)`, `claimRewards()` — rewards accrue continuously via a MasterChef-style accumulator, funded by `fundRewardsPool(amount)`.
- Protocol emissions: `mintReward(to, amount)` — callable only by addresses on the `minters` allowlist (set via `setMinter(addr, true)`). This is how `NodeRegistry` pays PoEC rewards without needing custody of tokens.
- Admin: `mint()` (grants/liquidity, capped), `setRewardRatePerSecond()`, `setUnstakeCooldown()`, `pause()/unpause()`, `recoverForeignToken()`.

### `NodeRegistry.sol`
- **Node lifecycle:** `registerNode(gpuModel, gpuCount, energySiteId, region)` → `Pending` → `verifyNode()` (oracle/owner) → `Active` → optionally `suspendNode()` / `reinstateNode()` → `retireNode()` (operator or oracle/owner, permanent).
- **PoEC reward pipeline:** operator calls `submitEnergyProof(nodeId, kWhRouted, periodStart, periodEnd)` → oracle/owner calls `approveEnergyProof(proofId)` (mints `kWhRouted * rewardPerKwh` in $PWR directly to the operator) or `rejectEnergyProof(proofId, reason)`.
- **Batch admin:** `batchVerifyNodes(nodeIds[])` and `batchApproveEnergyProofs(proofIds[])` process a list in one transaction, silently skipping entries that are already resolved/invalid rather than reverting the whole batch.
- **Admin:** `setOracle(addr, allowed)` (multiple oracles supported), `setRewardPerKwh()`, `setMaxKwhPerProof()`, `pause()/unpause()`.
- **⚠️ Must be approved as a token minter** — see deployment Step 3.5.

### `PowerComputePresale.sol`
- Owner adds one or more phases via `addPhase(priceWeiPerToken, capWei)` while `Configuring`, then calls `startPresale()`.
- Contributors call `contribute()` (or `contributeWithReferral(referrer)` — see Section 4) with ETH attached — automatically splits across phase boundaries if a contribution would overflow the current phase's cap.
- Owner deposits enough $PWR to cover `totalTokensSold` (which includes referral bonuses) via `depositTokensForClaims(amount)`, then calls `finalize()` to lock the raise and open claims.
- Contributors call `claim()`. If cancelled instead (`cancelPresale()`), they call `claimRefund()`.
- Owner sweeps raised ETH via `withdrawRaisedFunds(to)` once finalized.

### `PowerComputeAnnouncements.sol`
- Owner (or an address approved via `setEditor(addr, true)`) calls `publish(title, body, tag, externalUrl)` to post an article. Anyone can read via `getPost(id)` or `getRecentPosts(limit)`.
- `editPost()` updates a post in place; `archivePost()` / `unarchivePost()` hide/restore without deleting history.
- The homepage's **News** section reads directly from this contract — no wallet needed to *view*, only to *publish*.
- For long-form content, keep the on-chain `body` short and put the full article behind the `externalUrl` field (e.g. on IPFS via [Pinata](https://www.pinata.cloud) — the admin Content tab shows a gas-cost warning and this tip once your draft exceeds ~800 characters).

### `PowerComputeVesting.sol`
- Owner calls `createVestingSchedule(beneficiary, totalAmount, startTime, cliffSeconds, durationSeconds, revocable)` — this **pulls `totalAmount` of $PWR from the owner immediately** via `transferFrom` (requires a prior `approve()`), so every schedule is fully funded from creation.
- Vesting is linear from `startTime` over `durationSeconds`; nothing is releasable before `cliffSeconds` has elapsed.
- The beneficiary calls `release()` any time to withdraw whatever has vested but not yet been released.
- Revocable schedules can be cancelled by the owner via `revoke(beneficiary)` — already-vested tokens remain claimable by the beneficiary; the unvested remainder returns to the owner immediately.

### `PowerComputeGovernor.sol`
- Voting power = live `stakedBalanceOf` on `PowerComputeToken` — no separate snapshot/delegation system, so increasing your stake increases your vote weight immediately.
- Anyone with at least `proposalThreshold` staked $PWR can call `propose(title, description)`.
- Anyone with staked $PWR can call `castVote(proposalId, support)` during the voting window (`support`: 0=against, 1=for, 2=abstain), once per proposal.
- A proposal `Succeeds` if total votes cast meet `quorumBps` (default 5% of total staked) **and** "for" votes exceed "against" votes by the time voting closes.
- **This is intentionally advisory** — passing a vote does not automatically execute anything on-chain. The owner calls `markExecuted(proposalId)` to record that the team has acted on it. This keeps the trust model simple: the community signals its will, and execution stays a deliberate, accountable action (potentially through the Timelock below).

### `PowerComputeTimelock.sol`
- A minimal, dependency-free timelock. `admin` (recommended: your multisig) calls `queueTransaction(target, value, data, eta)`, waits until `eta`, then calls `executeTransaction(...)` with identical arguments to actually run it. `cancelTransaction(...)` cancels a queued call before it executes.
- Enforces `MIN_DELAY` (1 hour) through `MAX_DELAY` (30 days) between queuing and the earliest possible execution, plus a 14-day `GRACE_PERIOD` after which a stale queued transaction must be re-queued.
- Two-step admin handover: `setPendingAdmin(newAdmin)` then the new admin calls `acceptAdmin()` themselves — a typo in the address can never brick control of the timelock.
- See Section 7 for how to actually use this to protect the protocol.

---

## 3. Deploy Everything (Remix IDE + Base Sepolia)

1. Open [Remix IDE](https://remix.ethereum.org). Use **"Clone Git Repository"** (or manually recreate the folder structure) to bring in the entire `contracts/` folder, preserving `contracts/common/PowerComputeBase.sol` as a relative import target.
2. **Solidity Compiler** tab → version `0.8.20+` → compile all 8 files. Zero external imports means zero network calls needed to compile.
3. Get free Base Sepolia ETH from the [Coinbase](https://www.coinbase.com/faucets/base-sepolia-faucet) or [Alchemy](https://www.alchemy.com/faucets/base-sepolia) faucet.
4. **Deploy & Run Transactions** tab → Environment: `Injected Provider - MetaMask`. Add/switch MetaMask to **Base Sepolia** (RPC `https://sepolia.base.org`, Chain ID `84532`, Explorer `https://sepolia.basescan.org`).

   **Deploy in this order:**

   | # | Contract | Constructor args |
   |---|---|---|
   | a | `PowerComputeToken` | `initialSupply` (e.g. `200000000`), `initialRewardRatePerSecond` (e.g. `1000000000000000`) → save as `TOKEN_ADDRESS` |
   | b | `NodeRegistry` | `pwrTokenAddress` (from a), `initialOwner` → save as `NODE_REGISTRY_ADDRESS` |
   | c | `PowerComputePresale` | `pwrTokenAddress` (from a), `fundingGoalWei_` (e.g. `2000000000000000000` = 2 ETH), `initialOwner` → save as `PRESALE_ADDRESS` |
   | d | `PowerComputeAnnouncements` | `initialOwner` → save as `ANNOUNCEMENTS_ADDRESS` |
   | e | `PowerComputeVesting` | `pwrTokenAddress` (from a), `initialOwner` → save as `VESTING_ADDRESS` |
   | f | `PowerComputeGovernor` | `stakeTokenAddress` (from a), `proposalThreshold_` (e.g. `1000000000000000000000` = 1,000 $PWR staked to propose), `initialOwner` → save as `GOVERNOR_ADDRESS` |
   | g | *(optional)* `PowerComputeTimelock` | `admin_` (your multisig, see Section 7), `delaySeconds_` (e.g. `86400` = 24h) → save as `TIMELOCK_ADDRESS` |

5. **Critical wiring step** — on the deployed `PowerComputeToken`, call:
   ```
   setMinter(<NODE_REGISTRY_ADDRESS>, true)
   ```
   Without this, `NodeRegistry.approveEnergyProof()` and `batchApproveEnergyProofs()` will revert.
6. *(Optional)* Fund the staking rewards pool: `fundRewardsPool(amount)` on the token.
7. *(Optional)* Configure the presale: `addPhase(priceWeiPerToken, capWei)` one or more times, then `startPresale()`.
8. *(Optional)* Publish your first article via `PowerComputeAnnouncements.publish(...)`.
9. *(Optional)* Create your first vesting schedule: `approve()` the Vesting contract on the token for the allocation amount, then call `PowerComputeVesting.createVestingSchedule(...)`.
10. *(Optional, recommended before real funds)* Set up the Timelock — see Section 7.

---

## 4. Referral Program (Presale)

Built into `PowerComputePresale.sol`, zero extra deployment needed:

- A visitor shares a link like `https://yoursite.com/?ref=0xTheirAddress`.
- `index.html` reads the `?ref=` query param, validates it, and stores it for the session.
- The **first** time the referee contributes, the frontend calls `contributeWithReferral(referrer)` instead of `contribute()`, permanently linking the referrer on-chain. Every contribution after that — even via the plain `contribute()` button — still applies the bonus.
- Each contribution mints bonus $PWR (on top of the normal allocation): **3%** to the referee (`refereeBonusBps`), **5%** to the referrer (`referrerBonusBps`), both owner-adjustable (capped at 20% each) via `setReferralBps()` in the admin Settings tab.
- Referral bonuses count toward `totalTokensSold`, so remember to fund enough via `depositTokensForClaims` to cover them.
- Node operators and stakers get their personal referral link and live stats (referral count, volume, bonus earned) on `dashboard.html`. Public rankings are on `leaderboard.html`.

---

## 5. Governance (Public Voting)

`governance.html` is a public page (no admin access needed to view or vote):
- Shows your voting power (currently staked $PWR) and the network's total voting power.
- Lists all proposals with live vote tallies and a color-coded status pill (Pending/Active/Defeated/Succeeded/Executed).
- "Vote For / Against / Abstain" buttons appear only on `Active` proposals, only for connected wallets with staked $PWR.
- Proposal creation currently happens from the admin console's Governance tab (team-managed for now — see the contract's advisory-execution design note in Section 2).

---

## 6. Frontend Pages — and the Admin Access Model

| Page | Audience | Purpose |
|---|---|---|
| [`index.html`](./index.html) | Public / investors | Hero, live protocol metrics, presale contribution + referrals + claim, GPU yield calculator, live energy chart, staking portal, on-chain News, roadmap, tokenomics. |
| [`dashboard.html`](./dashboard.html) | Node operators | Register GPU nodes, submit PoEC reports, referral link + stats, vesting schedule viewer, browser notification alerts for proof approval/rejection. |
| [`governance.html`](./governance.html) | Public / $PWR stakers | View and vote on proposals. |
| [`leaderboard.html`](./leaderboard.html) | Public | Top node operators (by energy routed), top stakers, top referrers. |
| [`admin.html`](./admin.html) | **Contract owner only** | Everything: Overview, bulk-approve Review Queue, Trends charts, Protocol Controls, Governance proposal creation, Vesting schedule creation, Timelock queue/execute, Content publishing, Settings (ownership transfer/renounce, recovery), Activity Log. |

**⚠️ Admin access model (read this before deploying):** `admin.html` is not
linked from the main public navigation, and — more importantly — the page
itself renders **nothing but an access-gate card** until a connected wallet
is verified, via a fresh **on-chain** read of `PowerComputeToken.owner()`
(never cached client state), to actually be the owner. Non-owner and
disconnected visitors see "Access Denied" and nothing else — no stats, no
queues, no controls exist in the DOM until that check passes.

The public pages gracefully fall back to simulated demo data (clearly
labeled) wherever a contract isn't configured yet. `admin.html` never does
this for its controls — if a contract isn't configured, it says so and
disables the relevant action.

---

## 7. Security Hardening (Strongly Recommended Before Real Funds)

This project ships as a set of unaudited testnet contracts controlled by a
single owner key by default. Before putting any real value behind it:

1. **Get a multisig.** Deploy a [Gnosis Safe](https://app.safe.global) (2-of-3
   or 3-of-5 signers). This alone is the single highest-leverage security
   improvement available.
2. **Deploy the Timelock** with your Safe as `admin_` and a delay of at
   least 24h (recommend 48h): see Step 4g in Section 3.
3. **Transfer ownership** of `PowerComputeToken`, `NodeRegistry`,
   `PowerComputePresale`, `PowerComputeAnnouncements`, `PowerComputeVesting`,
   and `PowerComputeGovernor` to the Timelock address, via the admin
   Settings tab's "Transfer Ownership" control (one contract at a time).
4. From then on, every sensitive call (`mint`, `withdrawRaisedFunds`,
   `setRewardRatePerSecond`, etc.) must be **queued** in the admin Timelock
   tab, wait out the public delay, and then be **executed** — giving your
   community visibility and a chance to react before anything privileged
   takes effect.
5. **Get a real audit** before mainnet — even a budget option (a solo
   auditor or a Code4rena-style contest) beats none. See Section 8 for the
   test suite that should be the starting point for any auditor.

---

## 8. Testing

A Hardhat/Mocha/Chai test suite lives in [`test/`](./test), covering:

- **`PowerComputeToken.test.js`** — deployment invariants, staking reward-accrual math over time, unstake cooldown enforcement, minter allowlist (mint/revoke), `MAX_SUPPLY` guard, pause/access control.
- **`PowerComputePresale.test.js`** — phase configuration guards, **exact token-allocation math across a multi-phase contribution split**, referral linking + self-referral rejection + exact 3%/5% bonus math + bonus persistence on later plain `contribute()` calls, claim/double-claim-revert, cancel + refund with gas-accounted balance verification.
- **`NodeRegistry.test.js`** — node lifecycle, PoEC reward math (`kWhRouted * rewardPerKwh`), and the **batch functions**: correct per-item reward minting, silently skipping already-resolved/nonexistent entries instead of reverting the whole batch, access control.

**⚠️ Note on this repo's dev environment:** the dApp itself needs zero
build tooling (static HTML + CDN scripts). The test suite is the one part
of this repo that needs Node.js tooling to actually *run* — set it up with:

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat test
```

This compiles the contracts in `contracts/` (no changes needed) and runs
the full suite against an in-memory Hardhat network. Use this as your
starting point for CI and for anything an auditor asks for.

---

## 9. Wallet Connection (Injected + WalletConnect)

`assets/js/wallet.js` supports two connection paths:

- **Injected wallets** (MetaMask, Coinbase Wallet, Rabby, etc.) — works out
  of the box, no configuration needed.
- **WalletConnect v2** (for mobile wallet users) — get a free Project ID at
  [cloud.reown.com](https://cloud.reown.com) and paste it into
  `WALLETCONNECT_PROJECT_ID` in `assets/js/config.js`. The WalletConnect
  library itself is loaded on-demand via a dynamic ESM import from
  [esm.sh](https://esm.sh) — there's no pre-bundled CDN `<script>` tag for
  modern WalletConnect v2 (older CDN tutorials you may find online are for
  WalletConnect v1, whose relay protocol was shut down in June 2023 and no
  longer works), so this repo dynamically imports and bundles it in the
  browser at connect-time instead. Until you set a Project ID, the
  WalletConnect button shows a helpful toast instead of failing silently.

---

## 10. Wire the Frontend (1 file to edit)

Open [`assets/js/config.js`](./assets/js/config.js) and paste your deployed addresses:

```js
const POWERCOMPUTE_CONFIG = {
  TOKEN_ADDRESS: "0xYourTokenAddress",
  NODE_REGISTRY_ADDRESS: "0xYourNodeRegistryAddress",
  PRESALE_ADDRESS: "0xYourPresaleAddress",
  ANNOUNCEMENTS_ADDRESS: "0xYourAnnouncementsAddress",
  TIMELOCK_ADDRESS: "0xYourTimelockAddress",       // optional
  VESTING_ADDRESS: "0xYourVestingAddress",         // optional
  GOVERNOR_ADDRESS: "0xYourGovernorAddress",       // optional
  WALLETCONNECT_PROJECT_ID: "your-project-id",     // optional, see Section 9
  // ...chain config below stays as-is for Base Sepolia
};
```

That's it — every HTML page reads from this one file. No build step, no
bundler, no `npm install` required for the dApp itself (only for `/test`,
see Section 8).

---

## 11. Deploy the Frontend to Vercel for Free

**Option A — Vercel Web UI**
1. Push this repo (with your updated `config.js`) to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Framework Preset: **Other**. Leave Build Command / Output Directory blank.
4. Deploy. You'll get a live URL with all pages working (`/`, `/dashboard.html`, `/governance.html`, `/leaderboard.html`, `/admin.html`).

**Option B — Vercel CLI**
```bash
npm i -g vercel
vercel --prod
```

---

## 12. Post-Deploy Checklist

- [ ] All configured addresses in `assets/js/config.js` match your deployed contracts on Base Sepolia.
- [ ] `PowerComputeToken.setMinter(NodeRegistry, true)` was called.
- [ ] Staking rewards pool funded via `fundRewardsPool()`.
- [ ] At least one presale phase added + `startPresale()` called.
- [ ] Your wallet is on **Base Sepolia** before testing any button.
- [ ] `admin.html` shows the full console for the owner wallet and "Access Denied" for any other wallet.
- [ ] Published at least one article so the homepage News section shows real content.
- [ ] *(If hardening for production)* Ownership of all contracts transferred to a Timelock controlled by a multisig — see Section 7.
- [ ] Updated social links, GitHub link, and docs link in `index.html`'s footer.
- [ ] *(Optional)* Verified contract source on [BaseScan Sepolia](https://sepolia.basescan.org).

## Local Preview

No build tools required for the dApp itself.

```bash
python3 -m http.server 8080
# visit http://localhost:8080, /dashboard.html, /governance.html, /leaderboard.html, /admin.html
```

## ⚠️ Disclaimer

This is testnet software for demonstration purposes. Testnet $PWR and ETH
hold no monetary value. None of the contracts in `contracts/` have been
professionally audited — do not deploy to mainnet or use with real funds
without a full third-party security audit and the hardening steps in
Section 7. Governance is advisory only and does not automatically execute
on-chain actions. $PWR is a utility/governance token; nothing in this repo
constitutes financial or investment advice.
