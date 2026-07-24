// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./common/PowerComputeBase.sol";

/**
 * @title NodeRegistry
 * @author PowerCompute Protocol
 * @notice On-chain registry of GPU compute nodes participating in the
 *         PowerCompute network, plus the Proof-of-Energy-Consumption (PoEC)
 *         reward pipeline:
 *
 *         1. Operator registers a node (`registerNode`) describing its
 *            GPU hardware and renewable energy site.
 *         2. An approved oracle/admin verifies the node (`verifyNode`) after
 *            off-chain KYC/hardware attestation, activating it.
 *         3. Operators periodically submit signed energy-routing reports
 *            (`submitEnergyProof`) claiming kWh of curtailed green energy
 *            routed into AI compute during a reporting period.
 *         4. An approved oracle/admin approves the report
 *            (`approveEnergyProof`), which mints $PWR rewards directly to
 *            the operator via `PowerComputeToken.mintReward` and updates
 *            protocol-wide telemetry (`totalEnergyRoutedKwh`,
 *            `totalActiveNodes`).
 *
 *         This contract must be added as an approved minter on the deployed
 *         PowerComputeToken via `PowerComputeToken.setMinter(nodeRegistryAddress, true)`.
 */
contract NodeRegistry is Ownable, Pausable, ReentrancyGuard {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum NodeStatus {
        Pending,   // registered, awaiting verification
        Active,    // verified and eligible to submit energy proofs
        Suspended, // temporarily disabled by admin
        Retired    // permanently decommissioned by operator or admin
    }

    struct Node {
        address operator;
        string gpuModel;      // e.g. "NVIDIA H100 80GB"
        uint16 gpuCount;      // number of GPUs in this node cluster
        string energySiteId;  // off-chain identifier for the renewable energy site
        string region;        // human-readable region/country label
        NodeStatus status;
        uint256 registeredAt;
        uint256 totalEnergyRoutedKwh;
        uint256 totalRewardsEarned;
        uint256 lastProofTimestamp;
    }

    struct EnergyProof {
        uint256 nodeId;
        address operator;
        uint256 kWhRouted;
        uint256 periodStart;
        uint256 periodEnd;
        bool approved;
        bool rejected;
        uint256 rewardMinted;
        uint256 submittedAt;
        uint256 resolvedAt;
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    IPowerComputeMintable public immutable pwrToken;

    uint256 public nextNodeId = 1;
    uint256 public nextProofId = 1;

    mapping(uint256 => Node) public nodes;
    mapping(uint256 => EnergyProof) public energyProofs;
    mapping(address => uint256[]) public nodesByOperator;
    mapping(address => bool) public oracles;

    uint256 public totalActiveNodes;
    uint256 public totalEnergyRoutedKwh;
    uint256 public totalRewardsMinted;

    /// @notice Reward emission rate, expressed in wei of $PWR per kWh routed.
    uint256 public rewardPerKwh = 420_000_000_000_000; // 0.00042 $PWR per kWh (18 decimals)

    /// @notice Maximum kWh a single proof may claim, to bound oracle-approved mint size.
    uint256 public maxKwhPerProof = 500_000;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event NodeRegistered(uint256 indexed nodeId, address indexed operator, string gpuModel, uint16 gpuCount, string energySiteId, string region);
    event NodeVerified(uint256 indexed nodeId, address indexed verifier);
    event NodeStatusChanged(uint256 indexed nodeId, NodeStatus oldStatus, NodeStatus newStatus);
    event EnergyProofSubmitted(uint256 indexed proofId, uint256 indexed nodeId, address indexed operator, uint256 kWhRouted, uint256 periodStart, uint256 periodEnd);
    event EnergyProofApproved(uint256 indexed proofId, uint256 indexed nodeId, address indexed operator, uint256 rewardMinted);
    event EnergyProofRejected(uint256 indexed proofId, uint256 indexed nodeId, string reason);
    event OracleUpdated(address indexed oracle, bool allowed);
    event RewardPerKwhUpdated(uint256 oldRate, uint256 newRate);
    event MaxKwhPerProofUpdated(uint256 oldMax, uint256 newMax);

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier onlyOracleOrOwner() {
        require(oracles[msg.sender] || msg.sender == owner(), "NodeRegistry: caller is not an oracle or owner");
        _;
    }

    modifier onlyNodeOperator(uint256 nodeId) {
        require(nodes[nodeId].operator == msg.sender, "NodeRegistry: caller is not the node operator");
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address pwrTokenAddress, address initialOwner) Ownable(initialOwner) {
        require(pwrTokenAddress != address(0), "NodeRegistry: zero token address");
        pwrToken = IPowerComputeMintable(pwrTokenAddress);
        oracles[initialOwner] = true;
        emit OracleUpdated(initialOwner, true);
    }

    // ------------------------------------------------------------------
    // Node lifecycle
    // ------------------------------------------------------------------

    /**
     * @notice Register a new GPU compute node. Starts in `Pending` status
     *         until an oracle/admin verifies it via `verifyNode`.
     */
    function registerNode(
        string calldata gpuModel,
        uint16 gpuCount,
        string calldata energySiteId,
        string calldata region
    ) external whenNotPaused returns (uint256 nodeId) {
        require(gpuCount > 0, "NodeRegistry: gpuCount must be > 0");
        require(bytes(gpuModel).length > 0, "NodeRegistry: gpuModel required");
        require(bytes(energySiteId).length > 0, "NodeRegistry: energySiteId required");

        nodeId = nextNodeId++;

        nodes[nodeId] = Node({
            operator: msg.sender,
            gpuModel: gpuModel,
            gpuCount: gpuCount,
            energySiteId: energySiteId,
            region: region,
            status: NodeStatus.Pending,
            registeredAt: block.timestamp,
            totalEnergyRoutedKwh: 0,
            totalRewardsEarned: 0,
            lastProofTimestamp: 0
        });

        nodesByOperator[msg.sender].push(nodeId);

        emit NodeRegistered(nodeId, msg.sender, gpuModel, gpuCount, energySiteId, region);
    }

    /**
     * @notice Verify a pending node, activating it for energy-proof submissions.
     */
    function verifyNode(uint256 nodeId) external onlyOracleOrOwner {
        Node storage node = nodes[nodeId];
        require(node.operator != address(0), "NodeRegistry: node does not exist");
        require(node.status == NodeStatus.Pending, "NodeRegistry: node not pending");

        node.status = NodeStatus.Active;
        totalActiveNodes += 1;

        emit NodeVerified(nodeId, msg.sender);
        emit NodeStatusChanged(nodeId, NodeStatus.Pending, NodeStatus.Active);
    }

    /**
     * @notice Suspend an active node (e.g. failed re-attestation, fraud report).
     */
    function suspendNode(uint256 nodeId) external onlyOracleOrOwner {
        Node storage node = nodes[nodeId];
        require(node.status == NodeStatus.Active, "NodeRegistry: node not active");

        node.status = NodeStatus.Suspended;
        totalActiveNodes -= 1;

        emit NodeStatusChanged(nodeId, NodeStatus.Active, NodeStatus.Suspended);
    }

    /**
     * @notice Reinstate a previously suspended node.
     */
    function reinstateNode(uint256 nodeId) external onlyOracleOrOwner {
        Node storage node = nodes[nodeId];
        require(node.status == NodeStatus.Suspended, "NodeRegistry: node not suspended");

        node.status = NodeStatus.Active;
        totalActiveNodes += 1;

        emit NodeStatusChanged(nodeId, NodeStatus.Suspended, NodeStatus.Active);
    }

    /**
     * @notice Permanently retire a node. Callable by the operator themselves
     *         or by an oracle/admin.
     */
    function retireNode(uint256 nodeId) external {
        Node storage node = nodes[nodeId];
        require(node.operator != address(0), "NodeRegistry: node does not exist");
        require(
            msg.sender == node.operator || oracles[msg.sender] || msg.sender == owner(),
            "NodeRegistry: not authorized"
        );
        require(node.status != NodeStatus.Retired, "NodeRegistry: already retired");

        NodeStatus previous = node.status;
        if (previous == NodeStatus.Active) {
            totalActiveNodes -= 1;
        }
        node.status = NodeStatus.Retired;

        emit NodeStatusChanged(nodeId, previous, NodeStatus.Retired);
    }

    // ------------------------------------------------------------------
    // Proof-of-Energy-Consumption (PoEC) reward pipeline
    // ------------------------------------------------------------------

    /**
     * @notice Submit a claim of kWh routed from curtailed renewable energy
     *         into AI compute during [periodStart, periodEnd]. Pending
     *         oracle/admin approval before rewards are minted.
     */
    function submitEnergyProof(
        uint256 nodeId,
        uint256 kWhRouted,
        uint256 periodStart,
        uint256 periodEnd
    ) external onlyNodeOperator(nodeId) whenNotPaused returns (uint256 proofId) {
        Node storage node = nodes[nodeId];
        require(node.status == NodeStatus.Active, "NodeRegistry: node not active");
        require(kWhRouted > 0 && kWhRouted <= maxKwhPerProof, "NodeRegistry: kWhRouted out of bounds");
        require(periodEnd > periodStart, "NodeRegistry: invalid period");
        require(periodEnd <= block.timestamp, "NodeRegistry: period end in future");

        proofId = nextProofId++;

        energyProofs[proofId] = EnergyProof({
            nodeId: nodeId,
            operator: msg.sender,
            kWhRouted: kWhRouted,
            periodStart: periodStart,
            periodEnd: periodEnd,
            approved: false,
            rejected: false,
            rewardMinted: 0,
            submittedAt: block.timestamp,
            resolvedAt: 0
        });

        emit EnergyProofSubmitted(proofId, nodeId, msg.sender, kWhRouted, periodStart, periodEnd);
    }

    /**
     * @notice Approve a submitted energy proof, minting $PWR rewards to the
     *         node operator at the current `rewardPerKwh` rate.
     */
    function approveEnergyProof(uint256 proofId) external onlyOracleOrOwner nonReentrant {
        EnergyProof storage proof = energyProofs[proofId];
        require(proof.operator != address(0), "NodeRegistry: proof does not exist");
        require(!proof.approved && !proof.rejected, "NodeRegistry: proof already resolved");

        Node storage node = nodes[proof.nodeId];
        require(node.status == NodeStatus.Active, "NodeRegistry: node not active");

        uint256 reward = proof.kWhRouted * rewardPerKwh;

        proof.approved = true;
        proof.rewardMinted = reward;
        proof.resolvedAt = block.timestamp;

        node.totalEnergyRoutedKwh += proof.kWhRouted;
        node.totalRewardsEarned += reward;
        node.lastProofTimestamp = block.timestamp;

        totalEnergyRoutedKwh += proof.kWhRouted;
        totalRewardsMinted += reward;

        pwrToken.mintReward(proof.operator, reward);

        emit EnergyProofApproved(proofId, proof.nodeId, proof.operator, reward);
    }

    /**
     * @notice Reject a submitted energy proof (e.g. failed off-chain meter
     *         cross-check), with a human-readable reason recorded on-chain.
     */
    function rejectEnergyProof(uint256 proofId, string calldata reason) external onlyOracleOrOwner {
        EnergyProof storage proof = energyProofs[proofId];
        require(proof.operator != address(0), "NodeRegistry: proof does not exist");
        require(!proof.approved && !proof.rejected, "NodeRegistry: proof already resolved");

        proof.rejected = true;
        proof.resolvedAt = block.timestamp;

        emit EnergyProofRejected(proofId, proof.nodeId, reason);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function getNodesByOperator(address operatorAddr) external view returns (uint256[] memory) {
        return nodesByOperator[operatorAddr];
    }

    function getNode(uint256 nodeId) external view returns (Node memory) {
        return nodes[nodeId];
    }

    function getEnergyProof(uint256 proofId) external view returns (EnergyProof memory) {
        return energyProofs[proofId];
    }

    // ------------------------------------------------------------------
    // Owner administration
    // ------------------------------------------------------------------

    function setOracle(address oracleAddr, bool allowed) external onlyOwner {
        require(oracleAddr != address(0), "NodeRegistry: zero address oracle");
        oracles[oracleAddr] = allowed;
        emit OracleUpdated(oracleAddr, allowed);
    }

    function setRewardPerKwh(uint256 newRate) external onlyOwner {
        emit RewardPerKwhUpdated(rewardPerKwh, newRate);
        rewardPerKwh = newRate;
    }

    function setMaxKwhPerProof(uint256 newMax) external onlyOwner {
        require(newMax > 0, "NodeRegistry: max must be > 0");
        emit MaxKwhPerProofUpdated(maxKwhPerProof, newMax);
        maxKwhPerProof = newMax;
    }

    // ------------------------------------------------------------------
    // Batch operations (bulk admin actions — avoid one-tx-per-item once
    // there are more than a handful of pending nodes/proofs to review)
    // ------------------------------------------------------------------

    /**
     * @notice Verify multiple pending nodes in a single transaction. Any
     *         individual node that is not in `Pending` status is skipped
     *         (rather than reverting the whole batch) so one stale entry
     *         in a batch selected client-side doesn't block the rest.
     * @return verifiedCount Number of nodes actually verified by this call.
     */
    function batchVerifyNodes(uint256[] calldata nodeIds) external onlyOracleOrOwner returns (uint256 verifiedCount) {
        for (uint256 i = 0; i < nodeIds.length; i++) {
            Node storage node = nodes[nodeIds[i]];
            if (node.operator != address(0) && node.status == NodeStatus.Pending) {
                node.status = NodeStatus.Active;
                totalActiveNodes += 1;
                verifiedCount += 1;

                emit NodeVerified(nodeIds[i], msg.sender);
                emit NodeStatusChanged(nodeIds[i], NodeStatus.Pending, NodeStatus.Active);
            }
        }
    }

    /**
     * @notice Approve multiple energy proofs in a single transaction.
     *         Proofs that are already resolved or whose node is not
     *         Active are skipped rather than reverting the whole batch.
     * @return approvedCount Number of proofs actually approved by this call.
     */
    function batchApproveEnergyProofs(uint256[] calldata proofIds) external onlyOracleOrOwner nonReentrant returns (uint256 approvedCount) {
        for (uint256 i = 0; i < proofIds.length; i++) {
            EnergyProof storage proof = energyProofs[proofIds[i]];

            if (proof.operator == address(0) || proof.approved || proof.rejected) {
                continue;
            }

            Node storage node = nodes[proof.nodeId];
            if (node.status != NodeStatus.Active) {
                continue;
            }

            uint256 reward = proof.kWhRouted * rewardPerKwh;

            proof.approved = true;
            proof.rewardMinted = reward;
            proof.resolvedAt = block.timestamp;

            node.totalEnergyRoutedKwh += proof.kWhRouted;
            node.totalRewardsEarned += reward;
            node.lastProofTimestamp = block.timestamp;

            totalEnergyRoutedKwh += proof.kWhRouted;
            totalRewardsMinted += reward;

            pwrToken.mintReward(proof.operator, reward);

            emit EnergyProofApproved(proofIds[i], proof.nodeId, proof.operator, reward);
            approvedCount += 1;
        }
    }
}
