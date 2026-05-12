// scripts/deploy.js
//
// Deploys both contracts and demonstrates full functionality:
//   1. Mints a soulbound visit card to a student
//   2. Batch-mints 10 game characters
//   3. Transfers 2 characters to the student's wallet
//   4. Verifies soulbound behaviour (transfer reverts)
//   5. Saves on-chain SVG images to HTML files for viewing

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];

  // For Sepolia: use STUDENT_ADDRESS from .env, for local: use second signer
  let studentAddress = process.env.STUDENT_ADDRESS;
  let student;
  if (signers.length > 1 && (!studentAddress || studentAddress === "0xYourStudentWalletAddressHere")) {
    student = signers[1];
    studentAddress = student.address;
  } else if (!studentAddress || studentAddress === "0xYourStudentWalletAddressHere") {
    studentAddress = deployer.address;
  }

  console.log("=".repeat(60));
  console.log("Deployer address:", deployer.address);
  console.log("Student address: ", studentAddress);
  console.log("=".repeat(60));

  // ═══════════════════════════════════════════════════════════════
  //  1. DEPLOY & MINT SOULBOUND VISIT CARD (ERC-721)
  // ═══════════════════════════════════════════════════════════════

  console.log("\n--- Deploying SoulboundVisitCardERC721 ---");
  const SoulboundVisitCard = await hre.ethers.getContractFactory("SoulboundVisitCardERC721");
  const visitCard = await SoulboundVisitCard.deploy(deployer.address);
  await visitCard.waitForDeployment();
  const visitCardAddress = await visitCard.getAddress();
  console.log("SoulboundVisitCard deployed to:", visitCardAddress);

  // Mint a visit card to the student
  console.log("\n--- Minting visit card to student ---");

  const mintTx = await visitCard.mintVisitCard(
    studentAddress,
    "Polina Trybialustava",  // studentName
    "2024001",               // studentID
    "Cryptography",          // course
    "2024"                   // year
  );
  const mintReceipt = await mintTx.wait();
  console.log("Visit card minted! Tx hash:", mintReceipt.hash);

  // Read back on-chain student info
  const info = await visitCard.getStudentInfo(0);
  console.log("On-chain student info:", {
    name: info.studentName,
    id: info.studentID,
    course: info.course,
    year: info.year,
  });

  // Retrieve and display tokenURI (on-chain base64 JSON with SVG)
  const tokenURI = await visitCard.tokenURI(0);
  console.log("Token URI (first 120 chars):", tokenURI.substring(0, 120) + "...");

  // Verify soulbound: try to transfer → should revert
  console.log("\n--- Testing soulbound (transfer should fail) ---");
  if (student) {
    try {
      const visitCardAsStudent = visitCard.connect(student);
      await visitCardAsStudent.transferFrom(studentAddress, deployer.address, 0);
      console.log("ERROR: Transfer succeeded (should not happen!)");
    } catch (error) {
      console.log("Transfer correctly reverted:", error.message.includes("non-transferable") ? "Soulbound: token is non-transferable" : error.message);
    }

    // Verify soulbound: try to approve → should revert
    try {
      const visitCardAsStudent = visitCard.connect(student);
      await visitCardAsStudent.approve(deployer.address, 0);
      console.log("ERROR: Approve succeeded (should not happen!)");
    } catch (error) {
      console.log("Approval correctly reverted:", error.message.includes("disabled") ? "Soulbound: approvals are disabled" : error.message);
    }
  } else {
    console.log("(Skipping transfer test — single signer mode on testnet)");
  }

  // ═══════════════════════════════════════════════════════════════
  //  2. DEPLOY & MINT GAME CHARACTERS (ERC-1155)
  // ═══════════════════════════════════════════════════════════════

  console.log("\n--- Deploying GameCharacterCollectionERC1155 ---");
  const GameCharacter = await hre.ethers.getContractFactory("GameCharacterCollectionERC1155");
  const gameChars = await GameCharacter.deploy(deployer.address);
  await gameChars.waitForDeployment();
  const gameCharsAddress = await gameChars.getAddress();
  console.log("GameCharacterCollection deployed to:", gameCharsAddress);

  // Batch-mint all 10 characters (1 of each) to the deployer
  console.log("\n--- Batch minting 10 game characters ---");
  const tokenIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const amounts  = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

  const batchMintTx = await gameChars.mintBatch(deployer.address, tokenIds, amounts);
  const batchMintReceipt = await batchMintTx.wait();
  console.log("Batch mint tx hash:", batchMintReceipt.hash);

  // Print all character attributes
  console.log("\n--- Character Attributes ---");
  for (let i = 0; i < 10; i++) {
    const c = await gameChars.getCharacter(i);
    console.log(`  [${i}] ${c.characterName} | Rarity: ${c.rarity} | STR: ${c.strength} | SPD: ${c.speed} | Color: ${c.color}`);
  }

  // Transfer 2 characters to the student (IDs 0 and 1) via batch transfer
  console.log("\n--- Batch transferring characters #0 and #1 to student ---");
  const batchTransferTx = await gameChars.safeBatchTransferFrom(
    deployer.address,
    studentAddress,
    [0, 1],   // token IDs
    [1, 1],   // amounts
    "0x"      // data
  );
  const batchTransferReceipt = await batchTransferTx.wait();
  console.log("Batch transfer tx hash:", batchTransferReceipt.hash);

  // Verify balances
  console.log("\n--- Final Balances ---");
  for (let i = 0; i < 10; i++) {
    const deployerBal = await gameChars.balanceOf(deployer.address, i);
    const studentBal  = await gameChars.balanceOf(studentAddress, i);
    console.log(`  Token #${i}: deployer=${deployerBal}, student=${studentBal}`);
  }

  // ═══════════════════════════════════════════════════════════════
  //  3. SAVE SVG IMAGES TO HTML FOR VIEWING
  // ═══════════════════════════════════════════════════════════════

  console.log("\n--- Generating HTML preview of all NFT images ---");

  const outputDir = path.join(__dirname, "..", "nft-preview");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Extract SVG from visit card tokenURI
  let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NFT Preview — On-Chain SVG Images</title>
  <style>
    body { background: #111; color: #eee; font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #e94560; }
    h2 { color: #87ceeb; margin-top: 40px; }
    .cards { display: flex; flex-wrap: wrap; gap: 20px; }
    .card { background: #1a1a2e; border-radius: 15px; padding: 15px; }
    .card img { border-radius: 10px; }
    .info { margin-top: 8px; font-size: 12px; color: #aaa; }
  </style>
</head>
<body>
  <h1>NFT On-Chain SVG Preview</h1>
  <p>All images below are generated entirely on-chain — no IPFS or external servers needed.</p>

  <h2>ERC-721 Soulbound Visit Card</h2>
  <div class="cards">`;

  // Decode visit card tokenURI
  const visitCardUriData = tokenURI.replace("data:application/json;base64,", "");
  const visitCardJson = JSON.parse(Buffer.from(visitCardUriData, "base64").toString("utf-8"));

  htmlContent += `
    <div class="card">
      <img src="${visitCardJson.image}" width="400" height="250" alt="Visit Card"/>
      <div class="info">Token #0 — ${visitCardJson.name}</div>
    </div>`;

  htmlContent += `
  </div>

  <h2>ERC-1155 Game Character Collection</h2>
  <div class="cards">`;

  // Decode each character URI
  for (let i = 0; i < 10; i++) {
    const charUri = await gameChars.uri(i);
    const charUriData = charUri.replace("data:application/json;base64,", "");
    const charJson = JSON.parse(Buffer.from(charUriData, "base64").toString("utf-8"));

    htmlContent += `
    <div class="card">
      <img src="${charJson.image}" width="300" height="400" alt="${charJson.name}"/>
      <div class="info">Token #${i} — ${charJson.name}</div>
    </div>`;
  }

  htmlContent += `
  </div>
</body>
</html>`;

  const htmlPath = path.join(outputDir, "index.html");
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`NFT preview saved to: ${htmlPath}`);
  console.log("Open this file in a browser to view all on-chain SVG images!");

  console.log("\n" + "=".repeat(60));
  console.log("Deployment and demo complete!");
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
