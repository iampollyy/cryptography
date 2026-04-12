const { expect } = require("chai");

describe("MyToken", function () {
  let myToken, deployer, addr1, addr2;

  beforeEach(async function () {
    [deployer, addr1, addr2] = await ethers.getSigners();
    const MyToken = await ethers.getContractFactory("MyToken");
    myToken = await MyToken.deploy(ethers.utils.parseEther("1000000"));
  });

  it("Should deploy with correct initial supply", async function () {
    const balance = await myToken.balanceOf(deployer.address);
    const expectedSupply = ethers.utils.parseEther("1000000");
    expect(balance.toString()).to.equal(expectedSupply.toString());
  });

  it("Should transfer tokens between accounts", async function () {
    const amount = ethers.utils.parseEther("100");
    await myToken.transfer(addr1.address, amount);

    const addr1Balance = await myToken.balanceOf(addr1.address);
    expect(addr1Balance.toString()).to.equal(amount.toString());
  });

  it("Should fail when transferring more tokens than available balance", async function () {
    const addr1Balance = await myToken.balanceOf(addr1.address);
    expect(addr1Balance.toString()).to.equal("0");

    try {
      await myToken.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("1"));
      expect.fail("Transaction should have reverted");
    } catch (error) {
      expect(error.message).to.include("reverted");
    }
  });

  it("Should fail when transferring more than owner balance", async function () {
    const overBalance = ethers.utils.parseEther("1000001");
    try {
      await myToken.transfer(addr1.address, overBalance);
      expect.fail("Transaction should have reverted");
    } catch (error) {
      expect(error.message).to.include("reverted");
    }
  });

  it("Should allow owner to mint tokens", async function () {
    const mintAmount = ethers.utils.parseEther("500");
    await myToken.mint(addr1.address, mintAmount);

    const addr1Balance = await myToken.balanceOf(addr1.address);
    expect(addr1Balance.toString()).to.equal(mintAmount.toString());
  });

  it("Should prevent non-owner from minting tokens", async function () {
    try {
      await myToken.connect(addr1).mint(addr1.address, ethers.utils.parseEther("500"));
      expect.fail("Transaction should have reverted");
    } catch (error) {
      expect(error.message).to.include("reverted");
    }
  });
});
