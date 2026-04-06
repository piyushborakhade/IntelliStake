// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IntelliStakeInvestment
 * @notice AI-driven milestone-based startup investment escrow.
 *         Integrates with IntelliStake trust scores for automated
 *         tranche release decisions on Ethereum testnet (Sepolia).
 * @dev Upgrade 11 — Research-grade Solidity implementation
 */
contract IntelliStakeInvestment {

    // ─── Structs ───────────────────────────────────────────────────────────────

    enum Status { Pending, Active, Milestone, Completed, Refunded }

    struct Milestone {
        string  description;
        uint256 releaseAmount;      // Wei to release when milestone hit
        uint8   trustThreshold;     // Min AI trust score (0-100) required
        bool    completed;
        uint256 completedAt;
    }

    struct Investment {
        address payable investor;
        address payable startup;
        string  startupName;
        string  sector;
        uint256 totalAmount;        // Total Wei locked in escrow
        uint256 releasedAmount;     // Wei already released
        uint8   aiTrustScore;       // 0–100 from IntelliStake model
        uint256 predictedValuation; // From IntelliStake model (scaled ×10^6)
        Status  status;
        uint256 createdAt;
        uint256 lastUpdated;
        Milestone[] milestones;
    }

    // ─── State ─────────────────────────────────────────────────────────────────

    address public owner;
    uint256 public constant PLATFORM_FEE_BPS = 50;  // 0.5% platform fee
    uint256 public platformFeeAccrued;
    uint256 public totalInvestments;
    uint256 public totalValueLocked;

    mapping(uint256 => Investment) public investments;
    mapping(address => uint256[]) public investorDeals;
    mapping(address => uint256[]) public startupDeals;
    mapping(string => bool) public registeredStartups;

    // ─── Events ────────────────────────────────────────────────────────────────

    event InvestmentCreated(
        uint256 indexed dealId,
        address indexed investor,
        address indexed startup,
        string  startupName,
        uint256 amount,
        uint8   trustScore
    );
    event MilestoneCompleted(
        uint256 indexed dealId,
        uint256 milestoneIndex,
        uint256 amountReleased
    );
    event TrustScoreUpdated(uint256 indexed dealId, uint8 oldScore, uint8 newScore);
    event InvestmentRefunded(uint256 indexed dealId, uint256 amount);
    event StartupRegistered(string name, address wallet, string sector);

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not platform owner");
        _;
    }

    modifier onlyInvestor(uint256 dealId) {
        require(msg.sender == investments[dealId].investor, "Not investor");
        _;
    }

    modifier dealExists(uint256 dealId) {
        require(dealId < totalInvestments, "Deal does not exist");
        _;
    }

    modifier dealActive(uint256 dealId) {
        require(
            investments[dealId].status == Status.Active ||
            investments[dealId].status == Status.Milestone,
            "Deal not active"
        );
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Core Functions ────────────────────────────────────────────────────────

    /**
     * @notice Create a new investment deal with milestone-based escrow.
     * @param startupWallet  Startup's receiving wallet address
     * @param startupName    Company name (must match IntelliStake database)
     * @param sector         Sector (FinTech/EdTech/HealthTech/SaaS/AI/eCommerce)
     * @param trustScore     AI trust score from IntelliStake model (0-100)
     * @param predictedVal   Predicted valuation from model (in USD × 10^6)
     * @param milestoneDescs Array of milestone descriptions
     * @param milestoneAmts  Wei to release per milestone (must sum ≤ msg.value)
     * @param trustThresholds Minimum trust score per milestone
     */
    function createInvestment(
        address payable startupWallet,
        string calldata startupName,
        string calldata sector,
        uint8  trustScore,
        uint256 predictedVal,
        string[]  calldata milestoneDescs,
        uint256[] calldata milestoneAmts,
        uint8[]   calldata trustThresholds
    ) external payable returns (uint256 dealId) {
        require(msg.value > 0,               "Must send ETH");
        require(trustScore >= 30,            "Trust score too low (min 30)");
        require(milestoneDescs.length > 0,   "Need at least one milestone");
        require(
            milestoneDescs.length == milestoneAmts.length &&
            milestoneAmts.length  == trustThresholds.length,
            "Array length mismatch"
        );

        // Validate milestone amounts sum ≤ investment (leave room for fee)
        uint256 totalMilestone;
        for (uint i = 0; i < milestoneAmts.length; i++) {
            totalMilestone += milestoneAmts[i];
        }
        uint256 platformFee = (msg.value * PLATFORM_FEE_BPS) / 10_000;
        require(totalMilestone <= msg.value - platformFee, "Milestone sum exceeds escrow");

        dealId = totalInvestments++;
        Investment storage inv = investments[dealId];
        inv.investor          = payable(msg.sender);
        inv.startup           = startupWallet;
        inv.startupName       = startupName;
        inv.sector            = sector;
        inv.totalAmount       = msg.value - platformFee;
        inv.releasedAmount    = 0;
        inv.aiTrustScore      = trustScore;
        inv.predictedValuation = predictedVal;
        inv.status            = Status.Active;
        inv.createdAt         = block.timestamp;
        inv.lastUpdated       = block.timestamp;

        for (uint i = 0; i < milestoneDescs.length; i++) {
            inv.milestones.push(Milestone({
                description:   milestoneDescs[i],
                releaseAmount: milestoneAmts[i],
                trustThreshold: trustThresholds[i],
                completed:     false,
                completedAt:   0
            }));
        }

        platformFeeAccrued  += platformFee;
        totalValueLocked    += inv.totalAmount;
        investorDeals[msg.sender].push(dealId);
        startupDeals[startupWallet].push(dealId);
        registeredStartups[startupName] = true;

        emit InvestmentCreated(dealId, msg.sender, startupWallet, startupName, msg.value, trustScore);
    }

    /**
     * @notice Release a milestone tranche to the startup.
     *         Only if current AI trust score meets milestone threshold.
     * @param dealId  The deal ID
     * @param mIdx    Milestone index to complete
     */
    function completeMilestone(uint256 dealId, uint256 mIdx)
        external onlyOwner dealExists(dealId) dealActive(dealId)
    {
        Investment storage inv = investments[dealId];
        require(mIdx < inv.milestones.length,         "Invalid milestone index");
        Milestone storage ms = inv.milestones[mIdx];
        require(!ms.completed,                        "Milestone already done");
        require(inv.aiTrustScore >= ms.trustThreshold, "Trust score below threshold");
        require(
            address(this).balance >= ms.releaseAmount, "Insufficient contract balance"
        );

        ms.completed    = true;
        ms.completedAt  = block.timestamp;
        inv.releasedAmount += ms.releaseAmount;
        inv.lastUpdated    = block.timestamp;

        // Check if all milestones done
        bool allDone = true;
        for (uint i = 0; i < inv.milestones.length; i++) {
            if (!inv.milestones[i].completed) { allDone = false; break; }
        }
        inv.status = allDone ? Status.Completed : Status.Milestone;
        totalValueLocked -= ms.releaseAmount;

        inv.startup.transfer(ms.releaseAmount);
        emit MilestoneCompleted(dealId, mIdx, ms.releaseAmount);
    }

    /**
     * @notice Update AI trust score (called by oracle after model rerun).
     */
    function updateTrustScore(uint256 dealId, uint8 newScore)
        external onlyOwner dealExists(dealId)
    {
        uint8 old = investments[dealId].aiTrustScore;
        investments[dealId].aiTrustScore = newScore;
        investments[dealId].lastUpdated  = block.timestamp;
        emit TrustScoreUpdated(dealId, old, newScore);
    }

    /**
     * @notice Emergency refund to investor (if startup fails to deliver).
     *         Can only be called 90 days after creation if deal still active.
     */
    function refundInvestor(uint256 dealId)
        external onlyOwner dealExists(dealId) dealActive(dealId)
    {
        Investment storage inv = investments[dealId];
        require(block.timestamp > inv.createdAt + 90 days, "Refund lock: 90 days");

        uint256 remaining = inv.totalAmount - inv.releasedAmount;
        require(remaining > 0, "No remaining balance");

        inv.status       = Status.Refunded;
        inv.lastUpdated  = block.timestamp;
        totalValueLocked -= remaining;

        inv.investor.transfer(remaining);
        emit InvestmentRefunded(dealId, remaining);
    }

    // ─── View Functions ────────────────────────────────────────────────────────

    function getDealInfo(uint256 dealId) external view dealExists(dealId)
        returns (
            address investor, address startup, string memory startupName,
            uint256 totalAmount, uint256 releasedAmount, uint8 trustScore,
            Status status, uint256 milestoneCount
        )
    {
        Investment storage inv = investments[dealId];
        return (
            inv.investor, inv.startup, inv.startupName,
            inv.totalAmount, inv.releasedAmount, inv.aiTrustScore,
            inv.status, inv.milestones.length
        );
    }

    function getMilestone(uint256 dealId, uint256 mIdx) external view
        returns (string memory desc, uint256 amount, uint8 threshold, bool completed)
    {
        Milestone storage ms = investments[dealId].milestones[mIdx];
        return (ms.description, ms.releaseAmount, ms.trustThreshold, ms.completed);
    }

    function getInvestorDeals(address investor) external view returns (uint256[] memory) {
        return investorDeals[investor];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────

    function withdrawPlatformFees() external onlyOwner {
        uint256 fee = platformFeeAccrued;
        platformFeeAccrued = 0;
        payable(owner).transfer(fee);
    }

    receive() external payable {}
}
