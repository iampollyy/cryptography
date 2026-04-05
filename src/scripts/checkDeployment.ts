import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";

async function checkDeployment() {
  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
  });

  const contractAddress = "0xe7a8a07496577c29efa41741a6febc281d3770ab";
  
  const code = await client.getCode({ address: contractAddress as `0x${string}` });
  
  console.log(" Contract Address:", contractAddress);
  console.log(" Bytecode exists:", code && code !== "0x" ? "✅ YES" : "❌ NO");
  
  if (code && code !== "0x") {
    console.log(" Bytecode length:", code.length);
    console.log("✅ Contract is deployed correctly!");
  } else {
    console.log("  Contract bytecode not found - deployment may be stuck");
  }
  
  const deployerAddress = "0x851E86F0a2eE7E7c3aE8e8F7481d1a14fE22";
  const txCount = await client.getTransactionCount({ address: deployerAddress as `0x${string}` });
  
  console.log("\n Deployer address:", deployerAddress);
  console.log(" Transaction count:", txCount);
}

checkDeployment().catch(console.error);
