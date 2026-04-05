import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  
  console.log(" Deploying updated Greeter contract...");
  
  const greeter = await viem.deployContract("Greeter", ["Polina"]);
  
  console.log("✅ Greeter deployed at:", greeter.address);
  console.log(" Constructor parameter: Polina\n");
  
  const greeting = await greeter.read.greet();
  console.log(" Greeting message:", greeting);
  
  const name = await greeter.read.getName();
  console.log(" Name stored:", name);
  
  console.log("\n Calling callGreeting() function (creates transaction on chain)...");
  const txHash = await greeter.write.callGreeting();
  console.log("✅ Transaction Hash:", txHash);
  console.log(" View on Arbiscan: https://sepolia.arbiscan.io/tx/" + txHash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
