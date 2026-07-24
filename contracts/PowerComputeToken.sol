// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./common/PowerComputeBase.sol";

/**
 * @title PowerComputeToken ($PWR)
 * @author PowerCompute Protocol
 * @notice Native utility & governance token for the PowerCompute Decentralized
 *         Energy-to-Compute Orchestration Protocol. Node operators earn $PWR
 *         for routing stranded/curtailed green energy into verified AI compute
 *         workloads. Holders can stake $PWR to earn a share of protocol
 *         emissions and unlock priority GPU-node allocation.
 *
 * Deployment target: Base Sepolia (chainId 84532) via Remix IDE.
 *
 * Architecture:
 *  - Standard ERC-20 + Ownable + Pausable + ReentrancyGuard primitives are
 *    imported from `./common/PowerComputeBase.sol` (still zero external
 *    npm/OpenZeppelin dependencies — everything lives in this repo).
 *  - A `minters` allowlist lets the protocol's `NodeRegistry` contract call
 *    `mintReward()` to pay out verified energy-routing rewards, while
 *    `mint()` (owner-only, for grants/liquidity) and `mintReward()`
 *    (minter-only, for protocol emissions) are both capped by `MAX_SUPPLY`.
 *  - Note: this contract intentionally does NOT formally `is IPowerComputeMintable`
 *    (Solidity doesn't require that for external calls to succeed via that
 *    interface type elsewhere, e.g. in NodeRegistry) — this avoids a diamond
 *    inheritance ambiguity between ERC20's IERC20 and IPowerComputeMintable's
 *    IERC20, while still exposing the exact same `mintReward(address,uint256)`
 *    selector that NodeRegistry calls.
 */
