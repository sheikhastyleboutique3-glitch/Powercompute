// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./common/PowerComputeBase.sol";

/**
 * @title PowerComputePresale
 * @author PowerCompute Protocol
 * @notice Phased ETH presale for $PWR. Contributors send native ETH and
 *         accrue a claimable $PWR allocation at the current phase price.
 *         Tokens are NOT transferred at contribution time — they are
 *         claimable only after the owner calls `finalize()`, at which
 *         point the presale contract must already hold enough $PWR
 *         (deposited via `depositTokensForClaims`) to cover all sold
 *         allocations.
 *
 * Flow:
 *  1. Owner deploys with the $PWR token address and a funding goal.
 *  2. Owner configures one or more phases via `addPhase(priceWei, capWei)`
 *     where `priceWei` = wei of ETH per whole $PWR token (18 decimals) and
 *     `capWei` = max wei raisable in that phase.
 *  3. Owner calls `startPresale()`.
 *  4. Contributors call `contribute()` with ETH attached. Allocation is
 *     computed at the current phase's price and the phase auto-advances
 *     once its cap is filled.
 *  5. Owner deposits enough $PWR into the contract via
 *     `depositTokensForClaims` (requires prior `approve` on the token) to
 *     cover `totalTokensSold`.
 *  6. Owner calls `finalize()` to lock the raise and enable `claim()`.
 *  7. Owner calls `withdrawRaisedFunds()` to sweep the raised ETH out.
 *
 * If the owner instead calls `cancelPresale()` before finalizing,
 * contributors can call `claimRefund()` to withdraw their ETH back.
 */
