const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);

  if (!fs.existsSync(file)) {
    throw new Error(`Deployment file not found: ${file}. Run deploy-v1-and-proxy.js first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));
  const proxyAddress = deployment.proxy;

  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Proxy:", proxyAddress);

  const V2Factory = await ethers.getContractFactory("MyTokenV2");
  const v2Implementation = await V2Factory.deploy();
  await v2Implementation.deployed();

  const tokenV1Proxy = await ethers.getContractAt("MyTokenV1", proxyAddress);
  const tx = await tokenV1Proxy.upgradeToAndCall(v2Implementation.address, "0x");
  const receipt = await tx.wait();

  const tokenV2Proxy = await ethers.getContractAt("MyTokenV2", proxyAddress);
  const version = await tokenV2Proxy.version();

  deployment.v2Implementation = v2Implementation.address;
  deployment.upgradeTxHash = receipt.transactionHash;
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));

  console.log("V2 implementation:", v2Implementation.address);
  console.log("Upgrade tx hash:", receipt.transactionHash);
  console.log("version() via proxy:", version);
  console.log("Updated deployment file:", file);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});