contract PowerComputeToken is ERC20, Ownable, Pausable, ReentrancyGuard {
    // ------------------------------------------------------------------
    // Constants & config
    // ------------------------------------------------------------------

    /// @notice Hard cap on total supply: 1,000,000,000 $PWR (18 decimals).
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    /// @notice Precision factor used for the staking rewards accumulator.
    uint256 private constant ACC_PRECISION = 1e18;

    // ------------------------------------------------------------------
    // Minter allowlist (used by NodeRegistry to pay energy-routing rewards)
    // ------------------------------------------------------------------

    mapping(address => bool) public minters;

    event MinterUpdated(address indexed minter, bool allowed);

    modifier onlyMinter() {
        require(minters[msg.sender], "PWR: caller is not an approved minter");
        _;
    }

    // ------------------------------------------------------------------
    // Staking state
    // ------------------------------------------------------------------

    struct StakerInfo {
        uint256 amount;         // Currently staked principal
        uint256 rewardDebt;     // Accounted-for reward baseline (accumulator terms)
        uint256 pendingRewards; // Rewards harvested-but-not-yet-claimed bucket
        uint256 lastStakeTime;  // Timestamp of the last stake/unstake action
    }

    mapping(address => StakerInfo) public stakers;

    /// @notice Total $PWR currently staked across all users.
    uint256 public totalStaked;

    /// @notice Reward tokens emitted per second, distributed pro-rata to stakers.
    uint256 public rewardRatePerSecond;

    /// @notice Running accumulator: accumulated reward per staked token, scaled by ACC_PRECISION.
    uint256 public accRewardPerShare;

    /// @notice Timestamp of the last time the accumulator was updated.
    uint256 public lastRewardTimestamp;

    /// @notice Total rewards ever reserved for distribution (funding pool).
    uint256 public rewardsPool;

    /// @notice Total staking rewards already claimed by all users (accounting only).
    uint256 public totalRewardsClaimed;

    /// @notice Total protocol emission rewards minted via mintReward (accounting only).
    uint256 public totalEmissionsMinted;

    /// @notice Optional lock-up period (seconds) users must wait after staking before unstaking.
    uint256 public unstakeCooldown = 0;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event Staked(address indexed user, uint256 amount, uint256 newTotalStaked);
    event Unstaked(address indexed user, uint256 amount, uint256 newTotalStaked);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);
    event RewardsPoolFunded(address indexed funder, uint256 amount);
    event UnstakeCooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event EmissionMinted(address indexed minter, address indexed to, uint256 amount);

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    /**
     * @param initialSupply Amount of $PWR (whole tokens, no decimals) minted to the
     *        deployer at genesis. Example: 200_000_000 mints 200M $PWR.
     * @param initialRewardRatePerSecond Initial staking emission rate, in wei/second
     *        of $PWR (e.g. 1e18 = 1 $PWR per second shared across all stakers).
     */
    constructor(uint256 initialSupply, uint256 initialRewardRatePerSecond)
        ERC20("PowerCompute", "PWR")
        Ownable(msg.sender)
    {
        uint256 mintAmount = initialSupply * 1e18;
        require(mintAmount <= MAX_SUPPLY, "PWR: exceeds max supply");
        _mint(msg.sender, mintAmount);

        rewardRatePerSecond = initialRewardRatePerSecond;
        lastRewardTimestamp = block.timestamp;

        emit RewardRateUpdated(0, initialRewardRatePerSecond);
    }

    // ------------------------------------------------------------------
    // Internal staking accumulator logic
    // ------------------------------------------------------------------

    function _updatePool() internal {
        if (block.timestamp <= lastRewardTimestamp) {
            return;
        }

        if (totalStaked == 0) {
            lastRewardTimestamp = block.timestamp;
            return;
        }

        uint256 elapsed = block.timestamp - lastRewardTimestamp;
        uint256 reward = elapsed * rewardRatePerSecond;

        // Never emit more than what remains in the funded rewards pool.
        if (reward > rewardsPool) {
            reward = rewardsPool;
        }

        if (reward > 0) {
            rewardsPool -= reward;
            accRewardPerShare += (reward * ACC_PRECISION) / totalStaked;
        }

        lastRewardTimestamp = block.timestamp;
    }

    function _pendingRewards(address user) internal view returns (uint256) {
        StakerInfo storage info = stakers[user];

        uint256 acc = accRewardPerShare;

        if (block.timestamp > lastRewardTimestamp && totalStaked > 0 && rewardRatePerSecond > 0) {
            uint256 elapsed = block.timestamp - lastRewardTimestamp;
            uint256 reward = elapsed * rewardRatePerSecond;
            if (reward > rewardsPool) {
                reward = rewardsPool;
            }
            acc += (reward * ACC_PRECISION) / totalStaked;
        }

        uint256 accumulated = (info.amount * acc) / ACC_PRECISION;
        return info.pendingRewards + accumulated - info.rewardDebt;
    }

    function _harvest(address user) internal {
        StakerInfo storage info = stakers[user];

        uint256 accumulated = (info.amount * accRewardPerShare) / ACC_PRECISION;
        uint256 newlyAccrued = accumulated - info.rewardDebt;

        if (newlyAccrued > 0) {
            info.pendingRewards += newlyAccrued;
        }

        info.rewardDebt = accumulated;
    }

    // ------------------------------------------------------------------
    // Public staking interface
    // ------------------------------------------------------------------

    /**
     * @notice Stake `amount` of $PWR into the protocol staking pool.
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "PWR: stake amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "PWR: insufficient balance");

        _updatePool();

        StakerInfo storage info = stakers[msg.sender];
        _harvest(msg.sender);

        _transfer(msg.sender, address(this), amount);

        info.amount += amount;
        info.lastStakeTime = block.timestamp;
        info.rewardDebt = (info.amount * accRewardPerShare) / ACC_PRECISION;

        totalStaked += amount;

        emit Staked(msg.sender, amount, totalStaked);
    }

    /**
     * @notice Unstake `amount` of previously staked $PWR, auto-harvesting any
     *         pending rewards into the caller's claimable bucket in the same tx.
     */
    function unstake(uint256 amount) external nonReentrant {
        StakerInfo storage info = stakers[msg.sender];
        require(amount > 0, "PWR: unstake amount must be > 0");
        require(info.amount >= amount, "PWR: insufficient staked balance");
        require(
            block.timestamp >= info.lastStakeTime + unstakeCooldown,
            "PWR: unstake cooldown active"
        );

        _updatePool();
        _harvest(msg.sender);

        info.amount -= amount;
        info.rewardDebt = (info.amount * accRewardPerShare) / ACC_PRECISION;

        totalStaked -= amount;

        _transfer(address(this), msg.sender, amount);

        emit Unstaked(msg.sender, amount, totalStaked);
    }

    /**
     * @notice Harvest all pending staking rewards to the caller's wallet.
     */
    function claimRewards() external nonReentrant {
        _updatePool();
        _harvest(msg.sender);

        StakerInfo storage info = stakers[msg.sender];
        uint256 amount = info.pendingRewards;
        require(amount > 0, "PWR: no rewards to claim");

        info.pendingRewards = 0;
        totalRewardsClaimed += amount;

        _transfer(address(this), msg.sender, amount);

        emit RewardsClaimed(msg.sender, amount);
    }

    function pendingRewardsOf(address user) external view returns (uint256) {
        return _pendingRewards(user);
    }

    function stakedBalanceOf(address user) external view returns (uint256) {
        return stakers[user].amount;
    }

    // ------------------------------------------------------------------
    // Protocol emissions (called by NodeRegistry & other approved minters)
    // ------------------------------------------------------------------

    /**
     * @notice Mint verified energy-routing reward tokens to a node operator.
     * @dev Only callable by contracts/addresses explicitly approved via
     *      `setMinter`. This is how NodeRegistry pays out PoEC rewards
     *      without needing direct token custody.
     */
    function mintReward(address to, uint256 amount) external onlyMinter {
        require(totalSupply() + amount <= MAX_SUPPLY, "PWR: exceeds max supply");
        totalEmissionsMinted += amount;
        _mint(to, amount);
        emit EmissionMinted(msg.sender, to, amount);
    }

    // ------------------------------------------------------------------
    // Owner / protocol administration
    // ------------------------------------------------------------------

    /**
     * @notice Approve or revoke an address (typically the NodeRegistry
     *         contract) to call `mintReward`.
     */
    function setMinter(address minter, bool allowed) external onlyOwner {
        require(minter != address(0), "PWR: zero address minter");
        minters[minter] = allowed;
        emit MinterUpdated(minter, allowed);
    }

    /**
     * @notice Fund the on-chain rewards pool that backs staking emissions.
     */
    function fundRewardsPool(uint256 amount) external onlyOwner {
        require(amount > 0, "PWR: fund amount must be > 0");
        _updatePool();
        _transfer(msg.sender, address(this), amount);
        rewardsPool += amount;
        emit RewardsPoolFunded(msg.sender, amount);
    }

    /**
     * @notice Adjust the per-second emission rate for future staking rewards.
     */
    function setRewardRatePerSecond(uint256 newRate) external onlyOwner {
        _updatePool();
        emit RewardRateUpdated(rewardRatePerSecond, newRate);
        rewardRatePerSecond = newRate;
    }

    /**
     * @notice Set a minimum lock-up (in seconds) required between staking and unstaking.
     */
    function setUnstakeCooldown(uint256 newCooldownSeconds) external onlyOwner {
        emit UnstakeCooldownUpdated(unstakeCooldown, newCooldownSeconds);
        unstakeCooldown = newCooldownSeconds;
    }

    /**
     * @notice Mint additional $PWR up to MAX_SUPPLY, e.g. for ecosystem grants,
     *         exchange liquidity, or seeding the presale claim pool.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "PWR: exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @notice Emergency-recover ERC-20 tokens accidentally sent to this contract.
     *         Cannot be used to withdraw the staking principal or funded rewards pool.
     */
    function recoverForeignToken(address tokenAddress, uint256 amount, address to) external onlyOwner {
        require(tokenAddress != address(this), "PWR: cannot recover native token");
        require(to != address(0), "PWR: zero address recipient");
        IERC20(tokenAddress).transfer(to, amount);
    }
}
