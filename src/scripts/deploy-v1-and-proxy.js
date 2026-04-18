const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const initialSupply = ethers.utils.parseEther("1000000");

  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);

  const V1Factory = await ethers.getContractFactory("MyTokenV1");
  const v1Implementation = await V1Factory.deploy();
  await v1Implementation.deployed();

  const initData = V1Factory.interface.encodeFunctionData("initialize", [
    deployer.address,
    initialSupply,
  ]);

  const ProxyFactory = await ethers.getContractFactory("MyTokenProxy");
  const proxy = await ProxyFactory.deploy(v1Implementation.address, initData);
  await proxy.deployed();

  const tokenV1Proxy = await ethers.getContractAt("MyTokenV1", proxy.address);
  const totalSupply = await tokenV1Proxy.totalSupply();

  const deployment = {
    network: network.name,
    deployer: deployer.address,
    v1Implementation: v1Implementation.address,
    proxy: proxy.address,
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });

  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));

  console.log("V1 implementation:", v1Implementation.address);
  console.log("Proxy:", proxy.address);
  console.log("Total supply via proxy:", ethers.utils.formatEther(totalSupply));
  console.log("Saved deployment file:", file);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});