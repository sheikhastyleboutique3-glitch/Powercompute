/**
 * PowerComputeGovernor.test.js
 *
 * Hardhat + Mocha + Chai test suite for the stake-weighted advisory
 * governor, with a focus on the audit-fix regression for finding #4
 * (flash-stake voting manipulation via live vs. snapshotted voting power).
 *
 * ⚠️ See PowerComputeToken.test.js for setup instructions (npm install
 * hardhat, npx hardhat test) — not runnable in this sandbox, syntax-checked
 * only.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PowerComputeGovernor", function () {
  const INITIAL_SUPPLY = 200_000_000n;
  const REWARD_RATE_PER_SECOND = ethers.parseUnits("1", 18);
  const PROPOSAL_THRESHOLD = ethers.parseUnits("1000", 18);

  async function deployGovernorFixture() {
    const [owner, alice, bob, carol] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("PowerComputeToken");
    const token = await Token.deploy(INITIAL_SUPPLY, REWARD_RATE_PER_SECOND);
    await token.waitForDeployment();

    const Governor = await ethers.getContractFactory("PowerComputeGovernor");
    const governor = await Governor.deploy(await token.getAddress(), PROPOSAL_THRESHOLD, owner.address);
    await governor.waitForDeployment();

    return { token, governor, owner, alice, bob, carol };
  }

  async function stakeAs(token, signer, amount) {
    await token.transfer(signer.address, amount);
    await token.connect(signer).stake(amount);
  }

  describe("Checkpointing on PowerComputeToken", function () {
    it("getPastStakedBalance reflects the balance at the queried block, not the current one", async function () {
      const { token, alice } = await deployGovernorFixture();
      const firstStake = ethers.parseUnits("1000", 18);
      const secondStake = ethers.parseUnits("500", 18);

      await stakeAs(token, alice, firstStake);
      const blockAfterFirstStake = await ethers.provider.getBlockNumber();

      await stakeAs(token, alice, secondStake);
      const blockAfterSecondStake = await ethers.provider.getBlockNumber();

      expect(await token.getPastStakedBalance(alice.address, blockAfterFirstStake)).to.equal(firstStake);
      expect(await token.getPastStakedBalance(alice.address, blockAfterSecondStake)).to.equal(
        firstStake + secondStake
      );
    });

    it("getPastTotalStaked reflects total staked at the queried block", async function () {
      const { token, alice, bob } = await deployGovernorFixture();
      await stakeAs(token, alice, ethers.parseUnits("1000", 18));
      const blockAfterAlice = await ethers.provider.getBlockNumber();

      await stakeAs(token, bob, ethers.parseUnits("2000", 18));

      expect(await token.getPastTotalStaked(blockAfterAlice)).to.equal(ethers.parseUnits("1000", 18));
      expect(await token.getPastTotalStaked(await ethers.provider.getBlockNumber())).to.equal(
        ethers.parseUnits("3000", 18)
      );
    });

    it("reverts querying a future block", async function () {
      const { token, alice } = await deployGovernorFixture();
      const futureBlock = (await ethers.provider.getBlockNumber()) + 1000;
      await expect(token.getPastStakedBalance(alice.address, futureBlock)).to.be.revertedWith(
        "PWR: cannot query future block"
      );
    });
  });

  describe("Basic proposal & voting flow", function () {
    it("requires proposalThreshold staked $PWR to create a proposal", async function () {
      const { governor, alice } = await deployGovernorFixture();
      await expect(governor.connect(alice).propose("Test", "Description")).to.be.revertedWith(
        "Governor: insufficient staked balance to propose"
      );
    });

    it("lets a sufficiently-staked account propose and vote", async function () {
      const { token, governor, alice } = await deployGovernorFixture();
      await stakeAs(token, alice, PROPOSAL_THRESHOLD);

      await governor.connect(alice).propose("Test Proposal", "Description");
      await governor.connect(alice).castVote(1, 1); // vote for

      const proposal = await governor.getProposal(1);
      expect(proposal.forVotes).to.equal(PROPOSAL_THRESHOLD);
    });

    it("reverts voting twice on the same proposal", async function () {
      const { token, governor, alice } = await deployGovernorFixture();
      await stakeAs(token, alice, PROPOSAL_THRESHOLD);
      await governor.connect(alice).propose("Test", "Desc");
      await governor.connect(alice).castVote(1, 1);

      await expect(governor.connect(alice).castVote(1, 1)).to.be.revertedWith(
        "Governor: already voted"
      );
    });
  });

  /**
   * ==========================================================================
   * AUDIT FIX REGRESSION TESTS (finding #4, HIGH)
   *
   * Before the fix, voting weight was read LIVE via
   * `stakeToken.stakedBalanceOf(voter)` at the moment `castVote` was
   * called. This meant anyone could stake right before voting on a
   * contentious proposal (with no real economic commitment — they could
   * unstake again immediately after voting) and swing the tally. The fix
   * snapshots a `snapshotBlock` at proposal-creation time
   * (`block.number - 1`) and reads `getPastStakedBalance`/
   * `getPastTotalStaked` against that fixed historical block for every
   * vote AND for the quorum calculation — so staking or unstaking after a
   * proposal exists has zero effect on that proposal's outcome.
   * ==========================================================================
   */
  describe("Audit fix: snapshot-based voting power, flash-stake immunity (finding #4)", function () {
    it("a stake placed AFTER proposal creation does not count toward voting weight on that proposal", async function () {
      const { token, governor, alice, bob } = await deployGovernorFixture();

      // Alice stakes enough to propose, BEFORE the proposal exists.
      await stakeAs(token, alice, PROPOSAL_THRESHOLD);
      await governor.connect(alice).propose("Flash-stake test", "Description");

      // Bob stakes a large amount AFTER the proposal was created — this is
      // the "flash-stake" attack: staking specifically to influence a vote
      // that already exists.
      const flashStakeAmount = ethers.parseUnits("1000000", 18);
      await stakeAs(token, bob, flashStakeAmount);

      // Bob's live staked balance is huge...
      expect(await token.stakedBalanceOf(bob.address)).to.equal(flashStakeAmount);

      // ...but casting a vote should register essentially zero weight for
      // him on THIS proposal, because his snapshot-time (pre-proposal)
      // balance was zero.
      await expect(governor.connect(bob).castVote(1, 1)).to.be.revertedWith(
        "Governor: no staked balance at proposal snapshot, no voting power"
      );
    });

    it("a stake placed BEFORE proposal creation DOES count, proving legitimate voters are unaffected", async function () {
      const { token, governor, alice, bob } = await deployGovernorFixture();

      // Bob stakes BEFORE the proposal is created — a legitimate,
      // pre-existing voter.
      const bobStake = ethers.parseUnits("5000", 18);
      await stakeAs(token, bob, bobStake);

      await stakeAs(token, alice, PROPOSAL_THRESHOLD);
      await governor.connect(alice).propose("Legit voter test", "Description");

      await governor.connect(bob).castVote(1, 1);

      const proposal = await governor.getProposal(1);
      expect(proposal.forVotes).to.equal(bobStake);
    });

    it("unstaking after voting does not retroactively reduce a vote already cast", async function () {
      const { token, governor, alice, bob } = await deployGovernorFixture();
      const bobStake = ethers.parseUnits("5000", 18);
      await stakeAs(token, bob, bobStake);

      await stakeAs(token, alice, PROPOSAL_THRESHOLD);
      await governor.connect(alice).propose("Unstake-after-vote test", "Description");
      await governor.connect(bob).castVote(1, 1);

      // Bob unstakes everything right after voting.
      await token.connect(bob).unstake(bobStake);
      expect(await token.stakedBalanceOf(bob.address)).to.equal(0n);

      // His already-recorded vote weight on the proposal is untouched —
      // votes are stored as an accumulated total on the Proposal struct,
      // not recomputed live.
      const proposal = await governor.getProposal(1);
      expect(proposal.forVotes).to.equal(bobStake);
    });

    it("quorum is computed against the historical snapshot, not live totalStaked", async function () {
      const { token, governor, alice, bob, carol } = await deployGovernorFixture();

      await stakeAs(token, alice, PROPOSAL_THRESHOLD);
      await governor.connect(alice).propose("Quorum snapshot test", "Description");

      // A huge amount of NEW stake enters the system after the proposal
      // was created — this must NOT inflate the quorum requirement for
      // this specific proposal (it would make it artificially harder to
      // reach quorum using pre-existing votes if quorum were computed live).
      await stakeAs(token, bob, ethers.parseUnits("10000000", 18));

      await governor.connect(alice).castVote(1, 1);

      // Advance past the voting period.
      const votingPeriod = await governor.votingPeriodSeconds();
      await ethers.provider.send("evm_increaseTime", [Number(votingPeriod) + 1]);
      await ethers.provider.send("evm_mine");

      // Quorum (5% default) of the snapshot total (just PROPOSAL_THRESHOLD,
      // since bob staked after the snapshot) should be satisfied by
      // Alice's single vote — proving quorum used the snapshot, not the
      // post-snapshot inflated total.
      const state = await governor.state(1);
      expect(state).to.equal(3); // Succeeded
    });
  });
});
