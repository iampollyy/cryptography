const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;

function explorerBase(networkName) {
  if (networkName === "arbitrumSepolia") {
    return "https://sepolia.arbiscan.io/tx/";
  }
  return "";
}

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  if (!deployer) {
    throw new Error("No signer available. Check PRIVATE_KEY in .env");
  }

  const aliceAddress = signers[1]?.address || ethers.Wallet.createRandom().address;
  const bobAddress = signers[2]?.address || ethers.Wallet.createRandom().address;
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);

  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Alice:", aliceAddress);
  console.log("Bob:", bobAddress);

  let deployment;

  if (!fs.existsSync(deploymentFile)) {
    const initialSupply = ethers.utils.parseEther("1000000");
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

    deployment = {
      network: network.name,
      deployer: deployer.address,
      v1Implementation: v1Implementation.address,
      proxy: proxy.address,
    };
  } else {
    deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  }

  const proxyAddress = deployment.proxy;
  const tokenV1Proxy = await ethers.getContractAt("MyTokenV1", proxyAddress);

  const mintAmount = ethers.utils.parseEther("200");
  const transferAmount = ethers.utils.parseEther("50");

  const mintTx = await tokenV1Proxy.mint(aliceAddress, mintAmount);
  const mintReceipt = await mintTx.wait();

  const transferTx = await tokenV1Proxy.transfer(bobAddress, transferAmount);
  const transferReceipt = await transferTx.wait();

  const balancesBefore = {
    deployer: await tokenV1Proxy.balanceOf(deployer.address),
    alice: await tokenV1Proxy.balanceOf(aliceAddress),
    bob: await tokenV1Proxy.balanceOf(bobAddress),
  };

  const V2Factory = await ethers.getContractFactory("MyTokenV2");
  const v2Implementation = await V2Factory.deploy();
  await v2Implementation.deployed();

  const upgradeTx = await tokenV1Proxy.upgradeToAndCall(v2Implementation.address, "0x");
  const upgradeReceipt = await upgradeTx.wait();

  const tokenV2Proxy = await ethers.getContractAt("MyTokenV2", proxyAddress);

  const balancesAfter = {
    deployer: await tokenV2Proxy.balanceOf(deployer.address),
    alice: await tokenV2Proxy.balanceOf(aliceAddress),
    bob: await tokenV2Proxy.balanceOf(bobAddress),
  };

  const version = await tokenV2Proxy.version();

  deployment.v2Implementation = v2Implementation.address;
  deployment.mintTxHash = mintReceipt.transactionHash;
  deployment.transferTxHash = transferReceipt.transactionHash;
  deployment.upgradeTxHash = upgradeReceipt.transactionHash;
  fs.mkdirSync(path.dirname(deploymentFile), { recursive: true });
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));

  const txExplorer = explorerBase(network.name);

  console.log("\n=== V1 proxy interactions ===");
  console.log("Proxy:", proxyAddress);
  console.log("V1 implementation:", deployment.v1Implementation);
  console.log("Mint tx:", mintReceipt.transactionHash);
  console.log("Transfer tx:", transferReceipt.transactionHash);

  console.log("\n=== Upgrade ===");
  console.log("V2 implementation:", v2Implementation.address);
  console.log("Upgrade tx:", upgradeReceipt.transactionHash);

  console.log("\n=== Balances after upgrade ===");
  console.log("Deployer:", ethers.utils.formatEther(balancesAfter.deployer));
  console.log("Alice:", ethers.utils.formatEther(balancesAfter.alice));
  console.log("Bob:", ethers.utils.formatEther(balancesAfter.bob));

  console.log("\n=== Validation ===");
  console.log(
    "Balances unchanged after upgrade:",
    balancesBefore.deployer.eq(balancesAfter.deployer) &&
      balancesBefore.alice.eq(balancesAfter.alice) &&
      balancesBefore.bob.eq(balancesAfter.bob)
  );
  console.log("version() via proxy:", version);

  if (txExplorer) {
    console.log("\n=== Explorer links ===");
    console.log("Mint:", `${txExplorer}${mintReceipt.transactionHash}`);
    console.log("Transfer:", `${txExplorer}${transferReceipt.transactionHash}`);
    console.log("Upgrade:", `${txExplorer}${upgradeReceipt.transactionHash}`);
  }

  console.log("\nSaved deployment info:", deploymentFile);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});