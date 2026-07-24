// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./common/PowerComputeBase.sol";

/**
 * @title PowerComputeVesting
 * @author PowerCompute Protocol
 * @notice Makes the tokenomics slide's promise ("24-month linear, 6-month
 *         cliff" for team/advisor allocations) an on-chain reality instead
 *         of a marketing claim. The owner creates a vesting schedule for a
 *         beneficiary, transfers/mints the vested amount of $PWR into this
 *         contract to back it, and the beneficiary calls `release()` over
 *         time to draw down whatever has vested so far.
 *
 * Mechanics:
 *  - Each beneficiary has at most ONE active schedule (call
 *    `createVestingSchedule` again after a full release to start a new one).
 *  - Nothing is releasable before `cliffSeconds` has elapsed from `startTime`.
 *  - After the cliff, the vested amount grows linearly from 0 to
 *    `totalAmount` over `durationSeconds` (measured from `startTime`, not
 *    from the cliff end) until `startTime + durationSeconds`, at which
 *    point 100% is vested.
 *  - `revocable` schedules can be cancelled by the owner (e.g. an advisor
 *    who leaves early) — already-vested-but-unreleased tokens remain
 *    claimable by the beneficiary, but any not-yet-vested remainder is
 *    swept back to the owner.
 */
contract PowerComputeVesting is Ownable, ReentrancyGuard {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    struct VestingSchedule {
        uint256 totalAmount;    // total $PWR allocated to this schedule
        uint256 released;       // amount already released to the beneficiary
        uint256 startTime;      // vesting start timestamp
        uint256 cliffSeconds;   // seconds after startTime before anything vests
        uint256 durationSeconds;// total vesting duration from startTime
        bool revocable;         // whether the owner can revoke this schedule
        bool revoked;           // whether it has been revoked
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    IERC20 public immutable pwrToken;

    mapping(address => VestingSchedule) public schedules;
    address[] public beneficiaries;
    mapping(address => bool) private _isKnownBeneficiary;

    uint256 public totalAllocated;
    uint256 public totalReleased;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event ScheduleCreated(address indexed beneficiary, uint256 totalAmount, uint256 startTime, uint256 cliffSeconds, uint256 durationSeconds, bool revocable);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event ScheduleRevoked(address indexed beneficiary, uint256 vestedAndKept, uint256 unvestedReturned);

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address pwrTokenAddress, address initialOwner) Ownable(initialOwner) {
        require(pwrTokenAddress != address(0), "Vesting: zero token address");
        pwrToken = IERC20(pwrTokenAddress);
    }

    // ------------------------------------------------------------------
    // Owner: create / revoke schedules
    // ------------------------------------------------------------------

    /**
     * @notice Create a new vesting schedule for `beneficiary`. The caller
     *         must have already `approve()`'d this contract for at least
     *         `totalAmount` of $PWR — this function pulls the tokens in
     *         immediately so the schedule is always fully funded.
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffSeconds,
        uint256 durationSeconds,
        bool revocable
    ) external onlyOwner {
        require(beneficiary != address(0), "Vesting: zero address beneficiary");
        require(totalAmount > 0, "Vesting: amount must be > 0");
        require(durationSeconds > 0, "Vesting: duration must be > 0");
        require(cliffSeconds <= durationSeconds, "Vesting: cliff cannot exceed duration");

        // Audit fix (finding #3): the old condition allowed a new schedule
        // to overwrite an old one as long as it was EITHER fully released
        // OR revoked — but a revoked schedule can still have vested-but-
        // unreleased tokens sitting in it (revoke() only returns the
        // UNVESTED remainder to the owner; the vested portion stays
        // claimable by the beneficiary via release()). Overwriting that
        // struct would silently orphan those already-vested tokens with
        // no function left able to reference them. The fix requires
        // `released >= totalAmount` unconditionally — i.e. the
        // beneficiary must have actually withdrawn everything they were
        // ever owed, revoked or not, before a new schedule can start.
        VestingSchedule storage existing = schedules[beneficiary];
        require(
            existing.totalAmount == 0 || existing.released >= existing.totalAmount,
            "Vesting: beneficiary has unreleased tokens on an existing schedule"
        );

        bool ok = pwrToken.transferFrom(msg.sender, address(this), totalAmount);
        require(ok, "Vesting: token transfer failed");

        schedules[beneficiary] = VestingSchedule({
            totalAmount: totalAmount,
            released: 0,
            startTime: startTime,
            cliffSeconds: cliffSeconds,
            durationSeconds: durationSeconds,
            revocable: revocable,
            revoked: false
        });

        if (!_isKnownBeneficiary[beneficiary]) {
            _isKnownBeneficiary[beneficiary] = true;
            beneficiaries.push(beneficiary);
        }

        totalAllocated += totalAmount;

        emit ScheduleCreated(beneficiary, totalAmount, startTime, cliffSeconds, durationSeconds, revocable);
    }

    /**
     * @notice Revoke a revocable schedule. The beneficiary keeps whatever
     *         has already vested (claimable via `release()`); any
     *         unvested remainder is transferred back to the owner
     *         immediately.
     */
    function revoke(address beneficiary) external onlyOwner nonReentrant {
        VestingSchedule storage schedule = schedules[beneficiary];
        require(schedule.totalAmount > 0, "Vesting: no schedule for beneficiary");
        require(schedule.revocable, "Vesting: schedule is not revocable");
        require(!schedule.revoked, "Vesting: already revoked");

        uint256 vested = _vestedAmount(schedule);
        uint256 unvested = schedule.totalAmount - vested;

        schedule.revoked = true;
        schedule.totalAmount = vested; // cap future vesting at what's already vested

        if (unvested > 0) {
            bool ok = pwrToken.transfer(owner(), unvested);
            require(ok, "Vesting: token transfer failed");
        }

        emit ScheduleRevoked(beneficiary, vested, unvested);
    }

    // ------------------------------------------------------------------
    // Beneficiary: release vested tokens
    // ------------------------------------------------------------------

    /**
     * @notice Release whatever portion of the caller's schedule has vested
     *         but not yet been released.
     */
    function release() external nonReentrant {
        VestingSchedule storage schedule = schedules[msg.sender];
        require(schedule.totalAmount > 0, "Vesting: no schedule for caller");

        uint256 releasable = _releasableAmount(schedule);
        require(releasable > 0, "Vesting: nothing releasable yet");

        schedule.released += releasable;
        totalReleased += releasable;

        bool ok = pwrToken.transfer(msg.sender, releasable);
        require(ok, "Vesting: token transfer failed");

        emit TokensReleased(msg.sender, releasable);
    }

    // ------------------------------------------------------------------
    // Internal vesting math
    // ------------------------------------------------------------------

    function _vestedAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        // Once revoked, `totalAmount` has already been frozen at exactly the
        // amount that was vested at the moment of revocation (see `revoke`).
        // Returning it directly — instead of re-running the linear formula
        // below against the *original* duration — avoids the vested amount
        // ever appearing to decrease after a revoke, which would otherwise
        // make `release()` underflow-revert for anyone who had already
        // claimed up to the pre-revoke vested amount.
        if (schedule.revoked) {
            return schedule.totalAmount;
        }
        if (block.timestamp < schedule.startTime + schedule.cliffSeconds) {
            return 0;
        }
        if (block.timestamp >= schedule.startTime + schedule.durationSeconds) {
            return schedule.totalAmount;
        }
        uint256 elapsed = block.timestamp - schedule.startTime;
        return (schedule.totalAmount * elapsed) / schedule.durationSeconds;
    }

    function _releasableAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        return _vestedAmount(schedule) - schedule.released;
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function vestedAmountOf(address beneficiary) external view returns (uint256) {
        VestingSchedule storage schedule = schedules[beneficiary];
        if (schedule.totalAmount == 0) return 0;
        return _vestedAmount(schedule);
    }

    function releasableAmountOf(address beneficiary) external view returns (uint256) {
        VestingSchedule storage schedule = schedules[beneficiary];
        if (schedule.totalAmount == 0) return 0;
        return _releasableAmount(schedule);
    }

    function getSchedule(address beneficiary) external view returns (VestingSchedule memory) {
        return schedules[beneficiary];
    }

    function beneficiaryCount() external view returns (uint256) {
        return beneficiaries.length;
    }
}
