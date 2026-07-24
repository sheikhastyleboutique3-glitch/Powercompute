# PowerCompute ($PWR)

**Decentralized Energy-to-Compute Orchestration Protocol.**

PowerCompute routes stranded/curtailed renewable grid energy into verified,
on-demand GPU compute for AI workloads — rewarding node operators and stakers
in **$PWR**. This repo is a complete, $0-budget dApp: **8 interlinked smart
contracts**, a public landing page, a node-operator dashboard, a public
governance page, a leaderboard, and a hardened, owner-only admin console —
all deployable for free, no backend, no database, no build step.

**Table of contents**

1. [Design System](#1-design-system)
2. [Project Structure](#2-project-structure)
3. [Smart Contract Reference](#3-smart-contract-reference)
4. [Deploy the Contracts (Testnet, Remix + Base Sepolia)](#4-deploy-the-contracts-testnet-remix--base-sepolia)
5. [Presale Phases — How to Configure and Enable Them](#5-presale-phases--how-to-configure-and-enable-them)
6. [Referral Program](#6-referral-program)
7. [Governance (Public Voting)](#7-governance-public-voting)
8. [Frontend Pages — and the Admin Access Model](#8-frontend-pages--and-the-admin-access-model)
9. [Wallet Connection UX](#9-wallet-connection-ux)
10. [Wire the Frontend (1 file to edit)](#10-wire-the-frontend-1-file-to-edit)
11. [Going Live — Full Production Launch Checklist](#11-going-live--full-production-launch-checklist)
12. [Security Hardening (Strongly Recommended Before Real Funds)](#12-security-hardening-strongly-recommended-before-real-funds)
13. [Testing](#13-testing)
14. [Post-Deploy Checklist](#14-post-deploy-checklist)
15. [Audit Findings & Fixes](#15-audit-findings--fixes)
16. [Disclaimer](#16-disclaimer)

---

## 1. Design System

The entire frontend shares one visual language across all 5 pages, defined
in [`assets/css/style.css`](./assets/css/style.css) plus an inline Tailwind
config block repeated at the top of each HTML file (kept inline, not
extracted to a shared JS file, so every page still works if opened
directly from disk with zero build step).

**Theme: "Cyberpunk DePIN" — dark, glassy, energy-grid inspired.**

| Token | Value | Used for |
|---|---|---|
| `charcoal` | `#090D16` | Page background |
| `panel` | `#0E1526` | Card/panel background base |
| Emerald | `#10B981` (Tailwind `emerald-500`) | Primary accent — energy/growth |
| Cyan | `#06B6D4` (Tailwind `cyan-500`) | Secondary accent — compute/tech |
| Font (headings/body) | `Space Grotesk` | Loaded via Google Fonts |
| Font (numbers/addresses/code) | `JetBrains Mono` (`.mono` utility class) | Balances, addresses, tx hashes |

**Signature visual elements:**
- **`.glass` / `.glass-border-glow`** — the core card style: translucent
  background blur (`backdrop-filter: blur(18px)`) with a subtle animated
  gradient border. Every card, modal, and panel on every page uses this.
- **`.text-gradient`** — animated emerald→cyan gradient text for headings
  and key numbers (`background-clip: text`).
- **Animated grid background** (`.bg-grid` + `animate-grid-move`) — a faint
  moving grid pattern behind every page, reinforcing the "energy grid"
  theme without being distracting.
- **`.pill` variants** (`pill-emerald`, `pill-cyan`, `pill-amber`,
  `pill-red`, `pill-slate`) — consistent status badges used everywhere:
  node status (Pending/Active/Suspended/Retired), presale state, proposal
  state, proof approval status.
- **`.skeleton`** — shimmer loading placeholder shown while a page is
  waiting on an RPC call, so nothing ever looks broken/blank while data
  loads.
- **Glow shadows** (`shadow-glow-emerald`, `shadow-glow-cyan`) — used
  sparingly on primary CTAs (Connect Wallet, Stake, Contribute) to draw
  the eye to the one action that matters most on each screen.

**Responsive behavior:** mobile-first. The desktop nav collapses into a
slide-down mobile menu below the `md:` breakpoint; the wallet connect
picker/account menu (see Section 9) renders as a bottom sheet on small
screens and a centered modal on larger ones, using the same component.

**Icons:** [Lucide](https://lucide.dev) via CDN (`data-lucide="..."`
attributes, rendered by `lucide.createIcons()` — call `pcRenderIcons()`
from `wallet.js` after injecting any new HTML that contains icon
attributes, or they won't render).

**Charts:** [Chart.js](https://www.chartjs.org) via CDN — used for the
homepage's live energy/compute line chart and the admin Trends tab's four
bar charts.

If you want to re-skin this (different brand colors, different font),
change the Tailwind `colors`/`fontFamily` block at the top of each HTML
file **and** the CSS variables at the top of `assets/css/style.css` — both
need to match since Tailwind utility classes and the shared stylesheet
work together.

---

## 2. Project Structure

```
Powercompute/
├── contracts/
│   ├── common/
│   │   └── PowerComputeBase.sol      # Shared IERC20, Ownable (2-step), Pausable, ReentrancyGuard, ERC20 base
│   ├── PowerComputeToken.sol         # $PWR ERC-20 + staking + checkpointed voting power + protocol emissions
│   ├── NodeRegistry.sol              # GPU node registry + PoEC rewards + batch admin actions
│   ├── PowerComputePresale.sol       # Phased ETH presale + referral program + claim/refund flow
│   ├── PowerComputeAnnouncements.sol # On-chain CMS for articles/announcements (no server/database needed)
│   ├── PowerComputeVesting.sol       # Linear vesting w/ cliff for team/advisor $PWR allocations
│   ├── PowerComputeGovernor.sol      # Snapshot-based, stake-weighted advisory governance
│   └── PowerComputeTimelock.sol      # Optional timelock controller for delayed, transparent admin actions
├── assets/
│   ├── css/style.css                 # Shared design system — see Section 1
│   └── js/
│       ├── config.js                 # ⚠️ EDIT THIS: contract addresses + ABIs (single source of truth)
│       └── wallet.js                 # Wallet connection (injected + WalletConnect), persistence, account menu
├── index.html                        # Public landing page (hero, presale+referrals, calculator, chart, staking, news)
├── dashboard.html                    # Node operator portal (register nodes, referral link, vesting, alerts)
├── governance.html                   # Public stake-weighted voting page
├── leaderboard.html                  # Public rankings: top node operators / stakers / referrers
├── admin.html                        # Owner-only admin console — see Section 8 for the access model
├── test/                             # Hardhat test suite (see Section 13 — Testing)
├── hardhat.config.js                 # Hardhat config, only needed to run /test locally
├── package.json                      # devDependencies for running /test locally
├── robots.txt / sitemap.xml          # Basic SEO — admin.html intentionally excluded from both
└── README.md                         # You are here
```

**Why 8 contracts instead of 1?** Splitting concerns keeps each contract
small, auditable, and independently upgradable — a bug in one (e.g. the
presale) can never touch the integrity of another (e.g. the token supply).
See Section 3 for what each one does.

All contracts import shared primitives from
[`contracts/common/PowerComputeBase.sol`](./contracts/common/PowerComputeBase.sol)
— there are **zero external npm/OpenZeppelin dependencies** anywhere in
`contracts/`, so everything compiles in Remix with no import resolution or
network access required.

---

## 3. Smart Contract Reference

### `PowerComputeToken.sol` ($PWR)
- Standard ERC-20, 18 decimals, hard-capped at **1,000,000,000 $PWR**.
- Built-in staking: `stake(amount)`, `unstake(amount)`, `claimRewards()` — rewards accrue continuously via a MasterChef-style accumulator, funded by `fundRewardsPool(amount)`.
- **Checkpointed stake history**: every `stake`/`unstake` records a block-indexed checkpoint (`getPastStakedBalance`, `getPastTotalStaked`), used by `PowerComputeGovernor` for snapshot-based voting power.
- Protocol emissions: `mintReward(to, amount)` — callable only by addresses on the `minters` allowlist (set via `setMinter(addr, true)`). This is how `NodeRegistry` pays PoEC rewards without needing custody of tokens.
- Admin: `mint()` (grants/liquidity, capped), `setRewardRatePerSecond()`, `setUnstakeCooldown()` (capped at `MAX_UNSTAKE_COOLDOWN` = 30 days), `pause()/unpause()`, `recoverForeignToken()`.
- Ownership: two-step (`transferOwnership` → `acceptOwnership`, or `cancelOwnershipTransfer`) — see Section 12.

### `NodeRegistry.sol`
- **Node lifecycle:** `registerNode(gpuModel, gpuCount, energySiteId, region)` → `Pending` → `verifyNode()` (oracle/owner) → `Active` → optionally `suspendNode()` / `reinstateNode()` → `retireNode()` (operator or oracle/owner, permanent).
- **PoEC reward pipeline:** operator calls `submitEnergyProof(nodeId, kWhRouted, periodStart, periodEnd)`, which **locks in the current `rewardPerKwh` on the proof itself** (`rewardPerKwhAtSubmission`) so a later rate change can never affect an already-submitted proof's payout. Oracle/owner then calls `approveEnergyProof(proofId)` (mints `kWhRouted * rewardPerKwhAtSubmission` in $PWR to the operator) or `rejectEnergyProof(proofId, reason)`.
- **Batch admin:** `batchVerifyNodes(nodeIds[])` and `batchApproveEnergyProofs(proofIds[])` process up to `MAX_BATCH_SIZE` (100) items in one transaction, silently skipping entries that are already resolved/invalid rather than reverting the whole batch.
- **Admin:** `setOracle(addr, allowed)` (multiple oracles supported), `setRewardPerKwh()`, `setMaxKwhPerProof()`, `pause()/unpause()`.
- **⚠️ Must be approved as a token minter** — see Section 4, Step 5.

### `PowerComputePresale.sol`
- Full walkthrough with real numbers in **Section 5** below.
- Owner adds phases via `addPhase(priceWeiPerToken, capWei)` while `Configuring`, then calls `startPresale()`.
- Contributors call `contribute()` (or `contributeWithReferral(referrer)`) with ETH attached — automatically splits across phase boundaries if a contribution would overflow the current phase's cap.
- Owner deposits enough $PWR to cover `totalTokensSold` via `depositTokensForClaims(amount)`, then calls `finalize()` to lock the raise and open claims.
- Contributors call `claim()`. If cancelled instead (`cancelPresale()`), they call `claimRefund()`, and the owner can recover deposited $PWR via `recoverDepositedTokensAfterCancel()`.
- Owner sweeps raised ETH via `withdrawRaisedFunds(to)` once finalized. `recoverUnclaimedTokens(to, amount)` is strictly capped to `tokensDepositedForClaims - totalTokensSold` — genuine surplus/dust only, never anything still owed to a contributor.
- `setReferralBlocked(referrer, bool)` lets the owner cut off a specific address's future referral bonuses if Sybil abuse is detected.

### `PowerComputeAnnouncements.sol`
- Owner (or an address approved via `setEditor(addr, true)`) calls `publish(title, body, tag, externalUrl)` to post an article. Anyone can read via `getPost(id)` or `getRecentPosts(limit)`.
- `editPost()` updates a post in place; `archivePost()` / `unarchivePost()` hide/restore without deleting history.
- The homepage's **News** section reads directly from this contract — no wallet needed to *view*, only to *publish*.
- For long-form content, keep the on-chain `body` short and put the full article behind the `externalUrl` field (e.g. on IPFS via [Pinata](https://www.pinata.cloud)) — the admin Content tab shows a gas-cost warning and this tip once your draft exceeds ~800 characters.

### `PowerComputeVesting.sol`
- Owner calls `createVestingSchedule(beneficiary, totalAmount, startTime, cliffSeconds, durationSeconds, revocable)` — this **pulls `totalAmount` of $PWR from the owner immediately** via `transferFrom` (requires a prior `approve()`), so every schedule is fully funded from creation.
- Vesting is linear from `startTime` over `durationSeconds`; nothing is releasable before `cliffSeconds` has elapsed.
- The beneficiary calls `release()` any time to withdraw whatever has vested but not yet been released.
- Revocable schedules can be cancelled by the owner via `revoke(beneficiary)` — already-vested tokens remain claimable by the beneficiary; the unvested remainder returns to the owner immediately.

### `PowerComputeGovernor.sol`
- Voting power = your **checkpointed** `stakedBalanceOf` on `PowerComputeToken`, snapshotted at the block a proposal was created — not a live balance. Staking or unstaking after a proposal exists has zero effect on that proposal's outcome (this is a flash-loan/flash-stake defense).
- Anyone with at least `proposalThreshold` staked $PWR can call `propose(title, description)`.
- Anyone who had staked $PWR **as of the proposal's snapshot block** can call `castVote(proposalId, support)` during the voting window (`support`: 0=against, 1=for, 2=abstain), once per proposal.
- A proposal `Succeeds` if total votes cast meet `quorumBps` (default 5% of total staked **at the snapshot block**) **and** "for" votes exceed "against" votes by the time voting closes.
- **This is intentionally advisory** — passing a vote does not automatically execute anything on-chain. The owner calls `markExecuted(proposalId)` to record that the team has acted on it.

### `PowerComputeTimelock.sol`
- A minimal, dependency-free timelock. `admin` (recommended: your multisig) calls `queueTransaction(target, value, data, eta)`, waits until `eta`, then calls `executeTransaction(...)` with identical arguments to actually run it. `cancelTransaction(...)` cancels a queued call before it executes.
- Enforces `MIN_DELAY` (1 hour) through `MAX_DELAY` (30 days) between queuing and the earliest possible execution, plus a 14-day `GRACE_PERIOD` after which a stale queued transaction must be re-queued.
- Two-step admin handover: `setPendingAdmin(newAdmin)` then the new admin calls `acceptAdmin()` themselves.
- See Section 12 for how to actually use this to protect the protocol.

---

## 4. Deploy the Contracts (Testnet, Remix + Base Sepolia)

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
   | g | *(optional)* `PowerComputeTimelock` | `admin_` (your multisig, see Section 12), `delaySeconds_` (e.g. `86400` = 24h) → save as `TIMELOCK_ADDRESS` |

5. **Critical wiring step** — on the deployed `PowerComputeToken`, call:
   ```
   setMinter(<NODE_REGISTRY_ADDRESS>, true)
   ```
   Without this, `NodeRegistry.approveEnergyProof()` and `batchApproveEnergyProofs()` will revert.
6. *(Optional)* Fund the staking rewards pool: `fundRewardsPool(amount)` on the token.
7. **Configure and enable the presale** — see Section 5 for the full walkthrough.
8. *(Optional)* Publish your first article via `PowerComputeAnnouncements.publish(...)`.
9. *(Optional)* Create your first vesting schedule: `approve()` the Vesting contract on the token for the allocation amount, then call `PowerComputeVesting.createVestingSchedule(...)`.
10. *(Optional, recommended before real funds)* Set up the Timelock — see Section 12.

---

## 5. Presale Phases — How to Configure and Enable Them

The presale is a **phase-based** raise: you define one or more price/cap
tiers ahead of time, then contributions automatically move through them in
order as each fills up. Here's exactly how to set it up, with real numbers.

### Step 1 — Understand the two numbers a phase needs

Each phase (`addPhase(priceWeiPerToken, capWei)`) takes:

- **`priceWeiPerToken`** — how many **wei of ETH** buys **1 whole $PWR**
  (18 decimals). Example: if you want $PWR to cost 0.0001 ETH each,
  `priceWeiPerToken = 100000000000000` (that's `0.0001 * 1e18`).
- **`capWei`** — the maximum **wei of ETH** this phase will accept before
  moving to the next phase. Example: a 50 ETH cap is
  `capWei = 50000000000000000000` (that's `50 * 1e18`).

**Tip:** use [eth-converter.com](https://eth-converter.com) or your
wallet's own unit converter to turn ETH amounts into wei — don't hand-type
18 zeros, it's the easiest place to make a mistake.

### Step 2 — Add your phases (while `Configuring`)

You can add as many phases as you want — a classic setup is 3-4 phases
with rising price:

| Phase | Price (ETH per $PWR) | `priceWeiPerToken` | Cap (ETH) | `capWei` |
|---|---|---|---|---|
| 0 — Seed | 0.010 | `10000000000000000` | 20 | `20000000000000000000` |
| 1 — Early | 0.014 | `14000000000000000` | 30 | `30000000000000000000` |
| 2 — Public | 0.018 | `18000000000000000` | 50 | `50000000000000000000` |

In Remix (or via the admin console's **Protocol Controls → Presale**
card), call `addPhase(...)` once per row, **in order** — phase 0 must be
added first, since contributions always fill the lowest-index open phase
first.

### Step 3 — Enable/start the presale

Once every phase is added, call:
```
startPresale()
```
This flips the presale's `state` from `Configuring` to `Active` — **this
is what "enables" the presale.** Before this call, `contribute()` and
`contributeWithReferral()` both revert with `"Presale: not active"`. You
cannot add more phases after this point (`addPhase` reverts once
`Active`), so double-check your phases before calling `startPresale()`.

### Step 4 — What happens as contributions come in

- A contribution is applied to the **current** phase (`currentPhaseIndex`,
  starts at 0) until that phase's `capWei` is reached.
- If a single contribution would overflow the current phase's remaining
  capacity, the contract **automatically splits it**: the portion that
  fits is charged at the current phase's price, and the remainder rolls
  into the next phase at *that* phase's price — all in one transaction,
  no extra clicks needed from the contributor.
- `currentPhaseIndex` auto-advances once a phase's cap is filled. The
  homepage's milestone tracker and progress bar reflect this live.
- If someone tries to contribute more than every remaining phase can
  absorb combined, the transaction reverts with `"Presale: exceeds
  remaining presale capacity"` rather than silently under-crediting them
  — reduce the contribution amount and try again.

### Step 5 — Fund token claims and finalize

1. Watch `totalTokensSold()` grow as contributions come in (this already
   includes referral bonuses — see Section 6).
2. `approve()` the Presale contract on the token for at least
   `totalTokensSold` worth of $PWR, then call
   `depositTokensForClaims(amount)`.
3. Call `finalize()` — this locks the raise (no more contributions
   accepted) and opens `claim()` for every contributor.
4. Call `withdrawRaisedFunds(to)` to sweep the raised ETH to your treasury.

### Step 6 — If you need to change parameters mid-raise

- `setFundingGoal(newGoalWei)` — only while `Configuring` (affects the
  homepage progress-bar target, separate from the phase caps themselves).
- `setReferralBps(refereeBps, referrerBps)` — adjustable any time, caps at
  20% (2000 bps) each.
- You **cannot** add, remove, or resize phases once `Active` — plan them
  fully before calling `startPresale()`. If you truly need to restart,
  `cancelPresale()` (enables refunds for existing contributors) and deploy
  a fresh presale contract for a new attempt.

### Doing all of this from the Admin Console instead of Remix

Everything above (`addPhase`, `startPresale`, `depositTokensForClaims`,
`finalize`, `setFundingGoal`, `setReferralBps`) has a form in
**`admin.html` → Protocol Controls → Presale card** — you don't need to
go back to Remix after the initial contract deployment. See Section 8 for
how to access the admin console.

---

## 6. Referral Program

Built into `PowerComputePresale.sol`, zero extra deployment needed:

- A visitor shares a link like `https://yoursite.com/?ref=0xTheirAddress`.
- `index.html` reads the `?ref=` query param, validates it, and stores it
  for the session.
- The **first** time the referee contributes, the frontend calls
  `contributeWithReferral(referrer)` instead of `contribute()`,
  permanently linking the referrer on-chain. Every contribution after that
  — even via the plain `contribute()` button — still applies the bonus.
- Each contribution mints bonus $PWR (on top of the normal allocation):
  **3%** to the referee (`refereeBonusBps`), **5%** to the referrer
  (`referrerBonusBps`), both owner-adjustable (capped at 20% each) via
  `setReferralBps()` in the admin Settings tab.
- Referral bonuses count toward `totalTokensSold`, so remember to fund
  enough via `depositTokensForClaims` to cover them (see Section 5, Step
  5).
- Node operators and stakers get their personal referral link and live
  stats (referral count, volume, bonus earned) on `dashboard.html`. Public
  rankings are on `leaderboard.html`.
- `setReferralBlocked(referrer, bool)` lets the owner cut off a specific
  referrer's future bonuses if Sybil abuse (one person controlling both
  wallets) is detected — this can't be fully prevented on-chain, only
  responded to.

---

## 7. Governance (Public Voting)

`governance.html` is a public page (no admin access needed to view or vote):
- Shows your voting power (currently staked $PWR) and the network's total
  voting power.
- Lists all proposals with live vote tallies and a color-coded status pill
  (Pending/Active/Defeated/Succeeded/Executed).
- "Vote For / Against / Abstain" buttons appear only on `Active`
  proposals, only for connected wallets with staked $PWR as of that
  proposal's snapshot block.
- Proposal creation currently happens from the admin console's Governance
  tab (team-managed for now — see the contract's advisory-execution design
  note in Section 3).

---

## 8. Frontend Pages — and the Admin Access Model

| Page | Audience | Purpose |
|---|---|---|
| [`index.html`](./index.html) | Public / investors | Hero, live protocol metrics, presale contribution + referrals + claim, GPU yield calculator, live energy chart, staking portal, on-chain News, roadmap, tokenomics. |
| [`dashboard.html`](./dashboard.html) | Node operators | Register GPU nodes, submit PoEC reports, referral link + stats, vesting schedule viewer, browser notification alerts for proof approval/rejection. |
| [`governance.html`](./governance.html) | Public / $PWR stakers | View and vote on proposals. |
| [`leaderboard.html`](./leaderboard.html) | Public | Top node operators (by energy routed), top stakers, top referrers. |
| [`admin.html`](./admin.html) | **Contract owner only** | Everything: Overview, bulk-approve Review Queue, Trends charts, Protocol Controls (incl. presale phases — Section 5), Governance proposal creation, Vesting schedule creation, Timelock queue/execute, Content publishing, Settings (ownership transfer/renounce, recovery), Activity Log. |

### How to access `admin.html`

1. Navigate directly to `/admin.html` — it is **intentionally not linked**
   from the main public navigation on any other page.
2. Connect your wallet (see Section 9).
3. Access is granted **only** if your connected wallet is the on-chain
   `owner()` of `PowerComputeToken` — checked with a fresh RPC call every
   time, never cached client-side state. Everyone else sees "Access
   Denied" with nothing else in the DOM — no stats, no queues, no
   controls exist for a non-owner wallet at all, not even hidden ones you
   could reveal via dev tools.
4. If you deployed the contracts yourself, connect the **same wallet you
   deployed from** — that wallet is the owner by default, until you
   transfer ownership elsewhere (see Section 12).

The public pages gracefully fall back to simulated demo data (clearly
labeled) wherever a contract isn't configured yet. `admin.html` never does
this for its controls — if a contract isn't configured, it says so and
disables the relevant action.

---

## 9. Wallet Connection UX

`assets/js/wallet.js` handles all wallet connection logic, shared across
every page.

**One button, one picker.** Every page has a single "Connect Wallet"
button. Tapping it while disconnected opens a bottom sheet (mobile) /
centered modal (desktop) with two choices:
- **Browser Extension** — MetaMask, Coinbase Wallet, Rabby, etc. Requires
  `window.ethereum` to exist (i.e. you're either on desktop with an
  extension installed, or inside a wallet app's own in-app browser on
  mobile).
- **WalletConnect** — scan a QR code (or tap to deep-link on mobile) with
  any wallet app. This is the path most Android/iOS users in a regular
  mobile browser (not a wallet's in-app browser) should use. Requires a
  free Project ID — get one at [cloud.reown.com](https://cloud.reown.com)
  and paste it into `WALLETCONNECT_PROJECT_ID` in `assets/js/config.js`.
  Until set, the button shows a helpful toast instead of failing silently.
  (Note: the WalletConnect JS library is loaded on demand via a dynamic
  ESM import from [esm.sh](https://esm.sh) at connect-time — there's no
  pre-bundled CDN `<script>` tag for the current WalletConnect v2
  protocol; older CDN tutorials you may find online are for WalletConnect
  v1, whose relay network was shut down in June 2023.)

**Connection persists across pages.** Since this is a set of static HTML
pages (no SPA router), every navigation is a full page load that would
normally wipe the in-memory connection. `wallet.js` stores *which method*
you used (never any keys) in `localStorage` and silently re-establishes
the same connection on every page load — no re-prompting, no repeated QR
scans, just a brief "reconnecting" moment you likely won't notice.

**Tapping "Connect Wallet" while already connected** opens an account
menu instead of the picker: your full address, a copy-to-clipboard button,
a link to view the address on the block explorer, and a **Disconnect**
button that clears the session (including telling WalletConnect to end
its session) and resets the page.

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
  // ...chain config below — see Section 11 for switching this to mainnet
};
```

That's it — every HTML page reads from this one file. No build step, no
bundler, no `npm install` required for the dApp itself (only for `/test`,
see Section 13).

---

## 11. Going Live — Full Production Launch Checklist

Everything above targets **Base Sepolia testnet** by default. Going live
for real means three separate things: a real chain, a real domain, and a
hardened ownership setup. Do them in this order.

### A. Move to a real chain (Base mainnet, or your chain of choice)

1. Re-deploy all 8 contracts (Section 4) with **MetaMask pointed at Base
   mainnet** instead of Sepolia (Chain ID `8453`, RPC
   `https://mainnet.base.org`, Explorer `https://basescan.org`). You will
   need **real ETH** for gas this time — there is no faucet.
2. Update the network block in `assets/js/config.js`:
   ```js
   CHAIN_ID: 8453,
   CHAIN_ID_HEX: "0x2105",
   CHAIN_PARAMS: {
     chainId: "0x2105",
     chainName: "Base",
     nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
     rpcUrls: ["https://mainnet.base.org"],
     blockExplorerUrls: ["https://basescan.org"]
   }
   ```
   (Consider using a dedicated RPC provider like Alchemy/Infura instead of
   the public `mainnet.base.org` endpoint for production reliability and
   rate limits — swap the URL in `rpcUrls`.)
3. Update all 7 address fields (`TOKEN_ADDRESS`, `NODE_REGISTRY_ADDRESS`,
   etc.) with your new mainnet addresses.
4. **Get the real security audit** referenced throughout this README
   (Section 12, Section 15) before this step touches any real value —
   this is not optional for a genuine production launch.

### B. Get a real domain (instead of the free `*.vercel.app` subdomain)

1. Buy a domain (Namecheap, Cloudflare Registrar, Google Domains, etc.).
2. In your Vercel project → Settings → Domains → add your domain, then
   follow Vercel's DNS instructions (usually a couple of CNAME/A records
   at your registrar).
3. Update every hardcoded URL in the repo to your real domain:
   - `og:url`, `og:image`, `twitter:image`, and `<link rel="canonical">`
     in `index.html`'s `<head>`.
   - `Sitemap:` line in `robots.txt`.
   - Every `<loc>` entry in `sitemap.xml`.
   - Add a real `og-image.png` (1200×630px recommended) referenced by the
     Open Graph tags — currently a placeholder path.
4. Re-deploy to Vercel (`vercel --prod` or push to your connected Git
   branch) once the domain and asset changes are in.

### C. Harden ownership before announcing publicly

Do **all** of Section 12 (multisig + timelock + ownership transfer)
*before* you publicly share the live link or open the presale to real
contributors — not after. A single compromised or lost private key is
catastrophic once real money is involved, and this is the cheapest
possible time to fix that (before anyone has funds at risk).

### D. Final go-live sequence

1. Confirm Section 14's Post-Deploy Checklist passes end-to-end on the
   **production** deployment (not just testnet) — connect with a
   non-owner wallet and confirm `admin.html` correctly denies access,
   confirm staking/presale buttons work, confirm the News section shows
   real published content.
2. Add your first presale phases (Section 5) and call `startPresale()` —
   this is the literal moment the presale becomes live/public.
3. Publish a launch announcement via `PowerComputeAnnouncements` (Section
   3) so it shows up in the homepage News section immediately.
4. Share the real domain. Monitor the admin Activity Log and Trends tab
   closely for the first 24-48 hours.

---

## 12. Security Hardening (Strongly Recommended Before Real Funds)

This project ships as a set of unaudited contracts controlled by a single
owner key by default. Before putting any real value behind it:

1. **Get a multisig.** Deploy a [Gnosis Safe](https://app.safe.global) (2-of-3
   or 3-of-5 signers). This alone is the single highest-leverage security
   improvement available.
2. **Deploy the Timelock** with your Safe as `admin_` and a delay of at
   least 24h (recommend 48h): see Step 4g in Section 4.
3. **Transfer ownership** of `PowerComputeToken`, `NodeRegistry`,
   `PowerComputePresale`, `PowerComputeAnnouncements`, `PowerComputeVesting`,
   and `PowerComputeGovernor` to the Timelock address, via the admin
   Settings tab's ownership controls (one contract at a time). Transfers
   are **two-step**: proposing a new owner via `transferOwnership()`
   changes nothing by itself — the Timelock address must itself call
   `acceptOwnership()` (typically queued through the Timelock's own
   `queueTransaction`/`executeTransaction`) to complete the handover. A
   typo'd address can never accidentally brick a contract.
4. From then on, every sensitive call (`mint`, `withdrawRaisedFunds`,
   `setRewardRatePerSecond`, etc.) must be **queued** in the admin Timelock
   tab, wait out the public delay, and then be **executed** — giving your
   community visibility and a chance to react before anything privileged
   takes effect.
5. **Get a real audit** before mainnet — even a budget option (a solo
   auditor or a Code4rena-style contest) beats none. See Section 13 for
   the test suite that should be the starting point for any auditor, and
   Section 15 for a full internal review this project has already been
   through.

---

## 13. Testing

A Hardhat/Mocha/Chai test suite lives in [`test/`](./test), covering:

- **`PowerComputeToken.test.js`** — deployment invariants, staking reward-accrual math over time, unstake cooldown enforcement, minter allowlist (mint/revoke), `MAX_SUPPLY` guard, pause/access control.
- **`PowerComputePresale.test.js`** — phase configuration guards, **exact token-allocation math across a multi-phase contribution split**, referral linking + self-referral rejection + exact 3%/5% bonus math + bonus persistence on later plain `contribute()` calls, claim/double-claim-revert, cancel + refund with gas-accounted balance verification, plus an audit-regression suite for the `recoverUnclaimedTokens` bound, cancellation recovery, and referral blocking.
- **`NodeRegistry.test.js`** — node lifecycle, PoEC reward math, and the batch functions: correct per-item reward minting, silently skipping already-resolved/nonexistent entries instead of reverting the whole batch, access control, `MAX_BATCH_SIZE` enforcement, plus an audit-regression suite proving rewards use the rate locked at submission time, not a later live rate.
- **`PowerComputeVesting.test.js`** — schedule funding/creation, linear vesting math, revocation semantics, plus an audit-regression suite proving a revoked-but-not-fully-released schedule cannot be overwritten and orphan a beneficiary's tokens.
- **`PowerComputeGovernor.test.js`** — checkpointing on the token, basic propose/vote flow, plus an audit-regression suite proving stake placed after a proposal is created carries zero voting weight on it, and that quorum is computed against the same historical snapshot as the votes ("flash-stake" immunity).

**⚠️ Note on this repo's dev environment:** the dApp itself needs zero
build tooling (static HTML + CDN scripts). The test suite is the one part
of this repo that needs Node.js tooling to actually *run*:

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat test
```

This compiles the contracts in `contracts/` (no changes needed) and runs
the full suite against an in-memory Hardhat network. Use this as your
starting point for CI and for anything an auditor asks for.

---

## 14. Post-Deploy Checklist

- [ ] All configured addresses in `assets/js/config.js` match your deployed contracts.
- [ ] `PowerComputeToken.setMinter(NodeRegistry, true)` was called.
- [ ] Staking rewards pool funded via `fundRewardsPool()`.
- [ ] Presale phases added and `startPresale()` called (Section 5).
- [ ] Your wallet is on the correct network (Base Sepolia for testing, Base mainnet for production — Section 11) before testing any button.
- [ ] `admin.html` shows the full console for the owner wallet and "Access Denied" for any other wallet.
- [ ] Published at least one article so the homepage News section shows real content.
- [ ] Connecting via both "Browser Extension" and "WalletConnect" works, and navigating between pages keeps the same wallet connected without re-prompting.
- [ ] *(If hardening for production)* Ownership of all contracts transferred to a Timelock controlled by a multisig — see Section 12.
- [ ] *(If going live for real)* Domain, OG images, sitemap URLs updated to your real domain — see Section 11.
- [ ] *(Optional)* Verified contract source on the relevant block explorer.

---

## 15. Audit Findings & Fixes

This section documents a manual security review performed on this
codebase by its own author (i.e. **self-review, not an independent
third-party audit** — see the disclaimer below). 12 findings were
identified; 10 were fixed directly in the code (with regression tests
added in `test/`), 1 was mitigated with an on-chain circuit breaker since
it cannot be fully solved without off-chain identity checks, and 1 is a
process/deployment recommendation rather than a code bug.

| # | Severity | Contract | Finding | Status |
|---|---|---|---|---|
| 1 | 🔴 Critical | Presale | `recoverUnclaimedTokens()` had no bound — owner could drain all contributor allocations immediately after `finalize()`, before anyone claimed | ✅ **Fixed** — strictly capped to `tokensDepositedForClaims - totalTokensSold` (genuine surplus only) |
| 2 | 🟠 High | All | Single-owner-key centralization: no timelock is active by default | ⚠️ **Process recommendation, not a code bug** — `PowerComputeTimelock.sol` exists; you must deploy it and transfer ownership yourself (Section 12) |
| 3 | 🟠 High | Vesting | A revoked-but-not-fully-released schedule could be overwritten by a new one, orphaning the beneficiary's already-vested tokens | ✅ **Fixed** — `createVestingSchedule` now requires `released >= totalAmount` unconditionally, regardless of revocation status |
| 4 | 🟠 High | Governor | No snapshotted voting power — "flash-stake" voting manipulation was possible | ✅ **Fixed** — `PowerComputeToken` now checkpoints stake history; the Governor snapshots a `snapshotBlock` at proposal creation and reads historical balances for every vote and for quorum |
| 5 | 🟡 Medium | NodeRegistry | `rewardPerKwh` was applied at approval time, not submission time — timing-dependent payout manipulation | ✅ **Fixed** — the rate is locked into the proof itself (`rewardPerKwhAtSubmission`) at `submitEnergyProof()` time |
| 6 | 🟡 Medium | Presale | Referral program has unbounded Sybil-abuse exposure (one person controlling both referrer/referee wallets) | ⚠️ **Mitigated, not eliminated** — `setReferralBlocked()` lets the owner cut off a specific referrer's future bonuses on detection; this is inherent to any on-chain referral system without off-chain KYC |
| 7 | 🟡 Medium | Token | `unstakeCooldown` had no max bound and applied retroactively — owner could freeze all stakers' exits indefinitely | ✅ **Fixed** — hard-capped at `MAX_UNSTAKE_COOLDOWN` (30 days) |
| 8 | 🟡 Medium | Presale | Deposited claim tokens became permanently stuck if the presale was cancelled after funding | ✅ **Fixed** — new `recoverDepositedTokensAfterCancel()`, usable only in the `Cancelled` state |
| 9 | 🟢 Low | Token | `recoverForeignToken` didn't check the ERC-20 `transfer()` return value | ✅ **Fixed** — now reverts with `require(ok, ...)` if the transfer reports failure |
| 10 | 🟢 Low | NodeRegistry | Batch functions had no array-length cap (self-inflicted gas griefing only) | ✅ **Fixed** — `MAX_BATCH_SIZE` (100) enforced on both batch functions |
| 11 | ℹ️ Informational | All (base) | `transferOwnership` was single-step — a typo'd address could permanently brick a contract | ✅ **Fixed** — two-step transfer (`transferOwnership` → `acceptOwnership`) across every contract, plus `cancelOwnershipTransfer()` |
| 12 | ℹ️ Informational | NodeRegistry | PoEC energy data has zero on-chain verification — it's a pure oracle-trust system by design | ⚠️ **Acknowledged design tradeoff, not a bug** — inherent to bridging real-world energy data on-chain without a hardware attestation network; mitigate via multiple independent oracles (`setOracle`) and off-chain meter cross-checks before approval |

**How to verify these fixes yourself:** every fix marked ✅ has a
corresponding regression test in `test/` (see Section 13) that fails
against the pre-fix behavior and passes against the current code. Run
`npx hardhat test` and read the `describe("Audit fix: ...")` blocks in
each file for the exact before/after behavior being pinned down.

**Honesty about limitations of this review:** this was a manual,
single-pass reading of the code by the same author who wrote it — not
independent, not backed by fuzzing/formal verification tools, and not
performed by a licensed security firm with liability. Treat every finding
above as real and fixed, but do not treat the absence of further findings
as proof the code is safe. Get an actual third-party audit before any
mainnet deployment with real funds (Section 12, step 5).

---

## Local Preview

No build tools required for the dApp itself.

```bash
python3 -m http.server 8080
# visit http://localhost:8080, /dashboard.html, /governance.html, /leaderboard.html, /admin.html
```

## 16. Disclaimer

This is testnet software for demonstration purposes by default. Testnet
$PWR and ETH hold no monetary value. None of the contracts in `contracts/`
have been professionally audited — do not deploy to mainnet or use with
real funds without a full third-party security audit and the hardening
steps in Section 12. Governance is advisory only and does not
automatically execute on-chain actions. $PWR is a utility/governance
token; nothing in this repo constitutes financial or investment advice.
