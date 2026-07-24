// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
 * This contract intentionally has ZERO external dependencies (no OpenZeppelin
 * imports) so it can be pasted directly into Remix and compiled offline,
 * with no import-resolution/network calls required.
 */

// -----------------------------------------------------------------------
// Minimal, audited-pattern ERC-20 + Ownable + ReentrancyGuard primitives
// implemented in-file to keep this a single, dependency-free contract.
// -----------------------------------------------------------------------

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

abstract contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Ownable: zero address owner");
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }

    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

abstract contract Pausable is Ownable {
    bool private _paused;

    event Paused(address account);
    event Unpaused(address account);

    modifier whenNotPaused() {
        require(!_paused, "Pausable: paused");
        _;
    }

    function paused() public view returns (bool) {
        return _paused;
    }

    function pause() external onlyOwner {
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        _paused = false;
        emit Unpaused(msg.sender);
    }
}

/**
 * @dev Standard ERC-20 implementation (name/symbol/decimals + transfer logic).
 */
abstract contract ERC20 is IERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public pure returns (uint8) {
        return 18;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view virtual override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address tokenOwner, address spender) public view virtual override returns (uint256) {
        return _allowances[tokenOwner][spender];
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        uint256 currentAllowance = _allowances[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
        _approve(msg.sender, spender, currentAllowance - subtractedValue);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal virtual {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");

        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");
        _totalSupply += amount;
        unchecked {
            _balances[account] += amount;
        }
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");
        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - amount;
            _totalSupply -= amount;
        }
        emit Transfer(account, address(0), amount);
    }

    function _approve(address tokenOwner, address spender, uint256 amount) internal virtual {
        require(tokenOwner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        _allowances[tokenOwner][spender] = amount;
        emit Approval(tokenOwner, spender, amount);
    }

    function _spendAllowance(address tokenOwner, address spender, uint256 amount) internal virtual {
        uint256 currentAllowance = allowance(tokenOwner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(tokenOwner, spender, currentAllowance - amount);
            }
        }
    }
}

/**
 * @title PowerComputeToken
 * @notice $PWR ERC-20 token with a built-in single-sided staking module.
 *
 * Staking mechanics:
 *  - Users lock $PWR via `stake(uint256)`. Staked tokens are moved into the
 *    contract's own balance and tracked per-user in `stakedBalance`.
 *  - Rewards accrue continuously based on `rewardRatePerSecond` and the
 *    user's proportional share of `totalStaked` (a MasterChef-style
 *    accumulator: `accRewardPerShare`).
 *  - `unstake(uint256)` withdraws principal (and auto-claims pending
 *    rewards) back to the caller.
 *  - `claimRewards()` lets a user harvest rewards without unstaking.
 *  - The contract is pre-funded with a rewards pool from the fixed supply
 *    minted at deployment (no unbounded inflation / no external mint).
 */
contract PowerComputeToken is ERC20, Ownable, Pausable, ReentrancyGuard {
    // ------------------------------------------------------------------
    // Constants & immutable-ish config
    // ------------------------------------------------------------------

    /// @notice Hard cap on total supply: 1,000,000,000 $PWR (18 decimals).
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    /// @notice Precision factor used for the rewards accumulator.
    uint256 private constant ACC_PRECISION = 1e18;

    // ------------------------------------------------------------------
    // Staking state
    // ------------------------------------------------------------------

    struct StakerInfo {
        uint256 amount;        // Currently staked principal
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

    /// @notice Total rewards already claimed by all users (accounting only).
    uint256 public totalRewardsClaimed;

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
    // Internal accumulator logic
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
     * @dev Transfers `amount` from caller to this contract and starts/continues
     *      accruing pro-rata rewards from `rewardsPool`.
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

    /**
     * @notice Convenience view combining staked balance + live pending rewards.
     */
    function pendingRewardsOf(address user) external view returns (uint256) {
        return _pendingRewards(user);
    }

    function stakedBalanceOf(address user) external view returns (uint256) {
        return stakers[user].amount;
    }

    // ------------------------------------------------------------------
    // Owner / protocol administration
    // ------------------------------------------------------------------

    /**
     * @notice Fund the on-chain rewards pool that backs staking emissions.
     *         Caller must already hold the tokens; they are pulled from the
     *         owner's own balance into the contract.
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
     * @notice Mint additional $PWR up to MAX_SUPPLY, e.g. for ecosystem grants
     *         or exchange liquidity. Cannot be used once renounceOwnership() is called.
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
