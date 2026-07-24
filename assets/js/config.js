/* ==========================================================================
   POWERCOMPUTE — SHARED CHAIN CONFIG
   Single source of truth for contract addresses + ABIs, shared by
   index.html, dashboard.html, and admin.html.

   >>> After deploying the contracts in /contracts via Remix, paste the
   >>> three deployed addresses below. Everything else (index/dashboard/
   >>> admin pages) reads from this file — you only edit addresses here.
   ========================================================================== */

const POWERCOMPUTE_CONFIG = {
  // ------------------------------------------------------------------
  // Deployed contract addresses (Base Sepolia) — EDIT THESE 3 LINES
  // ------------------------------------------------------------------
  TOKEN_ADDRESS: "0x0000000000000000000000000000000000000000",
  NODE_REGISTRY_ADDRESS: "0x0000000000000000000000000000000000000000",
  PRESALE_ADDRESS: "0x0000000000000000000000000000000000000000",
  ANNOUNCEMENTS_ADDRESS: "0x0000000000000000000000000000000000000000",

  // ------------------------------------------------------------------
  // Network
  // ------------------------------------------------------------------
  CHAIN_ID: 84532,
  CHAIN_ID_HEX: "0x14A34",
  CHAIN_PARAMS: {
    chainId: "0x14A34",
    chainName: "Base Sepolia",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"]
  }
};

function pcIsConfigured(address) {
  return !!address && address !== "0x0000000000000000000000000000000000000000";
}

POWERCOMPUTE_CONFIG.tokenConfigured = pcIsConfigured(POWERCOMPUTE_CONFIG.TOKEN_ADDRESS);
POWERCOMPUTE_CONFIG.nodeRegistryConfigured = pcIsConfigured(POWERCOMPUTE_CONFIG.NODE_REGISTRY_ADDRESS);
POWERCOMPUTE_CONFIG.presaleConfigured = pcIsConfigured(POWERCOMPUTE_CONFIG.PRESALE_ADDRESS);
POWERCOMPUTE_CONFIG.announcementsConfigured = pcIsConfigured(POWERCOMPUTE_CONFIG.ANNOUNCEMENTS_ADDRESS);

// ------------------------------------------------------------------
// ABIs (human-readable ethers.js v5 fragments — only the functions the
// frontend actually calls, kept minimal on purpose)
// ------------------------------------------------------------------

const PWR_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function owner() view returns (address)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function stakedBalanceOf(address user) view returns (uint256)",
  "function pendingRewardsOf(address user) view returns (uint256)",
  "function totalStaked() view returns (uint256)",
  "function rewardRatePerSecond() view returns (uint256)",
  "function rewardsPool() view returns (uint256)",
  "function totalRewardsClaimed() view returns (uint256)",
  "function totalEmissionsMinted() view returns (uint256)",
  "function unstakeCooldown() view returns (uint256)",
  "function minters(address) view returns (bool)",
  "function stake(uint256 amount)",
  "function unstake(uint256 amount)",
  "function claimRewards()",
  "function mint(address to, uint256 amount)",
  "function setMinter(address minter, bool allowed)",
  "function fundRewardsPool(uint256 amount)",
  "function setRewardRatePerSecond(uint256 newRate)",
  "function setUnstakeCooldown(uint256 newCooldownSeconds)",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)",
  "event Staked(address indexed user, uint256 amount, uint256 newTotalStaked)",
  "event Unstaked(address indexed user, uint256 amount, uint256 newTotalStaked)",
  "event RewardsClaimed(address indexed user, uint256 amount)",
  "event EmissionMinted(address indexed minter, address indexed to, uint256 amount)"
];

