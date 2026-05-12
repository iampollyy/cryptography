const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];

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

  console.log("\n--- Deploying SoulboundVisitCardERC721 ---");
  const SoulboundVisitCard = await hre.ethers.getContractFactory("SoulboundVisitCardERC721");
  const visitCardImageURI = "ipfs://bafybeigo22ftjpfhs3cilqxhgbc46xhwenc7ymufl2vik4wes3ii7bfj2y";
  const visitCard = await SoulboundVisitCard.deploy(deployer.address, visitCardImageURI);
  await visitCard.waitForDeployment();
  const visitCardAddress = await visitCard.getAddress();
  console.log("SoulboundVisitCard deployed to:", visitCardAddress);

  console.log("\n--- Minting visit card to student ---");

  const mintTx = await visitCard.mintVisitCard(
    studentAddress,
    "Polina",
    "Cryptography"
  );
  const mintReceipt = await mintTx.wait();
  console.log("Visit card minted! Tx hash:", mintReceipt.hash);

  const info = await visitCard.getStudentInfo(0);
  console.log("On-chain student info:", {
    name: info.studentName,
    course: info.course,
  });

  const tokenURI = await visitCard.tokenURI(0);
  console.log("Token URI (first 120 chars):", tokenURI.substring(0, 120) + "...");

  console.log("\n--- Testing soulbound (transfer should fail) ---");
  {
    const signer = student || deployer;
    const targetAddr = student ? deployer.address : studentAddress;
    try {
      await visitCard.connect(signer).transferFrom(studentAddress, targetAddr, 0);
      console.log("ERROR: Transfer succeeded (should not happen!)");
    } catch (error) {
      console.log("✅ Transfer correctly reverted:", error.message.includes("non-transferable") ? "Soulbound: token is non-transferable" : error.reason || error.message.slice(0, 120));
    }

    try {
      await visitCard.connect(signer).approve(targetAddr, 0);
      console.log("ERROR: Approve succeeded (should not happen!)");
    } catch (error) {
      console.log("✅ Approval correctly reverted:", error.message.includes("disabled") ? "Soulbound: approvals are disabled" : error.reason || error.message.slice(0, 120));
    }
  }

  console.log("\n--- Deploying GameCharacterCollectionERC1155 ---");
  const GameCharacter = await hre.ethers.getContractFactory("GameCharacterCollectionERC1155");
  const gameChars = await GameCharacter.deploy(deployer.address);
  await gameChars.waitForDeployment();
  const gameCharsAddress = await gameChars.getAddress();
  console.log("GameCharacterCollection deployed to:", gameCharsAddress);

  console.log("\n--- Batch minting 10 game characters ---");
  const tokenIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const amounts  = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

  const batchMintTx = await gameChars.mintBatch(deployer.address, tokenIds, amounts);
  const batchMintReceipt = await batchMintTx.wait();
  console.log("Batch mint tx hash:", batchMintReceipt.hash);

  console.log("\n--- Character Attributes ---");
  for (let i = 0; i < 10; i++) {
    const c = await gameChars.getCharacter(i);
    console.log(`  [${i}] ${c.characterName} | Rarity: ${c.rarity} | STR: ${c.strength} | SPD: ${c.speed} | Color: ${c.color}`);
  }

  console.log("\n--- Batch transferring characters #0 and #1 to student ---");
  const batchTransferTx = await gameChars.safeBatchTransferFrom(
    deployer.address,
    studentAddress,
    [0, 1],
    [1, 1],
    "0x"
  );
  const batchTransferReceipt = await batchTransferTx.wait();
  console.log("Batch transfer tx hash:", batchTransferReceipt.hash);

  console.log("\n--- Final Balances ---");
  for (let i = 0; i < 10; i++) {
    const deployerBal = await gameChars.balanceOf(deployer.address, i);
    const studentBal  = await gameChars.balanceOf(studentAddress, i);
    console.log(`  Token #${i}: deployer=${deployerBal}, student=${studentBal}`);
  }

  console.log("\n--- Generating HTML preview of all NFT images ---");

  const outputDir = path.join(__dirname, "..", "nft-preview");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

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
    .attrs { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
    .attr { background: #16213e; border: 1px solid #e94560; border-radius: 8px; padding: 4px 10px; font-size: 12px; }
    .attr .label { color: #aaa; font-size: 10px; display: block; }
    .attr .value { color: #fff; font-weight: bold; }
  </style>
</head>
<body>
  <h1>NFT On-Chain SVG Preview</h1>
  <p>All images below are generated entirely on-chain — no IPFS or external servers needed.</p>

  <h2>ERC-721 Soulbound Visit Card</h2>
  <div class="cards">`;

  const visitCardUriData = tokenURI.replace("data:application/json;base64,", "");
  const visitCardJson = JSON.parse(Buffer.from(visitCardUriData, "base64").toString("utf-8"));

  let visitCardImageSrc = visitCardJson.image;
  if (visitCardImageSrc.startsWith("ipfs://")) {
    visitCardImageSrc = visitCardImageSrc.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
  }

  let visitCardAttrsHtml = '<div class="attrs">';
  for (const attr of visitCardJson.attributes) {
    visitCardAttrsHtml += `<div class="attr"><span class="label">${attr.trait_type}</span><span class="value">${attr.value}</span></div>`;
  }
  visitCardAttrsHtml += '</div>';

  htmlContent += `
    <div class="card">
      <img src="${visitCardImageSrc}" width="400" alt="Visit Card" style="max-height:400px; object-fit:contain;"/>
      <div class="info">Token #0 — ${visitCardJson.name}</div>
      ${visitCardAttrsHtml}
    </div>`;

  htmlContent += `
  </div>

  <h2>ERC-1155 Game Character Collection</h2>
  <div class="cards">`;

  for (let i = 0; i < 10; i++) {
    const charUri = await gameChars.uri(i);
    const charUriData = charUri.replace("data:application/json;base64,", "");
    const charJson = JSON.parse(Buffer.from(charUriData, "base64").toString("utf-8"));

    let charAttrsHtml = '<div class="attrs">';
    for (const attr of charJson.attributes) {
      charAttrsHtml += `<div class="attr"><span class="label">${attr.trait_type}</span><span class="value">${attr.value}</span></div>`;
    }
    charAttrsHtml += '</div>';

    htmlContent += `
    <div class="card">
      <img src="${charJson.image}" width="300" height="400" alt="${charJson.name}"/>
      <div class="info">Token #${i} — ${charJson.name}</div>
      ${charAttrsHtml}
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
