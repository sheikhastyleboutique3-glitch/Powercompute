// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./common/PowerComputeBase.sol";

/**
 * @dev Minimal read-only interface into PowerComputeToken's staking state —
 *      voting power in this governor is exactly "how much $PWR you have
 *      staked", which both rewards long-term alignment and reuses state
 *      that already exists on-chain (no separate snapshot/delegation
 *      system needed for a v1 advisory governor).
 */
interface IPowerComputeStakeReader {
    function stakedBalanceOf(address user) external view returns (uint256);
    function totalStaked() external view returns (uint256);
}

/**
 * @title PowerComputeGovernor
 * @author PowerCompute Protocol
 * @notice Lightweight, stake-weighted on-chain voting so $PWR staking has
 *         real governance utility (as promised in the roadmap's "Q2:
 *         governance activation" milestone) without pulling in a full
 *         OpenZeppelin Governor + timelock + token-snapshot stack.
 *
 *         v1 is intentionally "advisory": passing a proposal only flips its
 *         `executed` flag and emits an event recording the team's
 *         commitment to act on it — it does NOT automatically call into
 *         other contracts. This keeps the trust model simple and auditable:
 *         the community signals its will on-chain, and the (ideally
 *         timelocked, ideally multisig) owner of the other contracts
 *         follows through manually. A fully executable governor can be
 *         layered on top later once the DAO is ready to hold real
 *         execution rights (see the Q4 roadmap milestone).
 *
 * Voting power = `PowerComputeToken.stakedBalanceOf(voter)` at the moment
 * of voting (not a historical snapshot — simple, but means voting power
 * can change between proposal creation and a given vote; fine for an
 * advisory v1 governor on a testnet-scale community).
 */
contract PowerComputeGovernor is Ownable {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum ProposalState {
        Pending,  // voting has not started yet
        Active,   // voting is open
        Defeated, // voting ended, quorum not met or against >= for
        Succeeded,// voting ended, quorum met and for > against
        Executed  // owner has marked this proposal as acted upon
    }

    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool executed;
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    IPowerComputeStakeReader public immutable stakeToken;

    uint256 public nextProposalId = 1;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @notice Minimum staked $PWR required to create a proposal.
    uint256 public proposalThreshold;

    /// @notice Voting period length in seconds for new proposals.
    uint256 public votingPeriodSeconds = 3 days;

    /// @notice Minimum total votes (for + against + abstain) required for a
    ///         proposal to be eligible to succeed, expressed in basis points
    ///         of `totalStaked` at the time `finalize()` is called.
    uint256 public quorumBps = 500; // 5%

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title, uint256 startTime, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event VotingPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event QuorumUpdated(uint256 oldQuorumBps, uint256 newQuorumBps);

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address stakeTokenAddress, uint256 proposalThreshold_, address initialOwner) Ownable(initialOwner) {
        require(stakeTokenAddress != address(0), "Governor: zero token address");
        stakeToken = IPowerComputeStakeReader(stakeTokenAddress);
        proposalThreshold = proposalThreshold_;
    }

    // ------------------------------------------------------------------
    // Proposal lifecycle
    // ------------------------------------------------------------------

    /**
     * @notice Create a new proposal. Requires the caller to have at least
     *         `proposalThreshold` $PWR staked at the time of creation.
     */
    function propose(string calldata title, string calldata description) external returns (uint256 proposalId) {
        require(bytes(title).length > 0, "Governor: title required");
        require(stakeToken.stakedBalanceOf(msg.sender) >= proposalThreshold, "Governor: insufficient staked balance to propose");

        proposalId = nextProposalId++;

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + votingPeriodSeconds;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            title: title,
            description: description,
            startTime: startTime,
            endTime: endTime,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            executed: false
        });

        emit ProposalCreated(proposalId, msg.sender, title, startTime, endTime);
    }

    /**
     * @notice Cast a vote on an active proposal. `support`: 0 = against,
     *         1 = for, 2 = abstain. Voting weight is the caller's currently
     *         staked $PWR balance.
     */
    function castVote(uint256 proposalId, uint8 support) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposer != address(0), "Governor: proposal does not exist");
        require(block.timestamp >= proposal.startTime, "Governor: voting not started");
        require(block.timestamp <= proposal.endTime, "Governor: voting closed");
        require(!hasVoted[proposalId][msg.sender], "Governor: already voted");
        require(support <= 2, "Governor: invalid support value");

        uint256 weight = stakeToken.stakedBalanceOf(msg.sender);
        require(weight > 0, "Governor: no staked balance, no voting power");

        hasVoted[proposalId][msg.sender] = true;

        if (support == 0) {
            proposal.againstVotes += weight;
        } else if (support == 1) {
            proposal.forVotes += weight;
        } else {
            proposal.abstainVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Mark a succeeded proposal as executed (advisory — see
     *         contract-level notice). Owner-only: this is the team
     *         formally acknowledging they will act on the community's
     *         decision, recorded permanently on-chain.
     */
    function markExecuted(uint256 proposalId) external onlyOwner {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposer != address(0), "Governor: proposal does not exist");
        require(!proposal.executed, "Governor: already executed");
        require(state(proposalId) == ProposalState.Succeeded, "Governor: proposal has not succeeded");

        proposal.executed = true;
        emit ProposalExecuted(proposalId);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposer != address(0), "Governor: proposal does not exist");

        if (proposal.executed) {
            return ProposalState.Executed;
        }
        if (block.timestamp < proposal.startTime) {
            return ProposalState.Pending;
        }
        if (block.timestamp <= proposal.endTime) {
            return ProposalState.Active;
        }

        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 totalStakedNow = stakeToken.totalStaked();
        uint256 requiredQuorum = (totalStakedNow * quorumBps) / 10_000;

        if (totalVotes < requiredQuorum || proposal.forVotes <= proposal.againstVotes) {
            return ProposalState.Defeated;
        }
        return ProposalState.Succeeded;
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    // ------------------------------------------------------------------
    // Owner administration
    // ------------------------------------------------------------------

    function setProposalThreshold(uint256 newThreshold) external onlyOwner {
        emit ProposalThresholdUpdated(proposalThreshold, newThreshold);
        proposalThreshold = newThreshold;
    }

    function setVotingPeriod(uint256 newPeriodSeconds) external onlyOwner {
        require(newPeriodSeconds >= 1 hours, "Governor: period too short");
        emit VotingPeriodUpdated(votingPeriodSeconds, newPeriodSeconds);
        votingPeriodSeconds = newPeriodSeconds;
    }

    function setQuorumBps(uint256 newQuorumBps) external onlyOwner {
        require(newQuorumBps <= 10_000, "Governor: quorum cannot exceed 100%");
        emit QuorumUpdated(quorumBps, newQuorumBps);
        quorumBps = newQuorumBps;
    }
}
