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
  TIMELOCK_ADDRESS: "0x0000000000000000000000000000000000000000",
  VESTING_ADDRESS: "0x0000000000000000000000000000000000000000",
  GOVERNOR_ADDRESS: "0x0000000000000000000000000000000000000000",

  // ------------------------------------------------------------------
  // WalletConnect (optional). Get a free Project ID at https://cloud.reown.com
  // Leave as-is to skip WalletConnect and rely on injected wallets only.
  // ------------------------------------------------------------------
  WALLETCONNECT_PROJECT_ID: "",

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
POWERCOMPUTE_CONFIG.timelockConfigured = pcIsConfigured(POWERCOMPUTE_CONFIG.TIMELOCK_ADDRESS);
POWERCOMPUTE_CONFIG.vestingConfigured = pcIsConfigured(POWERCOMPUTE_CONFIG.VESTING_ADDRESS);
POWERCOMPUTE_CONFIG.governorConfigured = pcIsConfigured(POWERCOMPUTE_CONFIG.GOVERNOR_ADDRESS);
POWERCOMPUTE_CONFIG.walletConnectConfigured = !!POWERCOMPUTE_CONFIG.WALLETCONNECT_PROJECT_ID;

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
  "function pendingOwner() view returns (address)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function MAX_UNSTAKE_COOLDOWN() view returns (uint256)",
  "function stakedBalanceOf(address user) view returns (uint256)",
  "function getPastStakedBalance(address account, uint256 blockNumber) view returns (uint256)",
  "function getPastTotalStaked(uint256 blockNumber) view returns (uint256)",
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
  "function recoverForeignToken(address tokenAddress, uint256 amount, address to)",
  "function transferOwnership(address newOwner)",
  "function acceptOwnership()",
  "function cancelOwnershipTransfer()",
  "function renounceOwnership()",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)",
  "event Staked(address indexed user, uint256 amount, uint256 newTotalStaked)",
  "event Unstaked(address indexed user, uint256 amount, uint256 newTotalStaked)",
  "event RewardsClaimed(address indexed user, uint256 amount)",
  "event EmissionMinted(address indexed minter, address indexed to, uint256 amount)",
  "event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
];

const NODE_REGISTRY_ABI = [
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
  "function pwrToken() view returns (address)",
  "function nextNodeId() view returns (uint256)",
  "function nextProofId() view returns (uint256)",
  "function totalActiveNodes() view returns (uint256)",
  "function totalEnergyRoutedKwh() view returns (uint256)",
  "function totalRewardsMinted() view returns (uint256)",
  "function rewardPerKwh() view returns (uint256)",
  "function maxKwhPerProof() view returns (uint256)",
  "function MAX_BATCH_SIZE() view returns (uint256)",
  "function oracles(address) view returns (bool)",
  "function nodes(uint256) view returns (address operator, string gpuModel, uint16 gpuCount, string energySiteId, string region, uint8 status, uint256 registeredAt, uint256 totalEnergyRoutedKwh, uint256 totalRewardsEarned, uint256 lastProofTimestamp)",
  "function energyProofs(uint256) view returns (uint256 nodeId, address operator, uint256 kWhRouted, uint256 periodStart, uint256 periodEnd, bool approved, bool rejected, uint256 rewardMinted, uint256 submittedAt, uint256 resolvedAt, uint256 rewardPerKwhAtSubmission)",
  "function getNodesByOperator(address operatorAddr) view returns (uint256[])",
  "function getNode(uint256 nodeId) view returns (tuple(address operator, string gpuModel, uint16 gpuCount, string energySiteId, string region, uint8 status, uint256 registeredAt, uint256 totalEnergyRoutedKwh, uint256 totalRewardsEarned, uint256 lastProofTimestamp))",
  "function getEnergyProof(uint256 proofId) view returns (tuple(uint256 nodeId, address operator, uint256 kWhRouted, uint256 periodStart, uint256 periodEnd, bool approved, bool rejected, uint256 rewardMinted, uint256 submittedAt, uint256 resolvedAt, uint256 rewardPerKwhAtSubmission))",
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
  "function batchVerifyNodes(uint256[] nodeIds) returns (uint256)",
  "function batchApproveEnergyProofs(uint256[] proofIds) returns (uint256)",
  "function transferOwnership(address newOwner)",
  "function acceptOwnership()",
  "function cancelOwnershipTransfer()",
  "function renounceOwnership()",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)",
  "event NodeRegistered(uint256 indexed nodeId, address indexed operator, string gpuModel, uint16 gpuCount, string energySiteId, string region)",
  "event NodeVerified(uint256 indexed nodeId, address indexed verifier)",
  "event NodeStatusChanged(uint256 indexed nodeId, uint8 oldStatus, uint8 newStatus)",
  "event EnergyProofSubmitted(uint256 indexed proofId, uint256 indexed nodeId, address indexed operator, uint256 kWhRouted, uint256 periodStart, uint256 periodEnd)",
  "event EnergyProofApproved(uint256 indexed proofId, uint256 indexed nodeId, address indexed operator, uint256 rewardMinted)",
  "event EnergyProofRejected(uint256 indexed proofId, uint256 indexed nodeId, string reason)",
  "event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
];