const NODE_REGISTRY_ABI = [
  "function owner() view returns (address)",
  "function pwrToken() view returns (address)",
  "function nextNodeId() view returns (uint256)",
  "function nextProofId() view returns (uint256)",
  "function totalActiveNodes() view returns (uint256)",
  "function totalEnergyRoutedKwh() view returns (uint256)",
  "function totalRewardsMinted() view returns (uint256)",
  "function rewardPerKwh() view returns (uint256)",
  "function maxKwhPerProof() view returns (uint256)",
  "function oracles(address) view returns (bool)",
  "function nodes(uint256) view returns (address operator, string gpuModel, uint16 gpuCount, string energySiteId, string region, uint8 status, uint256 registeredAt, uint256 totalEnergyRoutedKwh, uint256 totalRewardsEarned, uint256 lastProofTimestamp)",
  "function energyProofs(uint256) view returns (uint256 nodeId, address operator, uint256 kWhRouted, uint256 periodStart, uint256 periodEnd, bool approved, bool rejected, uint256 rewardMinted, uint256 submittedAt, uint256 resolvedAt)",
  "function getNodesByOperator(address operatorAddr) view returns (uint256[])",
  "function getNode(uint256 nodeId) view returns (tuple(address operator, string gpuModel, uint16 gpuCount, string energySiteId, string region, uint8 status, uint256 registeredAt, uint256 totalEnergyRoutedKwh, uint256 totalRewardsEarned, uint256 lastProofTimestamp))",
  "function getEnergyProof(uint256 proofId) view returns (tuple(uint256 nodeId, address operator, uint256 kWhRouted, uint256 periodStart, uint256 periodEnd, bool approved, bool rejected, uint256 rewardMinted, uint256 submittedAt, uint256 resolvedAt))",
  "function registerNode(string gpuModel, uint16 gpuCount, string energySiteId, string region) returns (uint256)",
  "function verifyNode(uint256 nodeId)",
  "function suspendNode(uint256 nodeId)",
  "function reinstateNode(uint256 nodeId)",
  "function retireNode(uint256 nodeId)",
  "function submitEnergyProof(uint256 nodeId, uint256 kWhRouted, uint256 periodStart, uint256 periodEnd) returns (uint256)",
  "function approveEnergyProof(uint256 proofId)",
  "function rejectEnergyProof(uint256 proofId, string reason)",
  "function setOracle(address oracleAddr, bool allowed)",
  "function setRewardPerKwh(uint256 newRate)",
  "function setMaxKwhPerProof(uint256 newMax)",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)",
  "event NodeRegistered(uint256 indexed nodeId, address indexed operator, string gpuModel, uint16 gpuCount, string energySiteId, string region)",
  "event NodeVerified(uint256 indexed nodeId, address indexed verifier)",
  "event NodeStatusChanged(uint256 indexed nodeId, uint8 oldStatus, uint8 newStatus)",
  "event EnergyProofSubmitted(uint256 indexed proofId, uint256 indexed nodeId, address indexed operator, uint256 kWhRouted, uint256 periodStart, uint256 periodEnd)",
  "event EnergyProofApproved(uint256 indexed proofId, uint256 indexed nodeId, address indexed operator, uint256 rewardMinted)",
  "event EnergyProofRejected(uint256 indexed proofId, uint256 indexed nodeId, string reason)"
];

const PRESALE_ABI = [
  "function owner() view returns (address)",
  "function pwrToken() view returns (address)",
  "function state() view returns (uint8)",
  "function fundingGoalWei() view returns (uint256)",
  "function totalRaisedWei() view returns (uint256)",
  "function totalTokensSold() view returns (uint256)",
  "function tokensDepositedForClaims() view returns (uint256)",
  "function currentPhaseIndex() view returns (uint256)",
  "function contributionsWei(address) view returns (uint256)",
  "function tokenAllocations(address) view returns (uint256)",
  "function hasClaimed(address) view returns (bool)",
  "function phaseCount() view returns (uint256)",
  "function contributorCount() view returns (uint256)",
  "function phases(uint256) view returns (uint256 priceWeiPerToken, uint256 capWei, uint256 raisedWei)",
  "function currentPhase() view returns (uint256 priceWeiPerToken, uint256 capWei, uint256 raisedWei, uint256 index)",
  "function progressBps() view returns (uint256)",
  "function addPhase(uint256 priceWeiPerToken, uint256 capWei)",
  "function startPresale()",
  "function setFundingGoal(uint256 newGoalWei)",
  "function contribute() payable",
  "function depositTokensForClaims(uint256 amount)",
  "function finalize()",
  "function cancelPresale()",
  "function withdrawRaisedFunds(address to)",
  "function recoverUnclaimedTokens(address to, uint256 amount)",
  "function claim()",
  "function claimRefund()",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)",
  "event Contributed(address indexed contributor, uint256 phaseIndex, uint256 weiAmount, uint256 tokensAllocated)",
  "event PresaleFinalized(uint256 totalRaisedWei, uint256 totalTokensSold)",
  "event Claimed(address indexed contributor, uint256 tokenAmount)"
];

const ANNOUNCEMENTS_ABI = [
  "function owner() view returns (address)",
  "function nextPostId() view returns (uint256)",
  "function totalPosts() view returns (uint256)",
  "function editors(address) view returns (bool)",
  "function posts(uint256) view returns (uint256 id, string title, string body, string tag, string externalUrl, address author, uint256 publishedAt, uint256 updatedAt, bool archived)",
  "function getPost(uint256 postId) view returns (tuple(uint256 id, string title, string body, string tag, string externalUrl, address author, uint256 publishedAt, uint256 updatedAt, bool archived))",
  "function getRecentPosts(uint256 limit) view returns (tuple(uint256 id, string title, string body, string tag, string externalUrl, address author, uint256 publishedAt, uint256 updatedAt, bool archived)[])",
  "function publish(string title, string body, string tag, string externalUrl) returns (uint256)",
  "function editPost(uint256 postId, string title, string body, string tag, string externalUrl)",
  "function archivePost(uint256 postId)",
  "function unarchivePost(uint256 postId)",
  "function setEditor(address editorAddr, bool allowed)",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)",
  "event PostPublished(uint256 indexed postId, address indexed author, string title, string tag)",
  "event PostEdited(uint256 indexed postId, address indexed editor)",
  "event PostArchived(uint256 indexed postId)",
  "event PostUnarchived(uint256 indexed postId)"
];

// Human-readable labels for on-chain enums
const NODE_STATUS_LABELS = ["Pending", "Active", "Suspended", "Retired"];
const PRESALE_STATE_LABELS = ["Configuring", "Active", "Finalized", "Cancelled"];
