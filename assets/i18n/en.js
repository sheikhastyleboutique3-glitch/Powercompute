/**
 * PowerCompute — English translation dictionary.
 *
 * Shipped as a plain JS object (not a .json file fetched via XHR) so the
 * whole site keeps working with zero build step and zero risk of MIME-type/
 * CORS issues when opened directly from disk or from any static host —
 * consistent with the rest of this project's "just static files" approach.
 *
 * Keys are dot-path strings resolved by assets/js/i18n.js, e.g.
 * "nav.protocol" or "index.hero.title1". Every page's inline script uses
 * only the branches it needs; unused branches for other pages are ignored
 * (kept in one file so translators only edit ONE place per language).
 */
window.PC_I18N_EN = {
  meta: {
    dir: "ltr",
    langLabel: "EN",
    fontFamily: "'Space Grotesk', ui-sans-serif, system-ui"
  },

  common: {
    connectWallet: "Connect Wallet",
    language: "Language",
    nav: {
      protocol: "Protocol",
      yieldCalculator: "Yield Calculator",
      liveGrid: "Live Grid",
      staking: "Staking",
      roadmap: "Roadmap",
      news: "News",
      nodeDashboard: "Node Dashboard",
      leaderboard: "Leaderboard",
      governance: "Governance",
      home: "Home",
      adminConsole: "Owner Console",
      restrictedConsole: "Restricted Console"
    },
    footer: {
      rights: "© 2026 PowerCompute Protocol. All rights reserved.",
      testnetNotice: "$PWR is deployed on a public testnet for demonstration purposes. Testnet tokens hold no monetary value. Always verify contract addresses independently before interacting.",
      testnetShort: "Testnet software — not for production funds.",
      ecosystem: "Ecosystem",
      resources: "Resources",
      community: "Community",
      github: "GitHub",
      documentation: "Documentation",
      explorer: "BaseScan Explorer",
      twitter: "X / Twitter",
      discord: "Discord",
      telegram: "Telegram"
    },
    wallet: {
      connectTitle: "Connect a Wallet",
      injectedTitle: "Browser Extension",
      injectedSubtitle: "MetaMask, Coinbase Wallet, Rabby, etc.",
      walletConnectTitle: "WalletConnect",
      walletConnectSubtitle: "Scan a QR code with any mobile wallet app",
      pickerFooterNote: "On mobile without a wallet browser extension, choose WalletConnect.",
      accountTitle: "Wallet",
      connectedAddress: "Connected address",
      copy: "Copy",
      explorer: "Explorer",
      disconnect: "Disconnect",
      addressCopied: "Address copied to clipboard!",
      copyFailed: "Could not copy automatically — address shown above.",
      disconnected: "Wallet disconnected."
    }
  },

  pages: {
    dashboard: {
      title: "Node Operator Dashboard — PowerCompute ($PWR)",
      badge: "Node Operator Console",
      heading: "Node Dashboard",
      subtitle: "Register GPU nodes, submit Proof-of-Energy-Consumption (PoEC) reports, and track your $PWR rewards."
    },
    governance: {
      title: "Governance — PowerCompute ($PWR)",
      badge: "Stake-Weighted Governance",
      heading: "Governance"
    },
    leaderboard: {
      title: "Leaderboard — PowerCompute ($PWR)",
      badge: "Top Contributors",
      heading: "Leaderboard"
    },
    admin: {
      title: "Admin Panel — PowerCompute ($PWR)"
    }
  },

  index: {
    title: "PowerCompute ($PWR) — Decentralized Energy-to-Compute Orchestration Protocol",
    description: "PowerCompute ($PWR) routes stranded green energy into verified AI compute demand. Stake, calculate yield, register GPU nodes, and join the testnet.",

    hero: {
      badge: "Testnet Active — Base Sepolia",
      title1: "Powering Next-Gen",
      titleAi: "AI",
      titleWith: "with",
      title2: "Stranded Green Energy",
      subtitlePre: "PowerCompute is a decentralized orchestration layer that routes curtailed renewable energy from wind & solar farms directly into verified, on-demand GPU compute for AI workloads — turning wasted electrons into intelligence, and rewarding operators in",
      exploreEcosystem: "Explore Ecosystem"
    },

    metrics: {
      energyRouted: "Total Energy Routed (kWh)",
      activeNodes: "Active Nodes on Network",
      totalStaked: "Total Staked $PWR",
      tvl: "Total Value Locked",
      simulatedNote: "Showing simulated demo telemetry — deploy contracts and configure assets/js/config.js for live on-chain data.",
      liveNote: "Live on-chain data from NodeRegistry + PowerComputeToken on Base Sepolia."
    },

    presale: {
      title: "Ecosystem Funding Milestone",
      subtitle: "Public presale & ecosystem grants pool —",
      nextPhaseIn: "Next Price Phase In",
      raised: "Raised:",
      goal: "Goal:",
      phaseLabel: "Phase 1 · Seed Nodes",
      currentPrice: "Current Price",
      nextPrice: "Next Phase Price",
      contributors: "Contributors",
      referredBy: "You were referred by",
      referredBonus: "— you'll both get a bonus on this contribution.",
      ethPlaceholder: "ETH amount to contribute",
      contributeBtn: "Contribute to Presale",
      claimBtn: "Claim My $PWR"
    },

    calculator: {
      title1: "AI GPU",
      titleVs: "vs",
      title2: "Green Energy Yield Calculator",
      subtitle: "Simulate how many H100/A100-class GPU nodes you'd operate and see your projected energy savings, carbon offset, and $PWR rewards.",
      gpuNodesLabel: "GPU Nodes (H100 / A100)",
      oneNode: "1 node",
      hundredNodes: "100 nodes",
      curtailmentPrice: "Avg. Grid Curtailment Price ($/MWh)",
      computeRate: "Compute Market Rate ($/MWh eq.)",
      disclaimer: "Estimates assume each H100/A100 node draws ~1.6 kW under sustained AI inference/training load, sourced from stranded renewable capacity that would otherwise be curtailed. Figures are illustrative, not financial guarantees. Register a real node and submit energy proofs on the",
      disclaimerLink: "Node Dashboard",
      disclaimerEnd: "to earn actual $PWR.",
      daily: "Daily",
      monthly: "Monthly",
      energySavings: "Energy Savings (kWh/day)",
      carbonOffset: "Carbon Offset (Tons CO₂)",
      pwrRewards: "$PWR Rewards Earned",
      netRevenue: "Est. Net Revenue (USD)"
    },

    chart: {
      title: "Real-Time Grid Curtailment vs AI Compute Demand",
      subtitle: "Live simulated telemetry from PowerCompute orchestration nodes",
      curtailedEnergy: "Curtailed Energy",
      computeDemand: "Compute Demand"
    },

    staking: {
      title: "Staking & Utility Portal",
      subtitle: "Connect your wallet to view live balances and stake $PWR to earn a share of protocol emissions.",
      walletOverview: "Wallet Overview",
      pwrBalance: "$PWR Balance",
      ethBalance: "ETH Balance (Base Sepolia)",
      currentlyStaked: "Currently Staked",
      pendingRewards: "Pending Rewards",
      notePre: "Connect a wallet on",
      noteMid: "to read live on-chain balances via the deployed $PWR contract. Update the 3 contract addresses in",
      notePost: "once deployed.",
      tabStake: "Stake",
      tabUnstake: "Unstake",
      amountToStake: "Amount to Stake",
      stakeBtn: "Stake $PWR",
      apr: "APR (est.)",
      lockup: "Lock-up",
      lockupNone: "None",
      rewardToken: "Reward Token",
      amountToUnstake: "Amount to Unstake",
      unstakeBtn: "Unstake $PWR",
      claimRewardsBtn: "Claim Pending Rewards"
    },

    howItWorks: {
      title: "How It Works",
      subtitle: "Three verifiable steps turn wasted electrons into decentralized AI compute.",
      step1Title: "Grid Curtailment Detection",
      step1Body: "Oracle-fed sensors identify stranded/curtailed renewable energy at wind & solar sites in real time, before it's wasted or throttled by the grid.",
      step2Title: "Node Verification (PoEC)",
      step2Body1: "GPU node operators register on the",
      step2Link: "Node Dashboard",
      step2Body2: "and submit Proof-of-Energy-Consumption reports, verified on-chain by protocol oracles via",
      step3Title: "AI Compute Orchestration",
      step3Body: "Verified green capacity is routed to AI training/inference jobs via the PowerCompute marketplace, and operators are rewarded in $PWR minted directly to their wallet."
    },

    roadmap: {
      title: "Protocol Roadmap",
      subtitle: "From testnet validation to full Virtual Power Plant (VPP) expansion.",
      q1Title: "Testnet Launch & Node Onboarding",
      q1Item1: "Deploy $PWR token, NodeRegistry & presale contracts to Base Sepolia testnet",
      q1Item2: "Onboard first 250 pilot GPU nodes across 3 renewable energy sites via the Node Dashboard",
      q1Item3: "Launch Proof-of-Energy-Consumption (PoEC) oracle network v1",
      q1Item4: "Public bug bounty and third-party smart contract audit",
      q2Title: "Token Generation Event (TGE) & Mainnet",
      q2Item1: "$PWR Token Generation Event with DEX & CEX liquidity pairing",
      q2Item2: "Mainnet deployment on Base with cross-chain bridge to Ethereum L1",
      q2Item3: "Governance module activation — $PWR holders vote on emission rates",
      q2Item4: "Institutional GPU-operator onboarding program (500+ nodes target)",
      q3Title: "Virtual Power Plant (VPP) Expansion",
      q3Item1: "Aggregate distributed nodes into a decentralized Virtual Power Plant",
      q3Item2: "Grid demand-response contracts with regional utility partners",
      q3Item3: "AI compute marketplace v2 — spot & futures pricing for GPU-hours",
      q3Item4: "Expansion into 10+ new renewable energy corridors globally",
      q4Title: "Full Decentralization & DAO Handover",
      q4Item1: "Protocol treasury & emissions fully governed by PowerCompute DAO",
      q4Item2: "Ownership renouncement of core contracts post-final audit",
      q4Item3: "Open-source release of the full orchestration & oracle stack",
      q4Item4: "Long-term $PWR buyback-and-stake program funded by protocol revenue"
    },

    tokenomics: {
      title: "Tokenomics Breakdown",
      subtitlePre: "Fixed max supply of",
      subtitlePost: "— no unbounded inflation.",
      nodeRewards: "Node Rewards",
      stakingPool: "Staking Pool",
      ecosystemGrants: "Ecosystem & Grants",
      teamAdvisors: "Team & Advisors",
      liquidityCex: "Liquidity & CEX",
      maxSupply: "Max Supply",
      circulatingSupply: "Circulating Supply",
      network: "Network",
      networkValue: "Base (Sepolia Testnet)",
      teamVesting: "Team Vesting",
      teamVestingValue: "24-month linear, 6-month cliff"
    },

    news: {
      title: "Protocol News & Announcements",
      subtitle: "Published directly on-chain by the PowerCompute team — no server, no database, fully verifiable.",
      loading: "Loading announcements...",
      demoNote: "Showing illustrative demo announcements — deploy PowerComputeAnnouncements.sol and configure it to publish real, on-chain articles.",
      empty: "No announcements published yet.",
      readMore: "Read more"
    },

    footer: {
      description: "PowerCompute is a decentralized physical infrastructure network (DePIN) protocol that matches stranded renewable energy with verified AI compute demand. $PWR is a utility and governance token; it is not an investment contract or security. Nothing on this site constitutes financial advice.",
      tokenLabel: "Token:",
      notDeployed: "Not deployed",
      copyrightLine: "© 2026 PowerCompute Protocol. All rights reserved. ·",
      ownerConsole: "Owner Console",
      testnetDisclaimer: "$PWR is deployed on a public testnet for demonstration purposes. Testnet tokens hold no monetary value. Always verify contract addresses independently before interacting."
    }
  }
};
