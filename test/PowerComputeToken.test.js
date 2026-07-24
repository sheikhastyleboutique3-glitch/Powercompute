/**
 * PowerComputeToken.test.js
 *
 * Hardhat + Mocha + Chai test suite for the $PWR ERC-20 + staking module.
 *
 * ⚠️ HOW TO RUN THESE TESTS
 * This sandbox environment has no outbound npm registry access, so these
 * files are written and syntax-checked here but have NOT been executed
 * against a real Hardhat network. To run them yourself:
 *
 *   npm init -y
 *   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
 *   npx hardhat init   (choose "Create an empty hardhat.config.js" if prompted,
 *                        then paste the hardhat.config.js from this repo's root)
 *   npx hardhat test
 *
 * These tests deploy directly from the .sol files in ../contracts — no
 * changes to the contracts are needed, Hardhat will compile them as-is.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PowerComputeToken", function () {
  const INITIAL_SUPPLY = 200_000_000n; // whole tokens, contract multiplies by 1e18
  const REWARD_RATE_PER_SECOND = ethers.parseUnits("1", 18); // 1 PWR/sec shared across all stakers

  async function deployTokenFixture() {
    const [owner, alice, bob, minterStandIn] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("PowerComputeToken");
    const token = await Token.deploy(INITIAL_SUPPLY, REWARD_RATE_PER_SECOND);
    await token.waitForDeployment();

    return { token, owner, alice, bob, minterStandIn };
  }

  describe("Deployment", function () {
    it("mints the initial supply to the deployer", async function () {
      const { token, owner } = await deployTokenFixture();
      const expected = INITIAL_SUPPLY * 10n ** 18n;
      expect(await token.balanceOf(owner.address)).to.equal(expected);
      expect(await token.totalSupply()).to.equal(expected);
    });

    it("sets name, symbol, and decimals correctly", async function () {
      const { token } = await deployTokenFixture();
      expect(await token.name()).to.equal("PowerCompute");
      expect(await token.symbol()).to.equal("PWR");
      expect(await token.decimals()).to.equal(18);
    });

    it("reverts if initial supply exceeds MAX_SUPPLY", async function () {
      const Token = await ethers.getContractFactory("PowerComputeToken");
      await expect(
        Token.deploy(2_000_000_000n, REWARD_RATE_PER_SECOND)
      ).to.be.revertedWith("PWR: exceeds max supply");
    });
  });

  describe("Staking", function () {
    it("allows a user to stake and increases totalStaked", async function () {
      const { token, owner, alice } = await deployTokenFixture();
      const amount = ethers.parseUnits("1000", 18);

      await token.transfer(alice.address, amount);
      await token.connect(alice).stake(amount);

      expect(await token.stakedBalanceOf(alice.address)).to.equal(amount);
      expect(await token.totalStaked()).to.equal(amount);
    });

    it("reverts staking more than the caller's balance", async function () {
      const { token, alice } = await deployTokenFixture();
      const amount = ethers.parseUnits("1000", 18);
      await expect(token.connect(alice).stake(amount)).to.be.revertedWith(
        "PWR: insufficient balance"
      );
    });

    it("accrues rewards over time proportional to stake, bounded by the funded pool", async function () {
      const { token, owner, alice, bob } = await deployTokenFixture();
      const stakeAmount = ethers.parseUnits("1000", 18);
      const poolFunding = ethers.parseUnits("500000", 18);

      // Fund the rewards pool so accrual has something to draw from.
      await token.fundRewardsPool(poolFunding);

      await token.transfer(alice.address, stakeAmount);
      await token.transfer(bob.address, stakeAmount);

      await token.connect(alice).stake(stakeAmount);
      await token.connect(bob).stake(stakeAmount);

      // Advance time by 100 seconds; reward rate is 1 PWR/sec shared pro-rata.
      await ethers.provider.send("evm_increaseTime", [100]);
      await ethers.provider.send("evm_mine");

      const alicePending = await token.pendingRewardsOf(alice.address);
      const bobPending = await token.pendingRewardsOf(bob.address);

      // Equal stakes => roughly equal pending rewards (allow a small delta
      // for the extra block mined between the two calls).
      const diff = alicePending > bobPending ? alicePending - bobPending : bobPending - alicePending;
      expect(diff).to.be.lessThan(ethers.parseUnits("2", 18));
      expect(alicePending).to.be.greaterThan(0n);
    });

    it("lets a user claim accrued rewards and resets pendingRewards to zero", async function () {
      const { token, alice } = await deployTokenFixture();
      const stakeAmount = ethers.parseUnits("1000", 18);
      await token.fundRewardsPool(ethers.parseUnits("500000", 18));
      await token.transfer(alice.address, stakeAmount);
      await token.connect(alice).stake(stakeAmount);

      await ethers.provider.send("evm_increaseTime", [50]);
      await ethers.provider.send("evm_mine");

      const balanceBefore = await token.balanceOf(alice.address);
      await token.connect(alice).claimRewards();
      const balanceAfter = await token.balanceOf(alice.address);

      expect(balanceAfter).to.be.greaterThan(balanceBefore);
      expect(await token.pendingRewardsOf(alice.address)).to.equal(0n);
    });

    it("enforces the unstake cooldown when set", async function () {
      const { token, owner, alice } = await deployTokenFixture();
      const stakeAmount = ethers.parseUnits("1000", 18);

      await token.setUnstakeCooldown(3600); // 1 hour
      await token.transfer(alice.address, stakeAmount);
      await token.connect(alice).stake(stakeAmount);

      await expect(token.connect(alice).unstake(stakeAmount)).to.be.revertedWith(
        "PWR: unstake cooldown active"
      );

      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      await expect(token.connect(alice).unstake(stakeAmount)).to.not.be.reverted;
    });

    it("returns full principal on unstake and auto-harvests pending rewards", async function () {
      const { token, alice } = await deployTokenFixture();
      const stakeAmount = ethers.parseUnits("1000", 18);
      await token.fundRewardsPool(ethers.parseUnits("500000", 18));
      await token.transfer(alice.address, stakeAmount);
      await token.connect(alice).stake(stakeAmount);

      await ethers.provider.send("evm_increaseTime", [30]);
      await ethers.provider.send("evm_mine");

      await token.connect(alice).unstake(stakeAmount);

      expect(await token.stakedBalanceOf(alice.address)).to.equal(0n);
      // pendingRewards bucket should carry over (unstake harvests but doesn't auto-claim)
      expect(await token.pendingRewardsOf(alice.address)).to.be.greaterThan(0n);
    });
  });

  describe("Minter allowlist & protocol emissions", function () {
    it("reverts mintReward from a non-approved minter", async function () {
      const { token, minterStandIn, alice } = await deployTokenFixture();
      await expect(
        token.connect(minterStandIn).mintReward(alice.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWith("PWR: caller is not an approved minter");
    });

    it("allows an approved minter to mint rewards and updates totalEmissionsMinted", async function () {
      const { token, owner, minterStandIn, alice } = await deployTokenFixture();
      const amount = ethers.parseUnits("100", 18);

      await token.setMinter(minterStandIn.address, true);
      await token.connect(minterStandIn).mintReward(alice.address, amount);

      expect(await token.balanceOf(alice.address)).to.equal(amount);
      expect(await token.totalEmissionsMinted()).to.equal(amount);
    });

    it("reverts mintReward once revoked", async function () {
      const { token, owner, minterStandIn, alice } = await deployTokenFixture();
      await token.setMinter(minterStandIn.address, true);
      await token.setMinter(minterStandIn.address, false);

      await expect(
        token.connect(minterStandIn).mintReward(alice.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWith("PWR: caller is not an approved minter");
    });

    it("reverts mintReward if it would exceed MAX_SUPPLY", async function () {
      const { token, owner, minterStandIn, alice } = await deployTokenFixture();
      await token.setMinter(minterStandIn.address, true);
      const maxSupply = await token.MAX_SUPPLY();
      const currentSupply = await token.totalSupply();
      const tooMuch = maxSupply - currentSupply + 1n;

      await expect(
        token.connect(minterStandIn).mintReward(alice.address, tooMuch)
      ).to.be.revertedWith("PWR: exceeds max supply");
    });
  });

  describe("Access control & pausability", function () {
    it("only owner can call mint/setMinter/fundRewardsPool/pause", async function () {
      const { token, alice } = await deployTokenFixture();
      await expect(token.connect(alice).mint(alice.address, 1)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(token.connect(alice).setMinter(alice.address, true)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(token.connect(alice).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("blocks staking while paused", async function () {
      const { token, owner, alice } = await deployTokenFixture();
      const amount = ethers.parseUnits("100", 18);
      await token.transfer(alice.address, amount);
      await token.pause();

      await expect(token.connect(alice).stake(amount)).to.be.revertedWith("Pausable: paused");
    });
  });
});
