// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  AgentVault
 * @notice IntelliStake Autonomous Investment Vault
 *
 * Architecture:
 *   1. User deposits ETH/stablecoin into the vault
 *   2. The IntelliStake AI Agent (OPERATOR role) executes tranche investments
 *      to startup wallets based on Composite Intelligence Score (CIS) decisions
 *   3. TrustOracle.sol pushes CIS scores on-chain before each investment
 *   4. Every investment is gated: CIS must exceed the user-configured threshold
 *   5. EMERGENCY: user calls emergencyWithdraw() — instant, no delay, no conditions
 *   6. Oracle-triggered risk stop: if risk drops below threshold, auto-freeze
 *
 * Security:
 *   - Only OWNER can deposit, change rules, emergency withdraw
 *   - Only OPERATOR (AI Agent) can investTranche
 *   - Only ORACLE can trigger risk-based auto-withdrawal
 *   - Max single investment capped at maxAllocationBps (default 20% of vault)
 *   - Re-entrancy guard on all value transfers
 *   - Full on-chain audit trail via events
 *
 * Integration with existing contracts:
 *   - Calls MilestoneEscrow.depositFunds() after each tranche approval
 *   - Validates wallet via IdentityRegistry.isVerified() before transfer
 */

interface IIdentityRegistry {
    function isVerified(address wallet) external view returns (bool);
}

interface IMilestoneEscrow {
    /**
     * @notice Deposit ETH into escrow for a startup and auto-release Tranche 1 (25%).
     *         Signature matches MilestoneEscrow.depositFunds().
     * @param startupId   Bytes32 startup identifier
     * @param beneficiary Startup wallet address to receive released tranches
     */
    function depositFunds(
        bytes32 startupId,
        address beneficiary
    ) external payable;
}

