const { expect } = require("chai");

describe("MyToken UUPS upgrade flow", function () {
  let deployer;
  let alice;
  let bob;
  let tokenProxyAsV1;
  let proxy;

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();

    const V1Factory = await ethers.getContractFactory("MyTokenV1");
    const v1Implementation = await V1Factory.deploy();
    await v1Implementation.deployed();

    const initData = V1Factory.interface.encodeFunctionData("initialize", [
      deployer.address,
      ethers.utils.parseEther("1000000"),
    ]);

    const ProxyFactory = await ethers.getContractFactory("MyTokenProxy");
    proxy = await ProxyFactory.deploy(v1Implementation.address, initData);
    await proxy.deployed();

    tokenProxyAsV1 = await ethers.getContractAt("MyTokenV1", proxy.address);
  });

  it("deploys V1 behind proxy with correct initial supply", async function () {
    const balance = await tokenProxyAsV1.balanceOf(deployer.address);
    const expectedSupply = ethers.utils.parseEther("1000000");
    expect(balance.toString()).to.equal(expectedSupply.toString());
  });

  it("mints and transfers tokens on V1 proxy", async function () {
    await tokenProxyAsV1.mint(alice.address, ethers.utils.parseEther("200"));
    await tokenProxyAsV1.transfer(bob.address, ethers.utils.parseEther("50"));

    expect((await tokenProxyAsV1.balanceOf(alice.address)).toString()).to.equal(
      ethers.utils.parseEther("200").toString()
    );
    expect((await tokenProxyAsV1.balanceOf(bob.address)).toString()).to.equal(
      ethers.utils.parseEther("50").toString()
    );
  });

  it("upgrades to V2 and keeps balances unchanged", async function () {
    await tokenProxyAsV1.mint(alice.address, ethers.utils.parseEther("100"));
    await tokenProxyAsV1.transfer(bob.address, ethers.utils.parseEther("25"));

    const beforeDeployer = await tokenProxyAsV1.balanceOf(deployer.address);
    const beforeAlice = await tokenProxyAsV1.balanceOf(alice.address);
    const beforeBob = await tokenProxyAsV1.balanceOf(bob.address);

    const V2Factory = await ethers.getContractFactory("MyTokenV2");
    const v2Implementation = await V2Factory.deploy();
    await v2Implementation.deployed();

    await tokenProxyAsV1.upgradeToAndCall(v2Implementation.address, "0x");

    const tokenProxyAsV2 = await ethers.getContractAt("MyTokenV2", proxy.address);

    const afterDeployer = await tokenProxyAsV2.balanceOf(deployer.address);
    const afterAlice = await tokenProxyAsV2.balanceOf(alice.address);
    const afterBob = await tokenProxyAsV2.balanceOf(bob.address);

    expect(afterDeployer.toString()).to.equal(beforeDeployer.toString());
    expect(afterAlice.toString()).to.equal(beforeAlice.toString());
    expect(afterBob.toString()).to.equal(beforeBob.toString());

    expect(await tokenProxyAsV2.version()).to.equal("V2");
  });

  it("prevents non-owner from upgrade", async function () {
    const V2Factory = await ethers.getContractFactory("MyTokenV2");
    const v2Implementation = await V2Factory.deploy();
    await v2Implementation.deployed();

    try {
      await tokenProxyAsV1.connect(alice).upgradeToAndCall(v2Implementation.address, "0x");
      expect.fail("Expected non-owner upgrade attempt to revert");
    } catch (error) {
      expect(error.message).to.include("reverted");
    }
  });
});