contract PowerComputePresale is Ownable, Pausable, ReentrancyGuard {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum PresaleState {
        Configuring, // owner is still adding phases
        Active,      // accepting contributions
        Finalized,   // raise locked, claims open
        Cancelled    // raise cancelled, refunds open
    }

    struct Phase {
        uint256 priceWeiPerToken; // wei of ETH per 1 whole $PWR (18 decimals)
        uint256 capWei;           // max wei raisable in this phase
        uint256 raisedWei;        // wei raised so far in this phase
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    IERC20 public immutable pwrToken;

    Phase[] public phases;
    uint256 public currentPhaseIndex;
    PresaleState public state;

    uint256 public fundingGoalWei;
    uint256 public totalRaisedWei;
    uint256 public totalTokensSold;
    uint256 public tokensDepositedForClaims;

    mapping(address => uint256) public contributionsWei;
    mapping(address => uint256) public tokenAllocations;
    mapping(address => bool) public hasClaimed;

    address[] public contributors;
    mapping(address => bool) private _isKnownContributor;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event PhaseAdded(uint256 indexed phaseIndex, uint256 priceWeiPerToken, uint256 capWei);
    event PresaleStarted(uint256 timestamp);
    event Contributed(address indexed contributor, uint256 phaseIndex, uint256 weiAmount, uint256 tokensAllocated);
    event PhaseAdvanced(uint256 indexed fromPhase, uint256 indexed toPhase);
    event TokensDeposited(address indexed from, uint256 amount);
    event PresaleFinalized(uint256 totalRaisedWei, uint256 totalTokensSold);
    event PresaleCancelled(uint256 timestamp);
    event Claimed(address indexed contributor, uint256 tokenAmount);
    event Refunded(address indexed contributor, uint256 weiAmount);
    event FundsWithdrawn(address indexed to, uint256 weiAmount);

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address pwrTokenAddress, uint256 fundingGoalWei_, address initialOwner) Ownable(initialOwner) {
        require(pwrTokenAddress != address(0), "Presale: zero token address");
        pwrToken = IERC20(pwrTokenAddress);
        fundingGoalWei = fundingGoalWei_;
        state = PresaleState.Configuring;
    }

    // ------------------------------------------------------------------
    // Owner configuration (before start)
    // ------------------------------------------------------------------

    function addPhase(uint256 priceWeiPerToken, uint256 capWei) external onlyOwner {
        require(state == PresaleState.Configuring, "Presale: not configuring");
        require(priceWeiPerToken > 0, "Presale: price must be > 0");
        require(capWei > 0, "Presale: cap must be > 0");

        phases.push(Phase({ priceWeiPerToken: priceWeiPerToken, capWei: capWei, raisedWei: 0 }));

        emit PhaseAdded(phases.length - 1, priceWeiPerToken, capWei);
    }

    function startPresale() external onlyOwner {
        require(state == PresaleState.Configuring, "Presale: not configuring");
        require(phases.length > 0, "Presale: no phases configured");

        state = PresaleState.Active;
        emit PresaleStarted(block.timestamp);
    }

    function setFundingGoal(uint256 newGoalWei) external onlyOwner {
        require(state == PresaleState.Configuring, "Presale: not configuring");
        fundingGoalWei = newGoalWei;
    }

    // ------------------------------------------------------------------
    // Contribution
    // ------------------------------------------------------------------

    /**
     * @notice Contribute ETH to the current active phase. Automatically
     *         splits a contribution across phase boundaries if it would
     *         overflow the current phase's remaining cap, advancing to
     *         subsequent phases as needed within the same transaction.
     */
    function contribute() external payable nonReentrant whenNotPaused {
        require(state == PresaleState.Active, "Presale: not active");
        require(msg.value > 0, "Presale: must send ETH");

        uint256 remaining = msg.value;
        uint256 tokensAllocated = 0;

        while (remaining > 0) {
            require(currentPhaseIndex < phases.length, "Presale: all phases filled, reduce contribution");

            Phase storage phase = phases[currentPhaseIndex];
            uint256 phaseRemainingCap = phase.capWei - phase.raisedWei;

            uint256 weiForThisPhase = remaining > phaseRemainingCap ? phaseRemainingCap : remaining;

            if (weiForThisPhase > 0) {
                uint256 tokensForThisPhase = (weiForThisPhase * 1e18) / phase.priceWeiPerToken;

                phase.raisedWei += weiForThisPhase;
                totalRaisedWei += weiForThisPhase;
                tokensAllocated += tokensForThisPhase;

                emit Contributed(msg.sender, currentPhaseIndex, weiForThisPhase, tokensForThisPhase);

                remaining -= weiForThisPhase;
            }

            if (phase.raisedWei >= phase.capWei) {
                uint256 fromPhase = currentPhaseIndex;
                if (currentPhaseIndex + 1 < phases.length) {
                    currentPhaseIndex += 1;
                    emit PhaseAdvanced(fromPhase, currentPhaseIndex);
                } else {
                    require(remaining == 0, "Presale: exceeds remaining presale capacity");
                    break;
                }
            } else {
                // Current phase still has room but we've spent all `remaining` — done.
                break;
            }
        }

        if (!_isKnownContributor[msg.sender]) {
            _isKnownContributor[msg.sender] = true;
            contributors.push(msg.sender);
        }

        contributionsWei[msg.sender] += msg.value;
        tokenAllocations[msg.sender] += tokensAllocated;
        totalTokensSold += tokensAllocated;
    }

    // ------------------------------------------------------------------
    // Owner: token custody + finalize/cancel
    // ------------------------------------------------------------------

    /**
     * @notice Deposit $PWR into this contract to back contributor claims.
     *         Requires the owner to have called `approve()` on the $PWR
     *         token for this contract beforehand.
     */
    function depositTokensForClaims(uint256 amount) external onlyOwner {
        require(amount > 0, "Presale: amount must be > 0");
        bool ok = pwrToken.transferFrom(msg.sender, address(this), amount);
        require(ok, "Presale: token transfer failed");
        tokensDepositedForClaims += amount;
        emit TokensDeposited(msg.sender, amount);
    }

    /**
     * @notice Lock the raise and open claims. Requires enough $PWR to have
     *         already been deposited to cover `totalTokensSold`.
     */
    function finalize() external onlyOwner {
        require(state == PresaleState.Active, "Presale: not active");
        require(tokensDepositedForClaims >= totalTokensSold, "Presale: insufficient tokens deposited");

        state = PresaleState.Finalized;
        emit PresaleFinalized(totalRaisedWei, totalTokensSold);
    }

    /**
     * @notice Cancel the presale before finalization, enabling refunds.
     */
    function cancelPresale() external onlyOwner {
        require(state == PresaleState.Active || state == PresaleState.Configuring, "Presale: cannot cancel now");
        state = PresaleState.Cancelled;
        emit PresaleCancelled(block.timestamp);
    }

    /**
     * @notice Sweep raised ETH to a recipient. Only available once finalized.
     */
    function withdrawRaisedFunds(address payable to) external onlyOwner nonReentrant {
        require(state == PresaleState.Finalized, "Presale: not finalized");
        require(to != address(0), "Presale: zero address recipient");

        uint256 amount = address(this).balance;
        require(amount > 0, "Presale: nothing to withdraw");

        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Presale: ETH transfer failed");

        emit FundsWithdrawn(to, amount);
    }

    /**
     * @notice Recover any $PWR left over after all claims (e.g. rounding
     *         dust), only once finalized.
     */
    function recoverUnclaimedTokens(address to, uint256 amount) external onlyOwner {
        require(state == PresaleState.Finalized, "Presale: not finalized");
        require(to != address(0), "Presale: zero address recipient");
        bool ok = pwrToken.transfer(to, amount);
        require(ok, "Presale: token transfer failed");
    }

    // ------------------------------------------------------------------
    // Contributor actions
    // ------------------------------------------------------------------

    /**
     * @notice Claim your $PWR allocation after the presale is finalized.
     */
    function claim() external nonReentrant {
        require(state == PresaleState.Finalized, "Presale: not finalized");
        require(!hasClaimed[msg.sender], "Presale: already claimed");

        uint256 amount = tokenAllocations[msg.sender];
        require(amount > 0, "Presale: no allocation");

        hasClaimed[msg.sender] = true;

        bool ok = pwrToken.transfer(msg.sender, amount);
        require(ok, "Presale: token transfer failed");

        emit Claimed(msg.sender, amount);
    }

    /**
     * @notice Withdraw your contributed ETH back if the presale was cancelled.
     */
    function claimRefund() external nonReentrant {
        require(state == PresaleState.Cancelled, "Presale: not cancelled");

        uint256 amount = contributionsWei[msg.sender];
        require(amount > 0, "Presale: no contribution to refund");

        contributionsWei[msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Presale: ETH refund failed");

        emit Refunded(msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function phaseCount() external view returns (uint256) {
        return phases.length;
    }

    function contributorCount() external view returns (uint256) {
        return contributors.length;
    }

    function currentPhase() external view returns (uint256 priceWeiPerToken, uint256 capWei, uint256 raisedWei, uint256 index) {
        if (currentPhaseIndex >= phases.length) {
            return (0, 0, 0, currentPhaseIndex);
        }
        Phase storage phase = phases[currentPhaseIndex];
        return (phase.priceWeiPerToken, phase.capWei, phase.raisedWei, currentPhaseIndex);
    }

    function progressBps() external view returns (uint256) {
        if (fundingGoalWei == 0) return 0;
        uint256 raised = totalRaisedWei;
        if (raised >= fundingGoalWei) return 10_000;
        return (raised * 10_000) / fundingGoalWei;
    }

    receive() external payable {
        revert("Presale: use contribute()");
    }
}
