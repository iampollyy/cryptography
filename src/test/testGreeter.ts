import { createPublicClient, http, getContract } from "viem";
import { arbitrumSepolia } from "viem/chains";

const GREETER_ABI = [
  {
    inputs: [],
    name: "greet",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getName",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

async function testGreeter() {
  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
  });

  const contractAddress = "0xe7a8a07496577c29efa41741a6febc281d3770ab";
  
  const contract = getContract({
    address: contractAddress as `0x${string}`,
    abi: GREETER_ABI,
    client,
  });

  console.log(" Contract Address:", contractAddress);
  console.log("\n Testing contract functions:\n");
  
  const greeting = await contract.read.greet();
  console.log(" greet():", greeting);
  
  const name = await contract.read.getName();
  console.log(" getName():", name);
}

testGreeter().catch(console.error);
