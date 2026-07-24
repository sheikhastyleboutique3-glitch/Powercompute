/**
 * NodeRegistry.test.js
 *
 * Hardhat + Mocha + Chai test suite for the GPU node registry and its
 * Proof-of-Energy-Consumption (PoEC) reward pipeline, with a focus on the
 * batch admin functions (batchVerifyNodes, batchApproveEnergyProofs).
 *
 * ⚠️ See PowerComputeToken.test.js for setup instructions — not runnable
 * in this sandbox, syntax-checked only.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NodeRegistry", function () {
  const INITIAL_SUPPLY = 200_000_000n;
  const REWARD_RATE_PER_SECOND = ethers.parseUnits("1", 18);

  async function deployRegistryFixture() {
    const [owner, operatorA, operatorB, oracle] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("PowerComputeToken");
    const token = await Token.deploy(INITIAL_SUPPLY, REWARD_RATE_PER_SECOND);
    await token.waitForDeployment();

    const Registry = await ethers.getContractFactory("NodeRegistry");
    const registry = await Registry.deploy(await token.getAddress(), owner.address);
    await registry.waitForDeployment();

    // Wire the registry as an approved minter so approveEnergyProof can mint rewards.
    await token.setMinter(await registry.getAddress(), true);

    return { token, registry, owner, operatorA, operatorB, oracle };
  }

  async function registerAndVerifyNode(registry, operatorSigner, region = "Texas, USA") {
    const tx = await registry
      .connect(operatorSigner)
      .registerNode("NVIDIA H100 80GB", 8, "WIND-TX-001", region);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log) => {
        try {
          return registry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === "NodeRegistered");
    const nodeId = event.args.nodeId;

    await registry.verifyNode(nodeId);
    return nodeId;
  }

  describe("Node lifecycle", function () {
    it("registers a node in Pending status", async function () {
      const { registry, operatorA } = await deployRegistryFixture();
      const tx = await registry
        .connect(operatorA)
        .registerNode("NVIDIA A100 40GB", 4, "SOLAR-CA-002", "California, USA");
      await tx.wait();

      const node = await registry.getNode(1);
      expect(node.status).to.equal(0); // Pending
      expect(node.operator).to.equal(operatorA.address);
    });

    it("only an oracle or owner can verify a node", async function () {
      const { registry, operatorA } = await deployRegistryFixture();
      await registry.connect(operatorA).registerNode("A100", 4, "SITE-1", "TX");

      await expect(registry.connect(operatorA).verifyNode(1)).to.be.revertedWith(
        "NodeRegistry: caller is not an oracle or owner"
      );
    });

    it("increments totalActiveNodes on verification", async function () {
      const { registry, operatorA } = await deployRegistryFixture();
      await registerAndVerifyNode(registry, operatorA);
      expect(await registry.totalActiveNodes()).to.equal(1n);
    });
  });

  describe("Energy proof submission & approval", function () {
    it("rejects a proof for a node the caller does not operate", async function () {
      const { registry, operatorA, operatorB } = await deployRegistryFixture();
      const nodeId = await registerAndVerifyNode(registry, operatorA);

      await expect(
        registry.connect(operatorB).submitEnergyProof(nodeId, 1000, 0, Math.floor(Date.now() / 1000) - 100)
      ).to.be.revertedWith("NodeRegistry: caller is not the node operator");
    });

    it("mints the correct reward on approval (kWhRouted * rewardPerKwh)", async function () {
      const { token, registry, owner, operatorA } = await deployRegistryFixture();
      const nodeId = await registerAndVerifyNode(registry, operatorA);

      const now = Math.floor(Date.now() / 1000);
      await registry.connect(operatorA).submitEnergyProof(nodeId, 1000, now - 3600, now - 60);

      const rewardPerKwh = await registry.rewardPerKwh();
      const expectedReward = 1000n * rewardPerKwh;

      await registry.approveEnergyProof(1);

      expect(await token.balanceOf(operatorA.address)).to.equal(expectedReward);
      const proof = await registry.getEnergyProof(1);
      expect(proof.approved).to.equal(true);
      expect(proof.rewardMinted).to.equal(expectedReward);
    });

    it("reverts approving an already-resolved proof", async function () {
      const { registry, operatorA } = await deployRegistryFixture();
      const nodeId = await registerAndVerifyNode(registry, operatorA);
      const now = Math.floor(Date.now() / 1000);
      await registry.connect(operatorA).submitEnergyProof(nodeId, 500, now - 3600, now - 60);

      await registry.approveEnergyProof(1);
      await expect(registry.approveEnergyProof(1)).to.be.revertedWith(
        "NodeRegistry: proof already resolved"
      );
    });
  });

  describe("Batch admin operations", function () {
    it("batchVerifyNodes verifies all pending nodes in the list and skips already-active ones", async function () {
      const { registry, operatorA, operatorB } = await deployRegistryFixture();

      await registry.connect(operatorA).registerNode("H100", 8, "SITE-A", "TX"); // id 1, Pending
      await registry.connect(operatorB).registerNode("A100", 4, "SITE-B", "CA"); // id 2, Pending
      await registry.verifyNode(1); // pre-verify node 1 so the batch call should skip it

      const tx = await registry.batchVerifyNodes([1, 2]);
      const receipt = await tx.wait();

      const node1 = await registry.getNode(1);
      const node2 = await registry.getNode(2);
      expect(node1.status).to.equal(1); // Active (already was)
      expect(node2.status).to.equal(1); // Active (newly verified by batch)
      expect(await registry.totalActiveNodes()).to.equal(2n);
    });

    it("batchVerifyNodes does not revert on a nonexistent node ID in the batch", async function () {
      const { registry, operatorA } = await deployRegistryFixture();
      await registry.connect(operatorA).registerNode("H100", 8, "SITE-A", "TX"); // id 1

      // id 999 does not exist — should be silently skipped, not reverted.
      await expect(registry.batchVerifyNodes([1, 999])).to.not.be.reverted;
      expect((await registry.getNode(1)).status).to.equal(1);
    });

    it("batchApproveEnergyProofs approves all valid proofs and mints correct rewards for each", async function () {
      const { token, registry, operatorA, operatorB } = await deployRegistryFixture();
      const nodeIdA = await registerAndVerifyNode(registry, operatorA, "Texas");
      const nodeIdB = await registerAndVerifyNode(registry, operatorB, "California");

      const now = Math.floor(Date.now() / 1000);
      await registry.connect(operatorA).submitEnergyProof(nodeIdA, 1000, now - 3600, now - 60); // proof id 1
      await registry.connect(operatorB).submitEnergyProof(nodeIdB, 2000, now - 3600, now - 60); // proof id 2

      const rewardPerKwh = await registry.rewardPerKwh();

      await registry.batchApproveEnergyProofs([1, 2]);

      expect(await token.balanceOf(operatorA.address)).to.equal(1000n * rewardPerKwh);
      expect(await token.balanceOf(operatorB.address)).to.equal(2000n * rewardPerKwh);
    });

    it("batchApproveEnergyProofs skips already-approved/rejected proofs without reverting", async function () {
      const { registry, operatorA } = await deployRegistryFixture();
      const nodeId = await registerAndVerifyNode(registry, operatorA);
      const now = Math.floor(Date.now() / 1000);

      await registry.connect(operatorA).submitEnergyProof(nodeId, 500, now - 3600, now - 60); // proof 1
      await registry.approveEnergyProof(1); // already resolved

      await registry.connect(operatorA).submitEnergyProof(nodeId, 700, now - 3600, now - 60); // proof 2

      const tx = await registry.batchApproveEnergyProofs([1, 2]);
      await expect(tx).to.not.be.reverted;

      const proof2 = await registry.getEnergyProof(2);
      expect(proof2.approved).to.equal(true);
    });

    it("only an oracle or owner can call batch functions", async function () {
      const { registry, operatorA } = await deployRegistryFixture();
      await expect(registry.connect(operatorA).batchVerifyNodes([1])).to.be.revertedWith(
        "NodeRegistry: caller is not an oracle or owner"
      );
      await expect(registry.connect(operatorA).batchApproveEnergyProofs([1])).to.be.revertedWith(
        "NodeRegistry: caller is not an oracle or owner"
      );
    });
  });
});
