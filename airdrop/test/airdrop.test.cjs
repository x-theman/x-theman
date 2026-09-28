const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("AirdropToken + MerkleAirdrop", () => {
  let StandardMerkleTree;
  before(async () => {
    ({ StandardMerkleTree } = await import("@openzeppelin/merkle-tree"));
  });

  async function deploy() {
    const [owner, alice, bob, carol, relayer] = await ethers.getSigners();
    const amounts = { alice: ethers.parseUnits("1000", 18), bob: ethers.parseUnits("250.5", 18) };
    const tree = StandardMerkleTree.of(
      [
        [alice.address, amounts.alice.toString()],
        [bob.address, amounts.bob.toString()],
      ],
      ["address", "uint256"],
    );
    const proofFor = (addr) => {
      for (const [i, [a]] of tree.entries()) if (a === addr) return tree.getProof(i);
      return [];
    };

    const supply = ethers.parseUnits("1000000", 18);
    const token = await ethers.deployContract("AirdropToken", ["Meridian", "MRD", supply, owner.address]);
    const deadline = (await time.latest()) + 7 * 24 * 3600;
    const airdrop = await ethers.deployContract("MerkleAirdrop", [await token.getAddress(), tree.root, deadline]);
    await token.transfer(await airdrop.getAddress(), amounts.alice + amounts.bob);

    return { token, airdrop, owner, alice, bob, carol, relayer, amounts, proofFor, deadline, supply };
  }

  it("mints the fixed supply to the initial holder", async () => {
    const { token, airdrop, owner, supply, amounts } = await deploy();
    const funded = amounts.alice + amounts.bob;
    expect(await token.name()).to.equal("Meridian");
    expect(await token.symbol()).to.equal("MRD");
    expect(await token.decimals()).to.equal(18n);
    expect(await token.totalSupply()).to.equal(supply);
    expect(await token.balanceOf(owner.address)).to.equal(supply - funded);
    expect(await token.balanceOf(await airdrop.getAddress())).to.equal(funded);
  });

  it("lets an eligible wallet claim once", async () => {
    const { token, airdrop, alice, amounts, proofFor } = await deploy();
    await expect(airdrop.connect(alice).claim(alice.address, amounts.alice, proofFor(alice.address)))
      .to.emit(airdrop, "Claimed")
      .withArgs(alice.address, amounts.alice);
    expect(await token.balanceOf(alice.address)).to.equal(amounts.alice);
    expect(await airdrop.isClaimed(alice.address)).to.equal(true);

    await expect(
      airdrop.connect(alice).claim(alice.address, amounts.alice, proofFor(alice.address)),
    ).to.be.revertedWithCustomError(airdrop, "AlreadyClaimed");
  });

  it("always pays the eligible account, even when someone else submits", async () => {
    const { token, airdrop, bob, relayer, amounts, proofFor } = await deploy();
    await airdrop.connect(relayer).claim(bob.address, amounts.bob, proofFor(bob.address));
    expect(await token.balanceOf(bob.address)).to.equal(amounts.bob);
    expect(await token.balanceOf(relayer.address)).to.equal(0n);
  });

  it("rejects wrong amounts and ineligible wallets", async () => {
    const { airdrop, alice, carol, amounts, proofFor } = await deploy();
    await expect(
      airdrop.claim(alice.address, amounts.alice + 1n, proofFor(alice.address)),
    ).to.be.revertedWithCustomError(airdrop, "InvalidProof");
    await expect(
      airdrop.claim(carol.address, amounts.alice, proofFor(alice.address)),
    ).to.be.revertedWithCustomError(airdrop, "InvalidProof");
  });

  it("closes claims after the deadline and lets only the owner sweep", async () => {
    const { token, airdrop, owner, alice, amounts, proofFor, deadline } = await deploy();
    await expect(airdrop.sweep(owner.address)).to.be.revertedWithCustomError(airdrop, "ClaimWindowOpen");

    await time.increaseTo(deadline + 1);
    await expect(
      airdrop.claim(alice.address, amounts.alice, proofFor(alice.address)),
    ).to.be.revertedWithCustomError(airdrop, "ClaimWindowClosed");
    await expect(airdrop.connect(alice).sweep(alice.address)).to.be.revertedWithCustomError(
      airdrop,
      "OwnableUnauthorizedAccount",
    );

    const before = await token.balanceOf(owner.address);
    await airdrop.sweep(owner.address);
    expect(await token.balanceOf(owner.address)).to.equal(before + amounts.alice + amounts.bob);
  });

  it("verifies proofs produced by scripts/generate-claims.mjs", async () => {
    const claims = require("../data/claims.json");
    const [owner] = await ethers.getSigners();
    const token = await ethers.deployContract("AirdropToken", ["Meridian", "MRD", claims.tokenTotal, owner.address]);
    const airdrop = await ethers.deployContract("MerkleAirdrop", [
      await token.getAddress(),
      claims.merkleRoot,
      (await time.latest()) + 3600,
    ]);
    await token.transfer(await airdrop.getAddress(), claims.tokenTotal);

    for (const [addr, c] of Object.entries(claims.claims)) {
      await airdrop.claim(addr, c.amount, c.proof);
      expect(await token.balanceOf(addr)).to.equal(BigInt(c.amount));
    }
    expect(await token.balanceOf(await airdrop.getAddress())).to.equal(0n);
  });
});
