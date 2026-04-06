/**
 * IntelliStake — Seed Demo Investment Deals
 * Runs against already-deployed IntelliStakeInvestment contract on Sepolia.
 * Fixes the milestone sum math: amounts sum to 97.5% of value (leaving 0.5% for platform fee + safety margin).
 */
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const DEPLOYMENT = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployment.json"), "utf8")
);
const ESCROW_ADDR = DEPLOYMENT.contracts.IntelliStakeInvestment.address;

// Use 0xdead as placeholder startup wallet (burn address — safe for demo)
const PLACEHOLDER = "0x000000000000000000000000000000000000dEaD";

// Each deal sends X ETH, milestones sum to 97% of that (leaving 3% buffer for fee)
const DEMO_DEALS = [
    {
        name: "Zepto",
        sector: "eCommerce",
        trustScore: 82,
        valUSD: 5_000_000,
        sendEth: "0.012",
        // milestones sum = 0.0116 ETH = 96.7% of 0.012 → well under (0.012 - fee)
        milestoneAmounts: ["0.004", "0.004", "0.0036"],
        milestones: ["Series B Close", "10-min Delivery Rollout", "Profitability"],
        thresholds: [70, 75, 80],
    },
    {
        name: "Razorpay",
        sector: "FinTech",
        trustScore: 91,
        valUSD: 7_500_000,
        sendEth: "0.012",
        milestoneAmounts: ["0.004", "0.004", "0.0036"],
        milestones: ["RBI KYC Compliance", "API v3 Launch", "Series F"],
        thresholds: [75, 80, 85],
    },
    {
        name: "Meesho",
        sector: "eCommerce",
        trustScore: 74,
        valUSD: 3_600_000,
        sendEth: "0.008",
        milestoneAmounts: ["0.0025", "0.0025", "0.0024"],
        milestones: ["Profitability Q1", "10M Active Users", "Series E Close"],
        thresholds: [65, 70, 75],
    },
];

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`\nSeeding deals on deployed escrow: ${ESCROW_ADDR}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance:  ${ethers.formatEther(balance)} ETH\n`);

    const artifact = require("../artifacts/contracts/IntelliStakeInvestment.sol/IntelliStakeInvestment.json");
    const escrow = new ethers.Contract(ESCROW_ADDR, artifact.abi, deployer);

    let successCount = 0;

    for (let i = 0; i < DEMO_DEALS.length; i++) {
        const deal = DEMO_DEALS[i];
        const sendWei = ethers.parseEther(deal.sendEth);
        const milestoneWei = deal.milestoneAmounts.map(a => ethers.parseEther(a));
        const milestoneSum = milestoneWei.reduce((a, b) => a + b, 0n);
        const platformFee = (sendWei * 50n) / 10_000n;

        console.log(`Deal ${i}: ${deal.name} (${deal.sector}) — trust: ${deal.trustScore}/100`);
        console.log(`  Sending:        ${deal.sendEth} ETH`);
        console.log(`  Platform fee:   ${ethers.formatEther(platformFee)} ETH`);
        console.log(`  Milestone sum:  ${ethers.formatEther(milestoneSum)} ETH`);
        console.log(`  Available:      ${ethers.formatEther(sendWei - platformFee)} ETH`);

        if (milestoneSum > sendWei - platformFee) {
            console.log(`  ❌ Math check failed — skipping\n`);
            continue;
        }

        try {
            const tx = await escrow.createInvestment(
                PLACEHOLDER,
                deal.name,
                deal.sector,
                deal.trustScore,
                deal.valUSD,
                deal.milestones,
                milestoneWei,
                deal.thresholds,
                { value: sendWei }
            );
            console.log(`  ⏳ TX sent: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`  ✅ Confirmed in block ${receipt.blockNumber} | Gas: ${receipt.gasUsed.toLocaleString()}`);

            const info = await escrow.getDealInfo(i);
            console.log(`     Locked: ${ethers.formatEther(info.totalAmount)} ETH | Milestones: ${info.milestoneCount}\n`);
            successCount++;
        } catch (err) {
            console.log(`  ⚠️  Failed: ${err.message.slice(0, 100)}\n`);
        }
    }

    const tvl = await escrow.totalValueLocked();
    const totalDeals = await escrow.totalInvestments();
    console.log(`\n✅ Seeding complete!`);
    console.log(`   Deals created: ${successCount}/${DEMO_DEALS.length}`);
    console.log(`   Total deals on-chain: ${totalDeals}`);
    console.log(`   TVL: ${ethers.formatEther(tvl)} ETH`);
    console.log(`\n🔗 View on Etherscan: https://sepolia.etherscan.io/address/${ESCROW_ADDR}`);

    // Patch deployment.json with deal results
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployment.json"), "utf8"));
    manifest.demo_deals_seeded = true;
    manifest.demo_deals_count = Number(totalDeals);
    manifest.tvl_eth = ethers.formatEther(tvl);
    fs.writeFileSync(path.join(__dirname, "..", "deployment.json"), JSON.stringify(manifest, null, 2));
    console.log(`   deployment.json updated.`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
