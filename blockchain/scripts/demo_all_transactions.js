/**
 * IntelliStake — Full Transaction Demo
 * ======================================
 * Deploys ALL 7 contracts on a local Hardhat network and executes
 * every public/external transaction type once, with a live log.
 *
 * Run:
 *   npx hardhat node &           # start local node in background
 *   npx hardhat run scripts/demo_all_transactions.js --network localhost
 *
 * What is covered:
 *   A. IdentityRegistry   — KYC register, update, revoke, restore, views
 *   B. ComplianceRules    — KYC/accreditation, scores, freeze, view
 *   C. IntelliStakeToken  — mint, transfer, tranche, freeze, pause
 *   D. IntelliStakeInvestment — create deals, milestones, refund, fees
 *   E. MilestoneEscrow    — deposit, oracle approve, freeze, restore
 *   F. TrustOracle        — ECDSA push, emergency freeze, view
 *   G. AgentVault         — deposit, invest, emergency withdraw, params
 */

const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEP  = "─".repeat(60);
const DSEP = "═".repeat(60);

function header(title) {
    console.log(`\n${DSEP}`);
    console.log(`  ${title}`);
    console.log(DSEP);
}

function section(label) {
    console.log(`\n${SEP}`);
    console.log(`  ${label}`);
    console.log(SEP);
}

async function tx(label, txPromise) {
    process.stdout.write(`  ⏳  ${label}…`);
    try {
        const t   = await txPromise;
        const rec = await t.wait();
        console.log(` ✅  gas: ${rec.gasUsed.toLocaleString()}  txHash: ${rec.hash}`);
        return rec;
    } catch (e) {
        console.log(` ❌  ${e.reason || e.message}`);
        throw e;
    }
}

function view(label, value) {
    console.log(`  📋  ${label}: ${JSON.stringify(value, (_, v) =>
        typeof v === "bigint" ? v.toString() : v)}`);
}

/** Build a TrustOracle ECDSA signature.
 *  messageHash = keccak256(startupId ‖ trustScore ‖ dataTimestamp ‖ nonce)
 *  signature   = eth_sign(messageHash)  [with \x19 prefix]
 */
async function buildOracleSignature(signer, startupId, trustScore, dataTimestamp, nonce) {
    const messageHash = ethers.keccak256(
        ethers.solidityPacked(
            ["bytes32", "uint256", "uint256", "bytes32"],
            [startupId, trustScore, dataTimestamp, nonce]
        )
    );
    const signature = await signer.signMessage(ethers.getBytes(messageHash));
    return { messageHash, signature };
}

/** Build an IntelliStakeToken milestone proof.
 *  innerHash = keccak256(milestoneHash ‖ chainId)
 *  proof     = eth_sign(innerHash)
 */
async function buildMilestoneProof(signer, milestoneHash, chainId) {
    const innerHash = ethers.keccak256(
        ethers.solidityPacked(["bytes32", "uint256"], [milestoneHash, chainId])
    );
    return signer.signMessage(ethers.getBytes(innerHash));
}

// ── Deploy helper ─────────────────────────────────────────────────────────────

