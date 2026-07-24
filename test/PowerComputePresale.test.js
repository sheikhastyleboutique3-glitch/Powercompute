/**
 * PowerComputePresale.test.js
 *
 * Hardhat + Mocha + Chai test suite for the phased presale contract,
 * with a focus on the two most error-prone pieces of logic: multi-phase
 * contribution splitting and the referral bonus math.
 *
 * ⚠️ See PowerComputeToken.test.js for setup instructions (npm install
 * hardhat, npx hardhat test) — not runnable in this sandbox, syntax-checked
 * only.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PowerComputePresale", function () {
  const INITIAL_SUPPLY = 200_000_000n;
  const REWARD_RATE_PER_SECOND = ethers.parseUnits("1", 18);
  const FUNDING_GOAL = ethers.parseEther("10"); // 10 ETH goal for test purposes

  async function deployPresaleFixture() {
    const [owner, alice, bob, carol] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("PowerComputeToken");
    const token = await Token.deploy(INITIAL_SUPPLY, REWARD_RATE_PER_SECOND);
    await token.waitForDeployment();

    const Presale = await ethers.getContractFactory("PowerComputePresale");
    const presale = await Presale.deploy(await token.getAddress(), FUNDING_GOAL, owner.address);
    await presale.waitForDeployment();

    return { token, presale, owner, alice, bob, carol };
  }

  async function fundPresaleForClaims(token, presale, owner, amount) {
    await token.approve(await presale.getAddress(), amount);
    await presale.depositTokensForClaims(amount);
  }

  describe("Phase configuration", function () {
    it("only allows adding phases while Configuring", async function () {
      const { presale, owner } = await deployPresaleFixture();
      const price = ethers.parseEther("0.0001"); // wei per whole PWR
      const cap = ethers.parseEther("1");

      await expect(presale.addPhase(price, cap)).to.not.be.reverted;
      await presale.startPresale();

      await expect(presale.addPhase(price, cap)).to.be.revertedWith("Presale: not configuring");
    });

    it("reverts starting the presale with zero phases", async function () {
      const { presale } = await deployPresaleFixture();
      await expect(presale.startPresale()).to.be.revertedWith("Presale: no phases configured");
    });
  });

  describe("Contribution & multi-phase splitting", function () {
    it("computes token allocation correctly for a single-phase contribution", async function () {
      const { presale, alice } = await deployPresaleFixture();
      const price = ethers.parseEther("0.0001"); // 0.0001 ETH per PWR
      const cap = ethers.parseEther("5");
      await presale.addPhase(price, cap);
      await presale.startPresale();

      const contribution = ethers.parseEther("1"); // 1 ETH
      await presale.connect(alice).contribute({ value: contribution });

      // 1 ETH / 0.0001 ETH-per-token = 10,000 tokens
      const expectedTokens = ethers.parseUnits("10000", 18);
      expect(await presale.tokenAllocations(alice.address)).to.equal(expectedTokens);
    });

    it("splits a single contribution across two phase boundaries correctly", async function () {
      const { presale, alice } = await deployPresaleFixture();

      // Phase 0: price 0.0001 ETH/token, cap 1 ETH (10,000 tokens max)
      // Phase 1: price 0.0002 ETH/token, cap 1 ETH (5,000 tokens max)
      await presale.addPhase(ethers.parseEther("0.0001"), ethers.parseEther("1"));
      await presale.addPhase(ethers.parseEther("0.0002"), ethers.parseEther("1"));
      await presale.startPresale();

      // Contribute 1.5 ETH: fills phase 0 entirely (1 ETH -> 10,000 tokens),
      // then spends the remaining 0.5 ETH in phase 1 (0.5/0.0002 = 2,500 tokens).
      await presale.connect(alice).contribute({ value: ethers.parseEther("1.5") });

      const expectedTokens = ethers.parseUnits("10000", 18) + ethers.parseUnits("2500", 18);
      expect(await presale.tokenAllocations(alice.address)).to.equal(expectedTokens);
      expect(await presale.currentPhaseIndex()).to.equal(1n);
    });

    it("reverts a contribution that exceeds total remaining presale capacity", async function () {
      const { presale, alice } = await deployPresaleFixture();
      await presale.addPhase(ethers.parseEther("0.0001"), ethers.parseEther("1"));
      await presale.startPresale();

      await expect(
        presale.connect(alice).contribute({ value: ethers.parseEther("2") })
      ).to.be.revertedWith("Presale: exceeds remaining presale capacity");
    });
  });

  describe("Referral program", function () {
    it("links a referrer permanently on the first contributeWithReferral call", async function () {
      const { presale, alice, bob } = await deployPresaleFixture();
      await presale.addPhase(ethers.parseEther("0.0001"), ethers.parseEther("5"));
      await presale.startPresale();

      await presale.connect(alice).contributeWithReferral(bob.address, { value: ethers.parseEther("1") });

      expect(await presale.referrerOf(alice.address)).to.equal(bob.address);
      expect(await presale.referralCount(bob.address)).to.equal(1n);
    });

    it("rejects self-referral", async function () {
      const { presale, alice } = await deployPresaleFixture();
      await presale.addPhase(ethers.parseEther("0.0001"), ethers.parseEther("5"));
      await presale.startPresale();

      await expect(
        presale.connect(alice).contributeWithReferral(alice.address, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Presale: cannot refer yourself");
    });

    it("applies referee (3%) and referrer (5%) bonuses correctly on top of the base allocation", async function () {
      const { presale, alice, bob } = await deployPresaleFixture();
      await presale.addPhase(ethers.parseEther("0.0001"), ethers.parseEther("5"));
      await presale.startPresale();

      const contribution = ethers.parseEther("1");
      await presale.connect(alice).contributeWithReferral(bob.address, { value: contribution });

      const baseTokens = ethers.parseUnits("10000", 18); // 1 ETH / 0.0001
      const refereeBonus = (baseTokens * 300n) / 10_000n; // 3%
      const referrerBonus = (baseTokens * 500n) / 10_000n; // 5%

      expect(await presale.tokenAllocations(alice.address)).to.equal(baseTokens + refereeBonus);
      expect(await presale.tokenAllocations(bob.address)).to.equal(referrerBonus);
      expect(await presale.referralBonusEarned(bob.address)).to.equal(referrerBonus);
    });

    it("keeps applying referral bonuses on subsequent plain contribute() calls once linked", async function () {
      const { presale, alice, bob } = await deployPresaleFixture();
      await presale.addPhase(ethers.parseEther("0.0001"), ethers.parseEther("10"));
      await presale.startPresale();

      await presale.connect(alice).contributeWithReferral(bob.address, { value: ethers.parseEther("1") });
      const bonusAfterFirst = await presale.referralBonusEarned(bob.address);

      // Second contribution via plain contribute() should still trigger the bonus.
      await presale.connect(alice).contribute({ value: ethers.parseEther("1") });
      const bonusAfterSecond = await presale.referralBonusEarned(bob.address);

      expect(bonusAfterSecond).to.be.greaterThan(bonusAfterFirst);
    });

    it("caps referral bps at 2000 (20%) via setReferralBps", async function () {
      const { presale } = await deployPresaleFixture();
      await expect(presale.setReferralBps(2001, 500)).to.be.revertedWith(
        "Presale: referral bps too high"
      );
      await expect(presale.setReferralBps(500, 2001)).to.be.revertedWith(
        "Presale: referral bps too high"
      );
      await expect(presale.setReferralBps(2000, 2000)).to.not.be.reverted;
    });

    it("includes referral bonuses in totalTokensSold so finalize() requires funding for them too", async function () {
      const { token, presale, owner, alice, bob } = await deployPresaleFixture();
      await presale.addPhase(ethers.parseEther("0.0001"), ethers.parseEther("5"));
      await presale.startPresale();

      await presale.connect(alice).contributeWithReferral(bob.address, { value: ethers.parseEther("1") });

      const totalSold = await presale.totalTokensSold();
      // Base 10,000 + 3% + 5% = 10,800 tokens total committed.
      expect(totalSold).to.equal(ethers.parseUnits("10800", 18));

      // Funding less than totalTokensSold should fail to finalize.
      await fundPresaleForClaims(token, presale, owner, ethers.parseUnits("10000", 18));
      await expect(presale.finalize()).to.be.revertedWith("Presale: insufficient tokens deposited");

      // Funding enough should succeed.
      await fundPresaleForClaims(token, presale, owner, ethers.parseUnits("800", 18));
      await expect(presale.finalize()).to.not.be.reverted;
    });
  });

  describe("Finalize, claim, cancel, refund", function () {
    it("lets contributors claim their full allocation (including bonuses) after finalize", async function () {
      const { token, presale, owner, alice, bob } = await deployPresaleFixture();
      await presale.addPhase(ethers.parseEther("0.0001"), ethers.parseEther("5"));
      await presale.startPresale();

      await presale.connect(alice).contributeWithReferral(bob.address, { value: ethers.parseEther("1") });

      const totalSold = await presale.totalTokensSold();
      await fundPresaleForClaims(token, presale, owner, totalSold);
      await presale.finalize();

      const aliceAllocation = await presale.tokenAllocations(alice.address);
      await presale.connect(alice).claim();
      expect(await token.balanceOf(alice.address)).to.equal(aliceAllocation);

      const bobAllocation = await presale.tokenAllocations(bob.address);
      await presale.connect(bob).claim();
      expect(await token.balanceOf(bob.address)).to.equal(bobAllocation);
    });

    it("reverts a second claim attempt", async function () {
      const { token, presale, owner, alice } = await deployPresaleFixture();
      await presale.addPhase(ethers.parseEther("0.0001"), ethers.parseEther("5"));
      await presale.startPresale();
      await presale.connect(alice).contribute({ value: ethers.parseEther("1") });

      await fundPresaleForClaims(token, presale, owner, await presale.totalTokensSold());
      await presale.finalize();
      await presale.connect(alice).claim();

      await expect(presale.connect(alice).claim()).to.be.revertedWith("Presale: already claimed");
    });

    it("allows refunds after cancellation, and blocks claim after cancel", async function () {
      const { presale, alice } = await deployPresaleFixture();
      await presale.addPhase(ethers.parseEther("0.0001"), ethers.parseEther("5"));
      await presale.startPresale();
      await presale.connect(alice).contribute({ value: ethers.parseEther("1") });

      await presale.cancelPresale();

      await expect(presale.connect(alice).claim()).to.be.revertedWith("Presale: not finalized");

      const balanceBefore = await ethers.provider.getBalance(alice.address);
      const tx = await presale.connect(alice).claimRefund();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(alice.address);

      expect(balanceAfter).to.equal(balanceBefore + ethers.parseEther("1") - gasCost);
    });
  });
});