const PRESALE_ABI = [
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
  "function pwrToken() view returns (address)",
  "function state() view returns (uint8)",
  "function fundingGoalWei() view returns (uint256)",
  "function totalRaisedWei() view returns (uint256)",
  "function totalTokensSold() view returns (uint256)",
  "function tokensDepositedForClaims() view returns (uint256)",
  "function totalTokensClaimed() view returns (uint256)",
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
  "function contributeWithReferral(address referrer) payable",
  "function depositTokensForClaims(uint256 amount)",
  "function finalize()",
  "function cancelPresale()",
  "function withdrawRaisedFunds(address to)",
  "function recoverUnclaimedTokens(address to, uint256 amount)",
  "function recoverDepositedTokensAfterCancel(address to, uint256 amount)",
  "function claim()",
  "function claimRefund()",
  "function transferOwnership(address newOwner)",
  "function acceptOwnership()",
  "function cancelOwnershipTransfer()",
  "function renounceOwnership()",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)",
  "function referredBy(address) view returns (address)",
  "function referrerOf(address referee) view returns (address)",
  "function referralCount(address) view returns (uint256)",
  "function referralVolumeWei(address) view returns (uint256)",
  "function referralBonusEarned(address) view returns (uint256)",
  "function referralBlocked(address) view returns (bool)",
  "function refereeBonusBps() view returns (uint256)",
  "function referrerBonusBps() view returns (uint256)",
  "function totalReferralBonusIssued() view returns (uint256)",
  "function setReferralBps(uint256 newRefereeBonusBps, uint256 newReferrerBonusBps)",
  "function setReferralBlocked(address referrer, bool blocked)",
  "event Contributed(address indexed contributor, uint256 phaseIndex, uint256 weiAmount, uint256 tokensAllocated)",
  "event PresaleFinalized(uint256 totalRaisedWei, uint256 totalTokensSold)",
  "event Claimed(address indexed contributor, uint256 tokenAmount)",
  "event ReferralLinked(address indexed referee, address indexed referrer)",
  "event ReferralBonusPaid(address indexed referee, address indexed referrer, uint256 refereeBonus, uint256 referrerBonus)",
  "event ReferrerBlocked(address indexed referrer, bool blocked)",
  "event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
];

const ANNOUNCEMENTS_ABI = [
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
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
  "function transferOwnership(address newOwner)",
  "function acceptOwnership()",
  "function cancelOwnershipTransfer()",
  "function renounceOwnership()",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)",
  "event PostPublished(uint256 indexed postId, address indexed author, string title, string tag)",
  "event PostEdited(uint256 indexed postId, address indexed editor)",
  "event PostArchived(uint256 indexed postId)",
  "event PostUnarchived(uint256 indexed postId)",
  "event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
];

