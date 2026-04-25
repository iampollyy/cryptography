const { ethers } = require("hardhat");

async function main() {
  const [deployer, owner2, owner3] = await ethers.getSigners();

  console.log("Deploying MultiSigWallet with accounts:");
  console.log("  Owner 1 (deployer):", deployer.address);
  console.log("  Owner 2:", owner2.address);
  console.log("  Owner 3:", owner3.address);

  const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
  const wallet = await MultiSigWallet.deploy(
    [deployer.address, owner2.address, owner3.address],
    2 // 2-of-3
  );

  await wallet.waitForDeployment();
  console.log("\nMultiSigWallet deployed to:", wallet.target);
  console.log("Required confirmations: 2 of 3");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