async function deploy(name, ...args) {
    process.stdout.write(`  ⏳  Deploying ${name}…`);
    const F  = await ethers.getContractFactory(name);
    const c  = await F.deploy(...args);
    await c.waitForDeployment();
    const addr = await c.getAddress();
    console.log(` ✅  ${addr}`);
    return c;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const signers    = await ethers.getSigners();
    const deployer   = signers[0];  // owner of all contracts
    const investor1  = signers[1];  // Alpha Capital — Accredited
    const investor2  = signers[2];  // Beta Fund — Institutional
    const startup_zepto    = signers[3];
    const startup_razorpay = signers[4];
    const startup_byjus    = signers[5];
    const oracleSigner     = signers[6];  // off-chain AI oracle key
    const agentOperator    = signers[7];  // AI Agent operator

    const chainId = (await ethers.provider.getNetwork()).chainId;

    header("IntelliStake — Full Transaction Demo");
    console.log(`  Deployer        : ${deployer.address}`);
    console.log(`  Investor1       : ${investor1.address}  (Alpha Capital)`);
    console.log(`  Investor2       : ${investor2.address}  (Beta Fund)`);
    console.log(`  Zepto wallet    : ${startup_zepto.address}`);
    console.log(`  Razorpay wallet : ${startup_razorpay.address}`);
    console.log(`  Byju's wallet   : ${startup_byjus.address}`);
    console.log(`  OracleSigner    : ${oracleSigner.address}`);
    console.log(`  AgentOperator   : ${agentOperator.address}`);
    console.log(`  ChainId         : ${chainId}`);

    // ── DEPLOY ALL 7 CONTRACTS ────────────────────────────────────────────────

    section("Deploying All 7 Contracts");

    const identityRegistry    = await deploy("IdentityRegistry");
    const token               = await deploy("IntelliStakeToken", deployer.address);
    const investment          = await deploy("IntelliStakeInvestment");
    const complianceRules     = await deploy("ComplianceRules",
                                    await identityRegistry.getAddress(),
                                    ethers.ZeroAddress   // no external module
                                );
    // Deploy MilestoneEscrow with deployer as temporary oracle
    const milestoneEscrow     = await deploy("MilestoneEscrow", deployer.address);
    // TrustOracle wires to MilestoneEscrow + ComplianceRules
    const trustOracle         = await deploy("TrustOracle",
                                    oracleSigner.address,
                                    await milestoneEscrow.getAddress(),
                                    await complianceRules.getAddress()
                                );
    // AgentVault: deployer = operator + oracle for full demo control
    const agentVault          = await deploy("AgentVault",
                                    deployer.address,           // operator
                                    deployer.address,           // oracle (temporary)
                                    await identityRegistry.getAddress(),
                                    await milestoneEscrow.getAddress(),
                                    6500n,                      // minCIS = 0.65
                                    2000n                       // maxAlloc = 20 %
                                );

    const IR_ADDR  = await identityRegistry.getAddress();
    const TOK_ADDR = await token.getAddress();
    const INV_ADDR = await investment.getAddress();
    const CR_ADDR  = await complianceRules.getAddress();
    const ME_ADDR  = await milestoneEscrow.getAddress();
    const TO_ADDR  = await trustOracle.getAddress();
    const AV_ADDR  = await agentVault.getAddress();

    console.log("\n  Contract Addresses:");
    console.log(`    IdentityRegistry    : ${IR_ADDR}`);
    console.log(`    IntelliStakeToken   : ${TOK_ADDR}`);
    console.log(`    IntelliStakeInvest  : ${INV_ADDR}`);
    console.log(`    ComplianceRules     : ${CR_ADDR}`);
    console.log(`    MilestoneEscrow     : ${ME_ADDR}`);
    console.log(`    TrustOracle         : ${TO_ADDR}`);
    console.log(`    AgentVault          : ${AV_ADDR}`);

    section("Wiring Contracts Together");

    await tx("token.setIdentityRegistry",   token.setIdentityRegistry(IR_ADDR));
    await tx("token.setCompliance",         token.setCompliance(CR_ADDR));
    await tx("token.setOracleAddress",      token.setOracleAddress(oracleSigner.address));
    await tx("identityRegistry.setTokenContract", identityRegistry.setTokenContract(TOK_ADDR));
    await tx("complianceRules.addOracle",   complianceRules.addOracle(TO_ADDR));

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION A — IdentityRegistry
    // ═══════════════════════════════════════════════════════════════════════════

    header("A. IdentityRegistry Transactions");

    section("A1. Operator Management");
    await tx("addOperator(deployer)",   identityRegistry.addOperator(deployer.address));
    await tx("removeOperator(deployer) [then re-add]",
             identityRegistry.removeOperator(deployer.address));
    await tx("addOperator(deployer) [restore]",
             identityRegistry.addOperator(deployer.address));

    section("A2. Register Investors");
    await tx("registerInvestor — Alpha Capital (KYC Level 2 = Accredited)",
             identityRegistry.registerInvestor(investor1.address, "Alpha Capital", 2, "NMIMS-KYC"));
    await tx("registerInvestor — Beta Fund (KYC Level 3 = Institutional)",
             identityRegistry.registerInvestor(investor2.address, "Beta Fund", 3, "NMIMS-KYC"));

    section("A3. Batch Register Startups");
    await tx("batchRegister — Zepto, Razorpay, Byju's (KYC Level 1 = Retail)",
             identityRegistry.batchRegister(
                 [startup_zepto.address, startup_razorpay.address, startup_byjus.address],
                 ["Zepto Technologies", "Razorpay Pvt Ltd", "Think & Learn Pvt Ltd"],
                 [1, 1, 1],
                 "NMIMS-KYC"
             ));

    section("A4. KYC Updates");
    await tx("updateKycLevel — investor1 upgraded to Institutional (3)",
             identityRegistry.updateKycLevel(investor1.address, 3));
    await tx("revokeIdentity — investor2 temporarily revoked",
             identityRegistry.revokeIdentity(investor2.address, "Pending FEMA compliance check"));
    await tx("restoreIdentity — investor2 restored",
             identityRegistry.restoreIdentity(investor2.address));

    section("A5. View Calls");
    view("isVerified(investor1)",  await identityRegistry.isVerified(investor1.address));
    view("isVerified(investor2)",  await identityRegistry.isVerified(investor2.address));
    view("meetsKycLevel(investor1, 2)", await identityRegistry.meetsKycLevel(investor1.address, 2));
    view("kycLevelLabel(investor1)",    await identityRegistry.kycLevelLabel(investor1.address));
    view("kycLevelLabel(startup_zepto)", await identityRegistry.kycLevelLabel(startup_zepto.address));
    view("totalRegistered",  await identityRegistry.totalRegistered());

    const counts = await identityRegistry.kycLevelCounts();
    view("kycLevelCounts", {
        retail: counts[0].toString(), accredited: counts[1].toString(),
        institutional: counts[2].toString(), revoked: counts[3].toString()
    });

    const identity = await identityRegistry.getIdentity(investor1.address);
    view("getIdentity(investor1)", {
        entityName: identity.entityName,
        kycLevel:   identity.kycLevel.toString(),
        kycProvider: identity.kycProvider,
        isActive:   identity.isActive
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION B — ComplianceRules
    // ═══════════════════════════════════════════════════════════════════════════

    header("B. ComplianceRules Transactions");

    section("B1. Set KYC & Accreditation");
    await tx("setKYCVerified(investor1, true)",  complianceRules.setKYCVerified(investor1.address, true));
    await tx("setKYCVerified(investor2, true)",  complianceRules.setKYCVerified(investor2.address, true));
    await tx("setAccredited(investor1, true)",   complianceRules.setAccredited(investor1.address, true));
    await tx("setAccredited(investor2, true)",   complianceRules.setAccredited(investor2.address, true));

    section("B2. Batch Verify Investors");
    await tx("batchVerifyInvestors — startups get KYC but NOT accreditation",
             complianceRules.batchVerifyInvestors(
                 [startup_zepto.address, startup_razorpay.address, startup_byjus.address],
                 [true, true, true],
                 [false, false, false]
             ));

    section("B3. Compliance Score & Freeze");
    await tx("updateComplianceScore(startup_zepto, 75) — healthy",
             complianceRules.updateComplianceScore(TOK_ADDR, 75));
    await tx("setTransferEnabled(token, false, 'Risk flag: high leverage') — FREEZE",
             complianceRules.setTransferEnabled(TOK_ADDR, false, "Risk flag: high leverage"));
    await tx("setTransferEnabled(token, true, 'Risk resolved') — UNFREEZE",
             complianceRules.setTransferEnabled(TOK_ADDR, true, "Risk resolved"));

    section("B4. View Calls");
    const invStatus = await complianceRules.getInvestorStatus(investor1.address);
    view("getInvestorStatus(investor1)", {
        kyc: invStatus[0], accredited: invStatus[1], fullPass: invStatus[2]
    });
    const startupComp = await complianceRules.getStartupCompliance(TOK_ADDR);
    view("getStartupCompliance(token)", {
        enabled: startupComp[0], score: startupComp[1].toString(), healthy: startupComp[2]
    });

    // canTransfer view (pass: both investors KYC + accredited)
    const [canTx1, reason1] = await complianceRules.canTransfer(
        investor1.address, investor2.address,
        ethers.parseUnits("2000", 18), TOK_ADDR
    );
    view("canTransfer(investor1→investor2, 2000 ISTK)", { allowed: canTx1, reason: reason1 });

    section("B5. Oracle & Ownership Management");
    await tx("removeOracle(trustOracle) [show control]",  complianceRules.removeOracle(TO_ADDR));
    await tx("addOracle(trustOracle) [restore]",          complianceRules.addOracle(TO_ADDR));
    await tx("setMinTransferAmount(500 ISTK)",
             complianceRules.setMinTransferAmount(ethers.parseUnits("500", 18)));
    await tx("setMaxHoldingBps(2500) = 25%",              complianceRules.setMaxHoldingBps(2500));

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION C — IntelliStakeToken ($ISTK)
    // ═══════════════════════════════════════════════════════════════════════════

    header("C. IntelliStakeToken ($ISTK) Transactions");

    section("C1. Accreditation Whitelist");
    await tx("setAccreditedInvestor(investor1, true)",  token.setAccreditedInvestor(investor1.address, true));
    await tx("setAccreditedInvestor(investor2, true)",  token.setAccreditedInvestor(investor2.address, true));
    await tx("batchSetAccreditedInvestors [Zepto + Razorpay]",
             token.batchSetAccreditedInvestors(
                 [startup_zepto.address, startup_razorpay.address, startup_byjus.address],
                 [true, true, true]
             ));

    section("C2. Mint Tokens");
    await tx("mint(investor1, 50,000 ISTK)",
             token.mint(investor1.address, ethers.parseUnits("50000", 18)));
    await tx("mint(investor2, 100,000 ISTK)",
             token.mint(investor2.address, ethers.parseUnits("100000", 18)));

    section("C3. Transfer Tokens");
    view("canTransfer(investor1→investor2, 2000 ISTK)",
         await token.canTransfer(investor1.address, investor2.address, ethers.parseUnits("2000", 18)));
    await tx("transfer(investor2, 2000 ISTK) [from investor1]",
             token.connect(investor1).transfer(investor2.address, ethers.parseUnits("2000", 18)));
    view("balanceOf(investor1)",  (await token.balanceOf(investor1.address)).toString());
    view("balanceOf(investor2)",  (await token.balanceOf(investor2.address)).toString());

    section("C4. Token Parameters");
    await tx("setMaxHolding(2,000,000 ISTK)",
             token.setMaxHolding(ethers.parseUnits("2000000", 18)));
    await tx("setMinInvestment(500 ISTK)",
             token.setMinInvestment(ethers.parseUnits("500", 18)));

    section("C5. Pause & Unpause");
    await tx("pause()",   token.pause());
    await tx("unpause()", token.unpause());

    section("C6. Milestone Tranche — lockTranche + releaseTranche (ECDSA)");
    const milestoneHash = ethers.id("ZEPTO_MVP_LAUNCH_2026");   // keccak256 of string
    const trancheAmt    = ethers.parseUnits("5000", 18);
    await tx("lockTranche(startupId=1, 5000 ISTK, milestoneHash, startup_zepto)",
             token.lockTranche(1n, trancheAmt, milestoneHash, startup_zepto.address));
    view("getLockedAmount(startupId=1)", (await token.getLockedAmount(1n)).toString());
    view("getStartupTranches(1)",
        (await token.getStartupTranches(1n)).map(t => ({
            amount: t.amount.toString(), released: t.released
        })));

    // Build oracle proof for releaseTranche
    const proof = await buildMilestoneProof(oracleSigner, milestoneHash, chainId);
    await tx("releaseTranche(startupId=1, index=0, ECDSA proof)",
             token.releaseTranche(1n, 0n, proof));
    view("getLockedAmount(1) after release", (await token.getLockedAmount(1n)).toString());
    view("balanceOf(startup_zepto) after release",
         (await token.balanceOf(startup_zepto.address)).toString());

    section("C7. Milestone Freeze / Restore");
    await tx("freezeMilestoneFunding(startup_byjus, 'Trust score 0.28 < threshold')",
             token.freezeMilestoneFunding(startup_byjus.address, "Trust score 0.28 < threshold"));
    view("getMilestoneStatus(startup_byjus)", await token.getMilestoneStatus(startup_byjus.address));
    await tx("restoreMilestoneFunding(startup_byjus)",
             token.restoreMilestoneFunding(startup_byjus.address));
    view("getMilestoneStatus(startup_byjus) after restore",
         await token.getMilestoneStatus(startup_byjus.address));

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION D — IntelliStakeInvestment (ETH milestone escrow)
    // ═══════════════════════════════════════════════════════════════════════════

    header("D. IntelliStakeInvestment Transactions");

    section("D1. Create Investment Deals");

    // Note: milestone sum must be ≤ (msg.value − 0.5% fee), so send ≈ sum / 0.995
    // Deal 0: Zepto — trust 82, milestones sum = 0.009 ETH → send 0.0096 ETH
    await tx("createInvestment — Zepto (trust 82, 0.0096 ETH sent, 0.009 ETH in milestones)",
             investment.createInvestment(
                 startup_zepto.address, "Zepto", "eCommerce", 82, 5_000_000,
                 ["Series B Close", "10-min Delivery", "Profitability"],
                 [ethers.parseEther("0.003"), ethers.parseEther("0.003"), ethers.parseEther("0.003")],
                 [70, 75, 80],
                 { value: ethers.parseEther("0.0096") }
             ));

    // Deal 1: Razorpay — trust 91, milestones sum = 0.009 ETH → send 0.0096 ETH
    await tx("createInvestment — Razorpay (trust 91, 0.0096 ETH sent, 0.009 ETH in milestones)",
             investment.createInvestment(
                 startup_razorpay.address, "Razorpay", "FinTech", 91, 7_500_000,
                 ["RBI KYC Compliance", "API v3 Launch", "Series F"],
                 [ethers.parseEther("0.003"), ethers.parseEther("0.003"), ethers.parseEther("0.003")],
                 [75, 80, 85],
                 { value: ethers.parseEther("0.0096") }
             ));

    // Deal 2: Byju's — trust 38 (borderline, above min 30), milestones sum = 0.006 ETH → send 0.0064 ETH
    await tx("createInvestment — Byju's (trust 38, 0.0064 ETH sent, 0.006 ETH in milestones)",
             investment.createInvestment(
                 startup_byjus.address, "Byju's", "EdTech", 38, 250_000,
                 ["Audit Clean", "Debt Resolution", "Retention ≥50%"],
                 [ethers.parseEther("0.002"), ethers.parseEther("0.002"), ethers.parseEther("0.002")],
                 [35, 40, 45],
                 { value: ethers.parseEther("0.0064") }
             ));

    section("D2. Deal Info Views");
    const d0 = await investment.getDealInfo(0);
    view("getDealInfo(0) — Zepto", {
        startupName: d0.startupName, totalAmount: ethers.formatEther(d0.totalAmount) + " ETH",
        trustScore: d0.trustScore.toString(), status: d0.status.toString(), milestones: d0.milestoneCount.toString()
    });

    const m0 = await investment.getMilestone(0, 0);
    // ABI returns: desc[0], amount[1], threshold[2], completed[3]
    view("getMilestone(deal=0, idx=0)", {
        description: m0[0], releaseAmount: ethers.formatEther(m0[1]) + " ETH",
        threshold: m0[2].toString(), completed: m0[3]
    });

    section("D3. Trust Score Update");
    await tx("updateTrustScore(deal=0, 85) — Zepto improved",
             investment.updateTrustScore(0, 85));

    section("D4. Complete Milestones");
    await tx("completeMilestone(deal=0, idx=0) — Series B Close [trust 85 ≥ threshold 70]",
             investment.completeMilestone(0, 0));
    await tx("completeMilestone(deal=0, idx=1) — 10-min Delivery [trust 85 ≥ threshold 75]",
             investment.completeMilestone(0, 1));

    const d0after = await investment.getDealInfo(0);
    // positional indexing: [3]=totalAmount [4]=releasedAmount [6]=status
    view("getDealInfo(0) after milestones", {
        releasedAmount: ethers.formatEther(d0after[4]) + " ETH",
        status: d0after[6].toString()
    });

    section("D5. Platform Fees");
    const fees = await investment.platformFeeAccrued();
    view("platformFeeAccrued", ethers.formatEther(fees) + " ETH");
    await tx("withdrawPlatformFees()",   investment.withdrawPlatformFees());

    section("D6. Investor Views");
    view("getInvestorDeals(deployer)", (await investment.getInvestorDeals(deployer.address)).map(d => d.toString()));
    view("totalInvestments",           (await investment.totalInvestments()).toString());
    view("totalValueLocked",           ethers.formatEther(await investment.totalValueLocked()) + " ETH");

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION E — MilestoneEscrow (deployer = oracle, direct calls)
    // ═══════════════════════════════════════════════════════════════════════════

    header("E. MilestoneEscrow Transactions (Direct — Deployer as Oracle)");

    const ZEPTO_ID    = ethers.encodeBytes32String("ZEPTO_ESCROW");
    const RAZORPAY_ID = ethers.encodeBytes32String("RAZORPAY_ESCROW");

    section("E1. depositFunds — auto-releases Tranche 0 (25%)");
    const depRec1 = await tx("depositFunds(ZEPTO_ESCROW, startup_zepto, 0.1 ETH)",
        milestoneEscrow.depositFunds(ZEPTO_ID, startup_zepto.address,
            { value: ethers.parseEther("0.1") }));

    view("Tranche 0 (IMMEDIATE)", (() => {
        return "check via getTranche below";
    })());

    section("E2. oracleApprove — release remaining tranches");
    const rndHash1 = ethers.keccak256(ethers.toUtf8Bytes("zepto_github_velocity_confirmed"));
    await tx("oracleApprove(ZEPTO, tranche=1 GITHUB_VELOCITY, trust=620)",
             milestoneEscrow.oracleApprove(ZEPTO_ID, 1, 620, rndHash1));

    const rndHash2 = ethers.keccak256(ethers.toUtf8Bytes("zepto_trust_score_0.58"));
    await tx("oracleApprove(ZEPTO, tranche=2 TRUST_SCORE, trust=580)",
             milestoneEscrow.oracleApprove(ZEPTO_ID, 2, 580, rndHash2));

    const rndHash3 = ethers.keccak256(ethers.toUtf8Bytes("zepto_mca_audit_clean"));
    await tx("oracleApprove(ZEPTO, tranche=3 MCA_AUDIT, trust=580)",
             milestoneEscrow.oracleApprove(ZEPTO_ID, 3, 580, rndHash3));

    section("E3. Deposit Razorpay + Freeze (low trust)");
    await tx("depositFunds(RAZORPAY_ESCROW, startup_razorpay, 0.08 ETH)",
             milestoneEscrow.depositFunds(RAZORPAY_ID, startup_razorpay.address,
                 { value: ethers.parseEther("0.08") }));
    await tx("freezeMilestoneFunding(RAZORPAY_ESCROW, trust=280) — below 0.35 threshold",
             milestoneEscrow.freezeMilestoneFunding(RAZORPAY_ID, 280));
    view("isFrozen(RAZORPAY_ESCROW)", await milestoneEscrow.isFrozen(RAZORPAY_ID));
    await tx("restoreFunding(RAZORPAY_ESCROW) — owner override",
             milestoneEscrow.restoreFunding(RAZORPAY_ID));
    view("isFrozen(RAZORPAY_ESCROW) after restore",
         await milestoneEscrow.isFrozen(RAZORPAY_ID));

    section("E4. View Calls");
    const zepto_escrow = await milestoneEscrow.getEscrow(ZEPTO_ID);
    view("getEscrow(ZEPTO)", {
        totalDeposited: ethers.formatEther(zepto_escrow[1]) + " ETH",
        totalReleased:  ethers.formatEther(zepto_escrow[2]) + " ETH",
        frozen: zepto_escrow[3]
    });

    for (let i = 0; i < 4; i++) {
        const t = await milestoneEscrow.getTranche(ZEPTO_ID, i);
        view(`getTranche(ZEPTO, ${i})`, {
            status: t.status.toString(), // 0=PENDING,1=RELEASED,2=FROZEN
            amountWei: ethers.formatEther(t.amountWei) + " ETH"
        });
    }

    view("pendingTranches(RAZORPAY_ESCROW)",
         (await milestoneEscrow.pendingTranches(RAZORPAY_ID)).map(t => t.toString()));
    view("totalStartups", (await milestoneEscrow.totalStartups()).toString());

    section("E5. Switch Oracle to TrustOracle");
    await tx("updateOracleAuthority(TrustOracle)",
             milestoneEscrow.updateOracleAuthority(TO_ADDR));

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION F — TrustOracle (ECDSA-signed push from off-chain AI engine)
    // ═══════════════════════════════════════════════════════════════════════════

    header("F. TrustOracle Transactions (ECDSA Signed Push)");

    // Pre-register a new startup in MilestoneEscrow for oracle to approve
    const BYJUS_ORACLE_ID = ethers.encodeBytes32String("BYJUS_ORACLE");
    section("F0. Pre-deposit Byju's escrow (so oracle can approve tranches)");
    await tx("depositFunds(BYJUS_ORACLE, startup_byjus, 0.06 ETH)",
             milestoneEscrow.connect(deployer).depositFunds(
                 BYJUS_ORACLE_ID, startup_byjus.address,
                 // After oracle switch, depositFunds has no oracle restriction — anyone can deposit
                 { value: ethers.parseEther("0.06") }
             ));

    section("F1. verifySignature — offline check before push");
    const ts1       = BigInt(Math.floor(Date.now() / 1000));
    const nonce1    = ethers.keccak256(ethers.toUtf8Bytes("nonce_byjus_1"));
    const score1    = 720n;  // 0.72 × 1000 — healthy
    const { messageHash: mh1, signature: sig1 } =
        await buildOracleSignature(oracleSigner, BYJUS_ORACLE_ID, score1, ts1, nonce1);

    const [recoveredSigner, isValid] = await trustOracle.verifySignature(
        BYJUS_ORACLE_ID, score1, ts1, nonce1, sig1
    );
    view("verifySignature(BYJUS_ORACLE, 720)", {
        recoveredSigner, expectedSigner: oracleSigner.address, isValid
    });

    section("F2. pushTrustScore — healthy score, approve tranche 1");
    await tx("pushTrustScore(BYJUS_ORACLE, trust=720/1000, tranche=1)",
             trustOracle.pushTrustScore(
                 BYJUS_ORACLE_ID, score1, 1, startup_byjus.address, ts1, nonce1, sig1
             ));

    const [score1_stored, updatedAt1] = await trustOracle.getTrustScore(BYJUS_ORACLE_ID);
    view("getTrustScore(BYJUS_ORACLE) after push", {
        score: score1_stored.toString() + " (÷1000 = " + (Number(score1_stored) / 1000) + ")",
        updatedAt: new Date(Number(updatedAt1) * 1000).toISOString()
    });
    view("isNonceUsed(nonce1)", await trustOracle.isNonceUsed(nonce1));

    section("F3. pushTrustScore — LOW score (< 0.35), triggers freeze");
    // Wait 1 block to pass rate limiter check (need different timestamp)
    await ethers.provider.send("evm_increaseTime", [3600]);   // advance 1 hour
    await ethers.provider.send("evm_mine");

    const ts2    = BigInt(Math.floor(Date.now() / 1000)) + 3600n;
    const nonce2 = ethers.keccak256(ethers.toUtf8Bytes("nonce_byjus_2"));
    const score2 = 280n;   // 0.28 × 1000 — below 0.35 freeze threshold
    const { signature: sig2 } =
        await buildOracleSignature(oracleSigner, BYJUS_ORACLE_ID, score2, ts2, nonce2);

    await tx("pushTrustScore(BYJUS_ORACLE, trust=280/1000) — triggers auto-freeze",
             trustOracle.pushTrustScore(
                 BYJUS_ORACLE_ID, score2, 255, startup_byjus.address, ts2, nonce2, sig2
             ));

    view("isFrozen(BYJUS_ORACLE) after low-score push",
         await milestoneEscrow.isFrozen(BYJUS_ORACLE_ID));

    section("F4. emergencyFreeze — regulatory override");
    const SEBI_ID = ethers.encodeBytes32String("SEBI_BLOCKED_CO");
    await tx("emergencyFreeze(SEBI_BLOCKED_CO, 'Court order: SEBI enforcement action')",
             trustOracle.emergencyFreeze(SEBI_ID, "Court order: SEBI enforcement action"));

    section("F5. Admin: setOracleSigner, setMilestoneEscrow, setComplianceRules");
    // Demonstrate ownership-gated admin functions
    await tx("setOracleSigner(same key — demo swap)",      trustOracle.setOracleSigner(oracleSigner.address));
    await tx("setMilestoneEscrow(same address — demo)",    trustOracle.setMilestoneEscrow(ME_ADDR));
    await tx("setComplianceRules(same address — demo)",    trustOracle.setComplianceRules(CR_ADDR));

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION G — AgentVault (AI-driven autonomous investment)
    // ═══════════════════════════════════════════════════════════════════════════

    header("G. AgentVault Transactions (AI Autonomous Investment)");

    section("G1. Fund the Vault");
    await tx("deposit() — 0.5 ETH from deployer",
             deployer.sendTransaction({ to: AV_ADDR, value: ethers.parseEther("0.5") }));

    let summary = await agentVault.vaultSummary();
    view("vaultSummary after deposit", {
        balance: ethers.formatEther(summary[0]) + " ETH",
        totalDeposited: ethers.formatEther(summary[1]) + " ETH",
        totalInvested:  ethers.formatEther(summary[2]) + " ETH",
        investCount:    summary[3].toString(),
        active:         summary[4],
        minCIS:         summary[5].toString(),
        maxBps:         summary[6].toString()
    });

    section("G2. Parameters & Agent Toggle");
    await tx("setParameters(minCIS=7000, maxBps=1500)",
             agentVault.setParameters(7000n, 1500n));
    await tx("toggleAgent(true) — activate autonomous mode",
             agentVault.toggleAgent(true));

    section("G3. investTranche — AI routes via MilestoneEscrow");
    // Use a fresh startupId not yet in MilestoneEscrow
    const VAULT_STARTUP_ID = ethers.encodeBytes32String("VAULT_ZEPTO_1");
    // Invest 15% of vault balance (within 15% maxBps cap)
    const vaultBal   = await ethers.provider.getBalance(AV_ADDR);
    const investAmt  = (vaultBal * 1400n) / 10000n;   // 14% — safely under 15% cap

    await tx(`investTranche(startup_zepto, VAULT_ZEPTO_1, ${ethers.formatEther(investAmt)} ETH, CIS=7500)`,
             agentVault.investTranche(
                 startup_zepto.address,
                 VAULT_STARTUP_ID,
                 investAmt,
                 7500n,              // CIS = 0.75 × 10000 ≥ 7000 minimum
                 "MILESTONE",
                 "XGBoost model: trust 0.75, sector momentum +12%, Black-Litterman weight 0.18"
             ));

    view("investmentCount", (await agentVault.investmentCount()).toString());
    const invIds = await agentVault.getInvestmentIds();
    view("getInvestmentIds", invIds.map(id => id.slice(0, 18) + "…"));

    const inv = await agentVault.getInvestment(invIds[0]);
    view("getInvestment[0]", {
        startup:   inv.startupWallet,
        amount:    ethers.formatEther(inv.amount) + " ETH",
        cisScore:  inv.cisScore.toString(),
        type:      inv.investmentType,
        reason:    inv.aiReason.slice(0, 60) + "…",
        withdrawn: inv.withdrawn
    });

    section("G4. riskTriggeredWithdraw (oracle role)");
    // deployer IS the oracle in this vault (set in constructor)
    await tx("riskTriggeredWithdraw(startup_zepto, riskScore=800/1000)",
             agentVault.riskTriggeredWithdraw(startup_zepto.address, 800));

    section("G5. setOperator & setOracle (ownership transfer)");
    await tx("setOperator(agentOperator)",   agentVault.setOperator(agentOperator.address));
    await tx("setOracle(TrustOracle.addr)",  agentVault.setOracle(TO_ADDR));

    section("G6. emergencyWithdraw — drain vault");
    await tx("emergencyWithdraw() — all remaining ETH returned to owner",
             agentVault.emergencyWithdraw());

    summary = await agentVault.vaultSummary();
    view("vaultSummary after emergencyWithdraw", {
        balance:     ethers.formatEther(summary[0]) + " ETH",
        totalInvested: ethers.formatEther(summary[2]) + " ETH",
        active:      summary[4]
    });

    section("G7. resetEmergencyFreeze — re-activate vault");
    await tx("resetEmergencyFreeze()",  agentVault.resetEmergencyFreeze());
    view("agentVault.agentActive after reset", (await agentVault.vaultSummary())[4]);

    // ═══════════════════════════════════════════════════════════════════════════
    // FINAL RECORD
    // ═══════════════════════════════════════════════════════════════════════════

    header("All Transactions Completed — Saving Record");

    const record = {
        demo_run_at: new Date().toISOString(),
        network:     "localhost (Hardhat in-process)",
        chainId:     chainId.toString(),
        deployer:    deployer.address,
        wallets: {
            investor1:       investor1.address,
            investor2:       investor2.address,
            startup_zepto:   startup_zepto.address,
            startup_razorpay: startup_razorpay.address,
            startup_byjus:   startup_byjus.address,
            oracleSigner:    oracleSigner.address,
            agentOperator:   agentOperator.address
        },
        contracts: {
            IdentityRegistry:       IR_ADDR,
            IntelliStakeToken:      TOK_ADDR,
            IntelliStakeInvestment: INV_ADDR,
            ComplianceRules:        CR_ADDR,
            MilestoneEscrow:        ME_ADDR,
            TrustOracle:            TO_ADDR,
            AgentVault:             AV_ADDR
        },
        sections_run: [
            "A. IdentityRegistry — operator, register, batch, update, revoke, restore, views",
            "B. ComplianceRules  — KYC, accreditation, batch, score, freeze, unfreeze, views",
            "C. IntelliStakeToken— accreditation, mint, transfer, tranche lock+release, freeze",
            "D. IntelliStakeInvestment — 3 deals, milestones, trust update, fees",
            "E. MilestoneEscrow  — deposit (auto-release 25%), oracleApprove x3, freeze, restore",
            "F. TrustOracle      — ECDSA verify, push (healthy), push (low→freeze), emergencyFreeze",
            "G. AgentVault       — deposit, params, invest, riskWithdraw, emergency, reset"
        ],
        final_state: {
            token_supply:      (await token.totalSupply()).toString(),
            inv_deals:         (await investment.totalInvestments()).toString(),
            escrow_startups:   (await milestoneEscrow.totalStartups()).toString(),
            investor1_balance: (await token.balanceOf(investor1.address)).toString(),
            investor2_balance: (await token.balanceOf(investor2.address)).toString(),
            zepto_balance:     (await token.balanceOf(startup_zepto.address)).toString()
        }
    };

    const outPath = path.join(__dirname, "..", "demo_record.json");
    fs.writeFileSync(outPath, JSON.stringify(record, null, 2));
    console.log(`\n  ✅  Record saved → ${outPath}`);

    console.log(`\n${DSEP}`);
    console.log("  DEMO COMPLETE — Every contract, every transaction type run once");
    console.log(DSEP);
    console.log(`\n  Final State:`);
    console.log(`    $ISTK Total Supply : ${ethers.formatUnits(record.final_state.token_supply, 18)} ISTK`);
    console.log(`    Investment Deals   : ${record.final_state.inv_deals}`);
    console.log(`    Escrow Startups    : ${record.final_state.escrow_startups}`);
    console.log(`    investor1 balance  : ${ethers.formatUnits(record.final_state.investor1_balance, 18)} ISTK`);
    console.log(`    investor2 balance  : ${ethers.formatUnits(record.final_state.investor2_balance, 18)} ISTK`);
    console.log(`    Zepto ISTK received: ${ethers.formatUnits(record.final_state.zepto_balance, 18)} ISTK`);
    console.log();
}

main().catch(err => {
    console.error("\n❌  Demo failed:", err);
    process.exitCode = 1;
});