const TIMELOCK_ABI = [
  "function admin() view returns (address)",
  "function pendingAdmin() view returns (address)",
  "function delaySeconds() view returns (uint256)",
  "function MIN_DELAY() view returns (uint256)",
  "function MAX_DELAY() view returns (uint256)",
  "function GRACE_PERIOD() view returns (uint256)",
  "function queuedTransactions(bytes32) view returns (bool)",
  "function setPendingAdmin(address newPendingAdmin)",
  "function acceptAdmin()",
  "function queueTransaction(address target, uint256 value, bytes data, uint256 eta) returns (bytes32)",
  "function cancelTransaction(address target, uint256 value, bytes data, uint256 eta)",
  "function executeTransaction(address target, uint256 value, bytes data, uint256 eta) payable returns (bytes)",
  "function computeTxHash(address target, uint256 value, bytes data, uint256 eta) view returns (bytes32)",
  "event QueueTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta)",
  "event CancelTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta)",
  "event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta)"
];

const VESTING_ABI = [
  "function pwrToken() view returns (address)",
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
  "function totalAllocated() view returns (uint256)",
  "function totalReleased() view returns (uint256)",
  "function beneficiaryCount() view returns (uint256)",
  "function beneficiaries(uint256) view returns (address)",
  "function schedules(address) view returns (uint256 totalAmount, uint256 released, uint256 startTime, uint256 cliffSeconds, uint256 durationSeconds, bool revocable, bool revoked)",
  "function getSchedule(address beneficiary) view returns (tuple(uint256 totalAmount, uint256 released, uint256 startTime, uint256 cliffSeconds, uint256 durationSeconds, bool revocable, bool revoked))",
  "function vestedAmountOf(address beneficiary) view returns (uint256)",
  "function releasableAmountOf(address beneficiary) view returns (uint256)",
  "function createVestingSchedule(address beneficiary, uint256 totalAmount, uint256 startTime, uint256 cliffSeconds, uint256 durationSeconds, bool revocable)",
  "function revoke(address beneficiary)",
  "function release()",
  "function transferOwnership(address newOwner)",
  "function acceptOwnership()",
  "function cancelOwnershipTransfer()",
  "function renounceOwnership()",
  "event ScheduleCreated(address indexed beneficiary, uint256 totalAmount, uint256 startTime, uint256 cliffSeconds, uint256 durationSeconds, bool revocable)",
  "event TokensReleased(address indexed beneficiary, uint256 amount)",
  "event ScheduleRevoked(address indexed beneficiary, uint256 vestedAndKept, uint256 unvestedReturned)",
  "event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
];

const GOVERNOR_ABI = [
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
  "function stakeToken() view returns (address)",
  "function nextProposalId() view returns (uint256)",
  "function proposalThreshold() view returns (uint256)",
  "function votingPeriodSeconds() view returns (uint256)",
  "function quorumBps() view returns (uint256)",
  "function proposals(uint256) view returns (uint256 id, address proposer, string title, string description, uint256 startTime, uint256 endTime, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool executed, uint256 snapshotBlock)",
  "function getProposal(uint256 proposalId) view returns (tuple(uint256 id, address proposer, string title, string description, uint256 startTime, uint256 endTime, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool executed, uint256 snapshotBlock))",
  "function hasVoted(uint256, address) view returns (bool)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function propose(string title, string description) returns (uint256)",
  "function castVote(uint256 proposalId, uint8 support)",
  "function markExecuted(uint256 proposalId)",
  "function setProposalThreshold(uint256 newThreshold)",
  "function setVotingPeriod(uint256 newPeriodSeconds)",
  "function setQuorumBps(uint256 newQuorumBps)",
  "function transferOwnership(address newOwner)",
  "function acceptOwnership()",
  "function cancelOwnershipTransfer()",
  "function renounceOwnership()",
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title, uint256 startTime, uint256 endTime)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support, uint256 weight)",
  "event ProposalExecuted(uint256 indexed proposalId)",
  "event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
];

// Human-readable labels for on-chain enums
const NODE_STATUS_LABELS = ["Pending", "Active", "Suspended", "Retired"];
const PRESALE_STATE_LABELS = ["Configuring", "Active", "Finalized", "Cancelled"];
const GOVERNOR_STATE_LABELS = ["Pending", "Active", "Defeated", "Succeeded", "Executed"];