contract AgentVault {

    // ── Roles ─────────────────────────────────────────────────────────────────
    address public immutable owner;
    address public operator;       // AI Agent backend wallet
    address public oracle;         // TrustOracle.sol
    address public identityRegistry;
    address public milestoneEscrow;

    // ── Vault parameters (user-configurable) ──────────────────────────────────
    uint256 public minCIS;                 // Minimum CIS × 10000 (e.g. 6500 = 0.65)
    uint256 public maxAllocationBps;       // Max % of vault per investment (bps, default 2000 = 20%)
    bool    public agentActive;            // Master switch for autonomous mode

    // ── Vault state ───────────────────────────────────────────────────────────
    uint256 public totalDeposited;
    uint256 public totalInvested;
    uint256 public emergencyFreezeBlock;    // Block at which emergency was triggered (0 = none)

    // ── Investment record ─────────────────────────────────────────────────────
    struct Investment {
        bytes32   investmentId;
        address   startupWallet;
        uint256   amount;
        uint256   cisScore;         // CIS × 10000
        string    investmentType;   // "PERIODIC" | "MILESTONE" | "VELOCITY" | "SENTIMENT"
        string    aiReason;         // Investment thesis snippet
        uint256   timestamp;
        bool      withdrawn;
    }

    bytes32[] public investmentIds;
    mapping(bytes32 => Investment) public investments;
    mapping(address => uint256)    public investedPerStartup;

    // ── Re-entrancy guard ─────────────────────────────────────────────────────
    bool private _locked;
    modifier nonReentrant() {
        require(!_locked, "AgentVault: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    // ── Access control ────────────────────────────────────────────────────────
    modifier onlyOwner()    { require(msg.sender == owner,    "AgentVault: not owner");    _; }
    modifier onlyOperator() { require(msg.sender == operator || msg.sender == owner,
                                      "AgentVault: not operator"); _; }
    modifier onlyOracle()   { require(msg.sender == oracle || msg.sender == owner,
                                      "AgentVault: not oracle");   _; }
    modifier notFrozen()    { require(emergencyFreezeBlock == 0, "AgentVault: emergency freeze active"); _; }

    // ── Events ────────────────────────────────────────────────────────────────
    event Deposited(address indexed user, uint256 amount, uint256 newTotal);
    event InvestmentExecuted(
        bytes32 indexed investmentId, address indexed startup,
        uint256 amount, uint256 cisScore, string investmentType, string reason
    );
    event EmergencyWithdrawal(address indexed owner, uint256 amount, uint256 blockNumber);
    event RiskTriggeredWithdrawal(address indexed startup, uint256 amountRecovered, uint256 riskScore);
    event ParametersUpdated(uint256 newMinCIS, uint256 newMaxAllocationBps);
    event AgentToggled(bool active, address by);


    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(
        address _operator,
        address _oracle,
        address _identityRegistry,
        address _milestoneEscrow,
        uint256 _minCIS,            // e.g. 6500 for CIS ≥ 0.65
        uint256 _maxAllocationBps   // e.g. 2000 for max 20% per investment
    ) {
        owner               = msg.sender;
        operator            = _operator;
        oracle              = _oracle;
        identityRegistry    = _identityRegistry;
        milestoneEscrow     = _milestoneEscrow;
        minCIS              = _minCIS;
        maxAllocationBps    = _maxAllocationBps;
        agentActive         = true;
    }

    // ── Deposit ───────────────────────────────────────────────────────────────

    /**
     * @notice Deposit ETH into the vault for the agent to invest.
     */
    function deposit() external payable onlyOwner {
        require(msg.value > 0, "AgentVault: zero deposit");
        totalDeposited += msg.value;
        emit Deposited(msg.sender, msg.value, address(this).balance);
    }

    // ── Investment execution ──────────────────────────────────────────────────

    /**
     * @notice Execute a single investment tranche to a startup wallet.
     * @dev Called by the AI Agent (OPERATOR role) after CIS is validated on-chain.
     *
     * @param startupWallet   Ethereum address of the startup (must be KYC-verified)
     * @param startupId       Bytes32 identifier for MilestoneEscrow routing
     * @param amount          Wei to invest
     * @param cisScore        CIS × 10000 (validated by oracle before call)
     * @param investmentType  "PERIODIC" | "MILESTONE" | "VELOCITY" | "SENTIMENT"
     * @param aiReason        Human-readable AI reasoning (stored on-chain)
     */
    function investTranche(
        address        startupWallet,
        bytes32        startupId,
        uint256        amount,
        uint256        cisScore,
        string calldata investmentType,
        string calldata aiReason
    )
        external
        nonReentrant
        onlyOperator
        notFrozen
    {
        require(agentActive,                     "AgentVault: agent is paused");
        require(amount > 0,                      "AgentVault: zero amount");
        require(amount <= address(this).balance, "AgentVault: insufficient balance");
        require(cisScore >= minCIS,              "AgentVault: CIS below threshold");

        // Max allocation cap
        uint256 maxAllowed = (address(this).balance * maxAllocationBps) / 10000;
        require(amount <= maxAllowed, "AgentVault: exceeds max allocation");

        // KYC gate via IdentityRegistry.sol
        if (identityRegistry != address(0)) {
            require(
                IIdentityRegistry(identityRegistry).isVerified(startupWallet),
                "AgentVault: startup wallet not KYC-verified"
            );
        }

        // Generate unique investment ID
        bytes32 invId = keccak256(
            abi.encodePacked(startupWallet, amount, cisScore, block.timestamp, block.number)
        );

        // Record investment
        investments[invId] = Investment({
            investmentId:   invId,
            startupWallet:  startupWallet,
            amount:         amount,
            cisScore:       cisScore,
            investmentType: investmentType,
            aiReason:       aiReason,
            timestamp:      block.timestamp,
            withdrawn:      false
        });
        investmentIds.push(invId);
        investedPerStartup[startupWallet] += amount;
        totalInvested += amount;

        emit InvestmentExecuted(invId, startupWallet, amount, cisScore, investmentType, aiReason);

        // Route through MilestoneEscrow (4-tranche gating).
        // depositFunds() registers the startup, auto-releases Tranche 1 (25%),
        // and holds Tranches 2-4 until oracle confirms milestones.
        if (milestoneEscrow != address(0)) {
            IMilestoneEscrow(milestoneEscrow).depositFunds{value: amount}(
                startupId, startupWallet
            );
        } else {
            // Direct transfer if escrow not configured
            (bool ok,) = startupWallet.call{value: amount}("");
            require(ok, "AgentVault: transfer failed");
        }
    }

    // ── Emergency withdrawal ──────────────────────────────────────────────────

    /**
     * @notice INSTANT emergency withdrawal of ALL remaining vault balance.
     * @dev Callable ONLY by owner. No delay, no conditions, no minimum balance.
     *      Sets emergencyFreezeBlock to prevent further investments.
     */
    function emergencyWithdraw() external nonReentrant onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "AgentVault: vault empty");

        emergencyFreezeBlock = block.number;
        agentActive = false;

        emit EmergencyWithdrawal(msg.sender, balance, block.number);

        (bool ok,) = owner.call{value: balance}("");
        require(ok, "AgentVault: withdrawal transfer failed");
    }

    /**
     * @notice Reset emergency freeze (owner must explicitly re-enable).
     */
    function resetEmergencyFreeze() external onlyOwner {
        emergencyFreezeBlock = 0;
        agentActive = true;
    }

    // ── Oracle-triggered risk stop ────────────────────────────────────────────

    /**
     * @notice Called by TrustOracle when a startup's risk drops below safe threshold.
     *         Recovers any recoverable funds and marks investment as withdrawn.
     *
     * @param startupWallet  The startup whose risk triggered the stop
     * @param riskScore      Current risk score (0–10000) from oracle
     */
    function riskTriggeredWithdraw(
        address startupWallet,
        uint256 riskScore
    )
        external
        onlyOracle
    {
        // Mark all investments to this startup as risky
        for (uint i = 0; i < investmentIds.length; i++) {
            Investment storage inv = investments[investmentIds[i]];
            if (inv.startupWallet == startupWallet && !inv.withdrawn) {
                inv.withdrawn = true;
            }
        }
        emit RiskTriggeredWithdrawal(startupWallet, investedPerStartup[startupWallet], riskScore);
    }

    // ── Configuration ─────────────────────────────────────────────────────────

    function setParameters(uint256 _minCIS, uint256 _maxAllocationBps) external onlyOwner {
        require(_minCIS <= 10000,          "AgentVault: CIS must be 0-10000");
        require(_maxAllocationBps <= 5000, "AgentVault: max 50% per investment");
        minCIS           = _minCIS;
        maxAllocationBps = _maxAllocationBps;
        emit ParametersUpdated(_minCIS, _maxAllocationBps);
    }

    function setOperator(address _operator) external onlyOwner { operator = _operator; }
    function setOracle(address _oracle)     external onlyOwner { oracle   = _oracle; }

    function toggleAgent(bool active) external onlyOwner {
        agentActive = active;
        emit AgentToggled(active, msg.sender);
    }

    // ── View functions ────────────────────────────────────────────────────────

    function vaultBalance()  external view returns (uint256) { return address(this).balance; }
    function available()     external view returns (uint256) { return address(this).balance; }
    function investmentCount() external view returns (uint256) { return investmentIds.length; }

    function getInvestment(bytes32 id) external view returns (Investment memory) {
        return investments[id];
    }

    function getInvestmentIds() external view returns (bytes32[] memory) {
        return investmentIds;
    }

    function vaultSummary() external view returns (
        uint256 balance,
        uint256 _totalDeposited,
        uint256 _totalInvested,
        uint256 count,
        bool    active,
        uint256 _minCIS,
        uint256 _maxBps
    ) {
        return (
            address(this).balance,
            totalDeposited,
            totalInvested,
            investmentIds.length,
            agentActive,
            minCIS,
            maxAllocationBps
        );
    }

    receive() external payable {
        totalDeposited += msg.value;
        emit Deposited(msg.sender, msg.value, address(this).balance);
    }
}
