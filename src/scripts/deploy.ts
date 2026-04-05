import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  
  console.log("Deploying Counter contract to", network.name);
  
  const counter = await viem.deployContract("Counter");
  
  console.log("✅ Counter deployed at:", counter.address);
  
  const hash = await counter.write.incBy([5n]);
  console.log("✅ Called incBy(5):", hash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
