/**
 * IntelliStake — Multi-Contract Hardhat Deploy Script
 * =====================================================
 * Deploys the full IntelliStake blockchain stack to Sepolia testnet:
 *   1. IdentityRegistry.sol     — KYC/DID on-chain registry
 *   2. IntelliStakeToken.sol    — ERC-3643 $ISTK security token
 *   3. IntelliStakeInvestment.sol — Milestone escrow with AI trust gating
 *
 * Then wires them together and simulates 3 investment deals
 * from real IntelliStake portfolio companies.
 *
 * Setup:
 *   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
 *   npx hardhat compile
 *   npx hardhat run scripts/deploy.js --network sepolia
 *
 * Env vars needed in .env:
 *   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
 *   PRIVATE_KEY=your_wallet_private_key
 *   ETHERSCAN_API_KEY=your_etherscan_key (for verification)
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Real portfolio startups (from IntelliStake production data)
const DEMO_DEALS = [
    {
        name: "Zepto",
        sector: "eCommerce",
        trustScore: 82,
        valUSD: 5_000_000,   // $5B predicted ×10^6
        milestones: ["Series B Close", "10-min Delivery Rollout", "Profitability"],
        amounts: ["0.003", "0.004", "0.002"],
        thresholds: [70, 75, 80],
    },
    {
        name: "Razorpay",
        sector: "FinTech",
        trustScore: 91,
        valUSD: 7_500_000,
        milestones: ["RBI KYC Compliance", "API v3 Launch", "Series F"],
        amounts: ["0.004", "0.003", "0.003"],
        thresholds: [75, 80, 85],
    },
    {
        name: "Byju's",
        sector: "EdTech",
        trustScore: 38,
        valUSD: 250_000,
        milestones: ["Audit Clean", "Debt Resolution", "User Retention ≥ 50%"],
        amounts: ["0.001", "0.002", "0.001"],
        thresholds: [35, 40, 45],
    },
];

async function deployContract(name, ...args) {
    console.log(`\n  Deploying ${name}…`);
    const Factory = await ethers.getContractFactory(name);
    const contract = await Factory.deploy(...args);
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    console.log(`  ✅ ${name}: ${addr}`);
    console.log(`     Tx: ${contract.deploymentTransaction()?.hash}`);
    return { contract, addr };
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance = await deployer.provider.getBalance(deployer.address);

    console.log("\n" + "=".repeat(60));
    console.log("  IntelliStake — Full Blockchain Stack Deployment");
    console.log("=".repeat(60));
    console.log(`\n  Deployer: ${deployer.address}`);
    console.log(`  Balance:  ${ethers.formatEther(balance)} ETH\n`);

    // ── Step 1: Deploy IdentityRegistry ────────────────────────────────────────
    console.log("[1/5] Deploying IdentityRegistry.sol …");
    const { contract: registry, addr: registryAddr } =
        await deployContract("IdentityRegistry");

    // ── Step 2: Deploy IntelliStakeToken ($ISTK) ────────────────────────────────
    console.log("\n[2/5] Deploying IntelliStakeToken.sol ($ISTK) …");
    const { contract: token, addr: tokenAddr } =
        await deployContract("IntelliStakeToken", deployer.address);

    // Wire token → registry
    console.log("  → Wiring IdentityRegistry into IntelliStakeToken…");
    const wireTx = await token.setIdentityRegistry(registryAddr);
    await wireTx.wait();
    console.log("  ✅ Identity registry set on token contract");

    // ── Step 3: Deploy IntelliStakeInvestment (Escrow) ─────────────────────────
    console.log("\n[3/5] Deploying IntelliStakeInvestment.sol (Milestone Escrow) …");
    const { contract: escrow, addr: escrowAddr } =
        await deployContract("IntelliStakeInvestment");

    // ── Step 4: Simulate investment deals ──────────────────────────────────────
    console.log("\n[4/5] Simulating investment deals from IntelliStake portfolio…");
    const PLACEHOLDER = "0x000000000000000000000000000000000000dEaD";

    for (let i = 0; i < DEMO_DEALS.length; i++) {
        const deal = DEMO_DEALS[i];
        console.log(`\n  Deal ${i}: ${deal.name} (${deal.sector}) — trust: ${deal.trustScore}/100`);

        const totalEth = deal.amounts.reduce(
            (sum, a) => sum + parseFloat(a), 0
        );
        const totalWei = ethers.parseEther(totalEth.toFixed(4));
        const milestoneAmts = deal.amounts.map(a => ethers.parseEther(a));
        const platformFeeBps = 50n;
        const platformFee = (totalWei * platformFeeBps) / 10_000n;
        const investmentValue = totalWei;   // send enough; contract deducts fee

        // Skip if trust < 30 (contract guard)
        if (deal.trustScore < 30) {
            console.log(`  ⚠️  Skipping ${deal.name} — trust score below minimum (${deal.trustScore}/100)`);
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
                milestoneAmts,
                deal.thresholds,
                { value: investmentValue }
            );
            const receipt = await tx.wait();
            console.log(`  ✅ Deal ${i} created | Gas: ${receipt.gasUsed.toLocaleString()}`);

            // Read deal back
            const info = await escrow.getDealInfo(i);
            console.log(`     Startup:      ${info.startupName}`);
            console.log(`     Total locked: ${ethers.formatEther(info.totalAmount)} ETH`);
            console.log(`     Trust score:  ${info.trustScore}/100`);
            console.log(`     Milestones:   ${info.milestoneCount}`);
        } catch (err) {
            console.log(`  ⚠️  Deal ${i} skipped: ${err.message.slice(0, 80)}`);
        }
    }

    // Platform stats
    const tvl = await escrow.totalValueLocked();
    const totalD = await escrow.totalInvestments();
    console.log(`\n  TVL:               ${ethers.formatEther(tvl)} ETH`);
    console.log(`  Total deals:       ${totalD}`);

    // ── Step 5: Save deployment manifest ───────────────────────────────────────
    console.log("\n[5/5] Saving deployment manifest…");
    const manifest = {
        network: "Sepolia Testnet",
        deployed_at: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            IdentityRegistry: {
                address: registryAddr,
                purpose: "KYC / ERC-3643 DID registry",
                abi_file: "IdentityRegistry.sol",
            },
            IntelliStakeToken: {
                address: tokenAddr,
                symbol: "$ISTK",
                standard: "ERC-3643",
                purpose: "AI-vetted startup security token",
                abi_file: "IntelliStakeToken.sol",
            },
            IntelliStakeInvestment: {
                address: escrowAddr,
                purpose: "Milestone escrow with AI trust gating",
                abi_file: "IntelliStakeInvestment.sol",
                platform_fee_bps: 50,
            },
        },
        demo_deals: DEMO_DEALS.map((d, i) => ({ dealId: i, startup: d.name, sector: d.sector, trustScore: d.trustScore })),
        verify_cmds: [
            `npx hardhat verify --network sepolia ${registryAddr}`,
            `npx hardhat verify --network sepolia ${tokenAddr} "${deployer.address}"`,
            `npx hardhat verify --network sepolia ${escrowAddr}`,
        ],
    };

    const outPath = path.join(__dirname, "..", "deployment.json");
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
    console.log(`  ✅ Saved → ${outPath}`);

    console.log("\n" + "=".repeat(60));
    console.log("  ✅ IntelliStake Blockchain Stack Deployed!");
    console.log("=".repeat(60));
    console.log(`\n  IdentityRegistry:       ${registryAddr}`);
    console.log(`  IntelliStakeToken ISTK: ${tokenAddr}`);
    console.log(`  IntelliStakeInvestment: ${escrowAddr}`);
    console.log(`\n  Explorer: https://sepolia.etherscan.io`);
    console.log(`  Search each address above to verify on-chain ✅\n`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
