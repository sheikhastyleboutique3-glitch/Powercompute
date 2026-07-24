// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./common/PowerComputeBase.sol";

/**
 * @title PowerComputeTimelock
 * @author PowerCompute Protocol
 * @notice A minimal timelock controller. Transfer ownership of
 *         PowerComputeToken / NodeRegistry / PowerComputePresale /
 *         PowerComputeAnnouncements to an instance of this contract (owned
 *         by your multisig) so that every sensitive owner-only call —
 *         `mint()`, `withdrawRaisedFunds()`, `setRewardRatePerSecond()`,
 *         etc. — must be queued and wait out a public delay before it can
 *         execute. This gives contributors/community visibility and a
 *         chance to react before any privileged action takes effect.
 *
 * Recommended setup:
 *   1. Deploy a Gnosis Safe (2-of-3 or 3-of-5) as your team multisig.
 *   2. Deploy this contract with `admin = <your Safe address>` and a
 *      `delaySeconds` of at least 86400 (24h), ideally 172800 (48h).
 *   3. Call `transferOwnership(timelockAddress)` on each of the 4 other
 *      protocol contracts from the deployer wallet.
 *   4. From then on, every owner-only action on those contracts must go
 *      through `queueTransaction` -> wait `delaySeconds` -> `executeTransaction`,
 *      all initiated by the Safe (multisig-approved) rather than a single key.
 *
 * This is intentionally simple (no upgradability, no batching) so it is
 * easy to reason about and audit on a $0 budget.
 */
contract PowerComputeTimelock {
    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    address public admin;
    address public pendingAdmin;

    uint256 public delaySeconds;
    uint256 public constant MIN_DELAY = 1 hours;
    uint256 public constant MAX_DELAY = 30 days;
    uint256 public constant GRACE_PERIOD = 14 days;

    mapping(bytes32 => bool) public queuedTransactions;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event QueueTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);
    event CancelTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);
    event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);
    event NewAdmin(address indexed newAdmin);
    event NewPendingAdmin(address indexed newPendingAdmin);
    event NewDelay(uint256 newDelay);

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier onlyAdmin() {
        require(msg.sender == admin, "Timelock: caller is not the admin");
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address admin_, uint256 delaySeconds_) {
        require(admin_ != address(0), "Timelock: zero address admin");
        require(delaySeconds_ >= MIN_DELAY && delaySeconds_ <= MAX_DELAY, "Timelock: delay out of bounds");

        admin = admin_;
        delaySeconds = delaySeconds_;

        emit NewAdmin(admin_);
        emit NewDelay(delaySeconds_);
    }

    // ------------------------------------------------------------------
    // Admin transfer (two-step, so a typo can never brick the timelock)
    // ------------------------------------------------------------------

    function setPendingAdmin(address newPendingAdmin) external onlyAdmin {
        require(newPendingAdmin != address(0), "Timelock: zero address pending admin");
        pendingAdmin = newPendingAdmin;
        emit NewPendingAdmin(newPendingAdmin);
    }

    function acceptAdmin() external {
        require(msg.sender == pendingAdmin, "Timelock: caller is not the pending admin");
        admin = pendingAdmin;
        pendingAdmin = address(0);
        emit NewAdmin(admin);
    }

    /**
     * @notice Change the delay itself. Like everything else, this must be
     *         queued and go through the delay — the timelock cannot
     *         instantly shorten its own protection.
     */
    function setDelay(uint256 newDelaySeconds) external {
        require(msg.sender == address(this), "Timelock: setDelay must be called via queued self-call");
        require(newDelaySeconds >= MIN_DELAY && newDelaySeconds <= MAX_DELAY, "Timelock: delay out of bounds");
        delaySeconds = newDelaySeconds;
        emit NewDelay(newDelaySeconds);
    }

    // ------------------------------------------------------------------
    // Queue / cancel / execute
    // ------------------------------------------------------------------

    function queueTransaction(address target, uint256 value, bytes calldata data, uint256 eta)
        external
        onlyAdmin
        returns (bytes32 txHash)
    {
        require(target != address(0), "Timelock: zero address target");
        require(eta >= block.timestamp + delaySeconds, "Timelock: eta must satisfy delay");

        txHash = keccak256(abi.encode(target, value, data, eta));
        queuedTransactions[txHash] = true;

        emit QueueTransaction(txHash, target, value, data, eta);
    }

    function cancelTransaction(address target, uint256 value, bytes calldata data, uint256 eta) external onlyAdmin {
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        require(queuedTransactions[txHash], "Timelock: transaction not queued");

        queuedTransactions[txHash] = false;

        emit CancelTransaction(txHash, target, value, data, eta);
    }

    /**
     * @notice Execute a previously queued transaction once its `eta` has
     *         passed. Reverts if called too early or after the grace
     *         period expires (stale queued transactions must be re-queued).
     */
    function executeTransaction(address target, uint256 value, bytes calldata data, uint256 eta)
        external
        payable
        onlyAdmin
        returns (bytes memory returnData)
    {
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        require(queuedTransactions[txHash], "Timelock: transaction not queued");
        require(block.timestamp >= eta, "Timelock: eta not yet reached");
        require(block.timestamp <= eta + GRACE_PERIOD, "Timelock: transaction is stale");

        queuedTransactions[txHash] = false;

        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Timelock: underlying transaction reverted");

        emit ExecuteTransaction(txHash, target, value, data, eta);
        return result;
    }

    /**
     * @notice Convenience view: compute the txHash for a given call without
     *         queuing it, so the frontend can check `queuedTransactions[hash]`.
     */
    function computeTxHash(address target, uint256 value, bytes calldata data, uint256 eta) external pure returns (bytes32) {
        return keccak256(abi.encode(target, value, data, eta));
    }

    receive() external payable {}
}
