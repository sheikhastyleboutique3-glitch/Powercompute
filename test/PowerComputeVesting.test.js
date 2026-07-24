/**
 * PowerComputeVesting.test.js
 *
 * Hardhat + Mocha + Chai test suite for the linear vesting contract, with
 * a focus on the audit-fix regression for finding #3 (schedule overwrite
 * orphaning already-vested tokens).
 *
 * ⚠️ See PowerComputeToken.test.js for setup instructions (npm install
 * hardhat, npx hardhat test) — not runnable in this sandbox, syntax-checked
 * only.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PowerComputeVesting", function () {
  const INITIAL_SUPPLY = 200_000_000n;
  const REWARD_RATE_PER_SECOND = ethers.parseUnits("1", 18);

  async function deployVestingFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("PowerComputeToken");
    const token = await Token.deploy(INITIAL_SUPPLY, REWARD_RATE_PER_SECOND);
    await token.waitForDeployment();

    const Vesting = await ethers.getContractFactory("PowerComputeVesting");
    const vesting = await Vesting.deploy(await token.getAddress(), owner.address);
    await vesting.waitForDeployment();

    return { token, vesting, owner, alice, bob };
  }

  async function currentTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }

  describe("Schedule creation", function () {
    it("pulls the full totalAmount from the owner immediately on creation", async function () {
      const { token, vesting, owner, alice } = await deployVestingFixture();
      const amount = ethers.parseUnits("10000", 18);
      const start = await currentTimestamp();

      await token.approve(await vesting.getAddress(), amount);
      const ownerBalanceBefore = await token.balanceOf(owner.address);

      await vesting.createVestingSchedule(alice.address, amount, start, 0, 86400 * 30, true);

      expect(await token.balanceOf(owner.address)).to.equal(ownerBalanceBefore - amount);
      expect(await token.balanceOf(await vesting.getAddress())).to.equal(amount);
    });

    it("reverts if cliff exceeds duration", async function () {
      const { token, vesting, alice } = await deployVestingFixture();
      const amount = ethers.parseUnits("1000", 18);
      await token.approve(await vesting.getAddress(), amount);

      await expect(
        vesting.createVestingSchedule(alice.address, amount, await currentTimestamp(), 200, 100, true)
      ).to.be.revertedWith("Vesting: cliff cannot exceed duration");
    });
  });

  describe("Linear vesting math", function () {
    it("releases nothing before the cliff", async function () {
      const { token, vesting, alice } = await deployVestingFixture();
      const amount = ethers.parseUnits("12000", 18);
      const start = await currentTimestamp();
      const cliff = 30 * 86400; // 30 days
      const duration = 360 * 86400; // 360 days

      await token.approve(await vesting.getAddress(), amount);
      await vesting.createVestingSchedule(alice.address, amount, start, cliff, duration, true);

      expect(await vesting.vestedAmountOf(alice.address)).to.equal(0n);

      await expect(vesting.connect(alice).release()).to.be.revertedWith(
        "Vesting: nothing releasable yet"
      );
    });

    it("vests 100% once the full duration has elapsed", async function () {
      const { token, vesting, alice } = await deployVestingFixture();
      const amount = ethers.parseUnits("12000", 18);
      const start = await currentTimestamp();
      const duration = 360 * 86400;

      await token.approve(await vesting.getAddress(), amount);
      await vesting.createVestingSchedule(alice.address, amount, start, 0, duration, true);

      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine");

      expect(await vesting.vestedAmountOf(alice.address)).to.equal(amount);

      await vesting.connect(alice).release();
      expect(await token.balanceOf(alice.address)).to.equal(amount);
    });
  });

  describe("Revocation", function () {
    it("returns only the UNVESTED remainder to the owner, keeping vested tokens claimable", async function () {
      const { token, vesting, owner, alice } = await deployVestingFixture();
      const amount = ethers.parseUnits("12000", 18);
      const start = await currentTimestamp();
      const duration = 360 * 86400;

      await token.approve(await vesting.getAddress(), amount);
      await vesting.createVestingSchedule(alice.address, amount, start, 0, duration, true);

      // Advance to ~50% vested.
      await ethers.provider.send("evm_increaseTime", [Math.floor(duration / 2)]);
      await ethers.provider.send("evm_mine");

      const vestedBeforeRevoke = await vesting.vestedAmountOf(alice.address);
      const ownerBalanceBefore = await token.balanceOf(owner.address);

      await vesting.revoke(alice.address);

      const ownerBalanceAfter = await token.balanceOf(owner.address);
      const returnedToOwner = ownerBalanceAfter - ownerBalanceBefore;

      // Owner gets back roughly the unvested half; contract retains the vested half.
      expect(returnedToOwner).to.be.closeTo(amount - vestedBeforeRevoke, ethers.parseUnits("5", 18));

      // Alice can still release what had already vested at revocation time.
      await expect(vesting.connect(alice).release()).to.not.be.reverted;
      expect(await token.balanceOf(alice.address)).to.be.closeTo(vestedBeforeRevoke, ethers.parseUnits("5", 18));
    });

    it("reverts revoking a non-revocable schedule", async function () {
      const { token, vesting, alice } = await deployVestingFixture();
      const amount = ethers.parseUnits("1000", 18);
      await token.approve(await vesting.getAddress(), amount);
      await vesting.createVestingSchedule(alice.address, amount, await currentTimestamp(), 0, 86400, false);

      await expect(vesting.revoke(alice.address)).to.be.revertedWith(
        "Vesting: schedule is not revocable"
      );
    });
  });

  /**
   * ==========================================================================
   * AUDIT FIX REGRESSION TESTS (finding #3)
   *
   * Before the fix, a new schedule could overwrite an old one as long as
   * the old one was EITHER fully released OR revoked. But revoking only
   * returns the UNVESTED remainder to the owner — the VESTED-but-not-yet-
   * released portion stays in the contract, owed to the beneficiary. If a
   * new schedule were allowed to overwrite that struct, those
   * already-vested tokens would become permanently unreachable (no
   * function references the old struct's data anymore). The fix requires
   * `released >= totalAmount` unconditionally, regardless of revocation
   * status, before a new schedule can be created for the same address.
   * ==========================================================================
   */
  describe("Audit fix: schedule overwrite cannot orphan vested tokens (finding #3)", function () {
    it("reverts creating a new schedule for a beneficiary who was revoked but still has unreleased vested tokens", async function () {
      const { token, vesting, alice } = await deployVestingFixture();
      const amount = ethers.parseUnits("12000", 18);
      const start = await currentTimestamp();
      const duration = 360 * 86400;

      await token.approve(await vesting.getAddress(), amount * 2n);
      await vesting.createVestingSchedule(alice.address, amount, start, 0, duration, true);

      // Advance to ~50% vested, then revoke WITHOUT alice releasing first.
      await ethers.provider.send("evm_increaseTime", [Math.floor(duration / 2)]);
      await ethers.provider.send("evm_mine");
      await vesting.revoke(alice.address);

      // Alice has vested-but-unreleased tokens sitting in the old schedule.
      expect(await vesting.releasableAmountOf(alice.address)).to.be.greaterThan(0n);

      // REGRESSION CHECK: creating a new schedule for alice must now
      // revert, because the old schedule's `released` is still less than
      // its (now-frozen) `totalAmount` — overwriting it would orphan the
      // still-claimable tokens.
      await expect(
        vesting.createVestingSchedule(alice.address, amount, start, 0, duration, true)
      ).to.be.revertedWith("Vesting: beneficiary has unreleased tokens on an existing schedule");
    });

    it("allows creating a new schedule once the beneficiary has released everything from a revoked schedule", async function () {
      const { token, vesting, alice } = await deployVestingFixture();
      const amount = ethers.parseUnits("12000", 18);
      const start = await currentTimestamp();
      const duration = 360 * 86400;

      await token.approve(await vesting.getAddress(), amount * 2n);
      await vesting.createVestingSchedule(alice.address, amount, start, 0, duration, true);

      await ethers.provider.send("evm_increaseTime", [Math.floor(duration / 2)]);
      await ethers.provider.send("evm_mine");
      await vesting.revoke(alice.address);

      // Alice releases everything she's owed from the (now-frozen) revoked schedule.
      await vesting.connect(alice).release();
      expect(await vesting.releasableAmountOf(alice.address)).to.equal(0n);

      // Now a brand new schedule for the same address should succeed.
      const newStart = await currentTimestamp();
      await expect(
        vesting.createVestingSchedule(alice.address, amount, newStart, 0, duration, true)
      ).to.not.be.reverted;
    });

    it("allows creating a new schedule once a NON-revoked schedule is fully released (unaffected by the fix)", async function () {
      const { token, vesting, alice } = await deployVestingFixture();
      const amount = ethers.parseUnits("1000", 18);
      const duration = 86400;

      await token.approve(await vesting.getAddress(), amount * 2n);
      await vesting.createVestingSchedule(alice.address, amount, await currentTimestamp(), 0, duration, false);

      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine");
      await vesting.connect(alice).release();

      await expect(
        vesting.createVestingSchedule(alice.address, amount, await currentTimestamp(), 0, duration, false)
      ).to.not.be.reverted;
    });
  });
});
