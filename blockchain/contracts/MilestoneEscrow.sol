// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MilestoneEscrow
 * @dev IntelliStake — 4-Tranche Milestone-Gated Escrow Contract
 *
 * Locks investor funds and releases them in 4 tranches, only after
 * the AI Oracle confirms that each startup milestone has been met.
 *
 * Tranche Schedule:
 *   T1 (25%) — Immediate on investment (auto-released at deposit)
 *   T2 (25%) — Released when Oracle confirms GitHub velocity = HIGH
 *   T3 (25%) — Released when Oracle confirms trust_score >= 0.50
 *   T4 (25%) — Released when Oracle confirms MCA audit is clean
 *
 * Oracle Freeze:
 *   If the AI detects risk_score < 0.35, the Oracle calls
 *   freezeMilestoneFunding(startupId) to halt ALL pending tranches.
 *   Frozen funds cannot be released until the owner manually restores.
 *
 * Integration:
 *   - oracle_bridge_full.py calls oracleApprove() or freezeMilestoneFunding()
 *   - TrustOracle.sol pushes signed trust score → triggers these functions
 */
contract MilestoneEscrow {

    // ── Constants ─────────────────────────────────────────────────────────────

    uint8 constant TRANCHE_COUNT     = 4;
    uint256 constant TRANCHE_BPS     = 2500; // 25% in basis points (out of 10000)
    uint256 constant FREEZE_THRESHOLD_X1000 = 350; // 0.350 × 1000 — AI risk score threshold

    // ── Enums ─────────────────────────────────────────────────────────────────

    enum TrancheStatus { PENDING, RELEASED, FROZEN, LOCKED }
    enum MilestoneType { IMMEDIATE, GITHUB_VELOCITY, TRUST_SCORE, MCA_AUDIT }

    // ── Structs ───────────────────────────────────────────────────────────────

    struct Tranche {
        uint8         trancheId;       // 0–3
        MilestoneType milestone;
        uint256       amountWei;       // allocated amount in wei
        TrancheStatus status;
        uint256       releasedAt;      // 0 if not yet released
        bytes32       oracleTxHash;    // oracle TX that triggered release/freeze
    }

    struct EscrowAccount {
        bytes32    startupId;
        address    beneficiary;        // startup wallet — receives released funds
        uint256    totalDepositedWei;
        uint256    totalReleasedWei;
        bool       isFrozen;           // frozen by oracle (risk_score < 0.35)
        uint256    frozenAt;
        uint256    lastTrustScore;     // last oracle-reported trust score × 1000
        Tranche[4] tranches;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    address public owner;
    address public oracleAuthority;    // only this address can call oracle functions

    mapping(bytes32 => EscrowAccount) private _escrows;
    bytes32[] private _startupIds;
    mapping(bytes32 => bool) private _exists;

    // ── Events ────────────────────────────────────────────────────────────────

    event FundsDeposited(
        bytes32 indexed startupId,
        address indexed beneficiary,
        uint256 amountWei,
        uint256 tranche1Released
    );
    event TrancheReleased(
        bytes32 indexed startupId,
        uint8   trancheId,
        MilestoneType milestone,
        uint256 amountWei,
        bytes32 oracleTxHash
    );
    event FundingFrozen(
        bytes32 indexed startupId,
        uint256 trustScore,
        uint256 timestamp,
        string  reason
    );
    event FundingRestored(bytes32 indexed startupId, uint256 timestamp);
    event OracleApproval(bytes32 indexed startupId, uint8 trancheId, uint256 trustScore);
    event OracleAuthorityUpdated(address newOracle);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "MilestoneEscrow: not owner");
        _;
    }

    modifier onlyOracle() {
        require(
            msg.sender == oracleAuthority || msg.sender == owner,
            "MilestoneEscrow: not oracle authority"
        );
        _;
    }

    modifier escrowExists(bytes32 startupId) {
        require(_exists[startupId], "MilestoneEscrow: startup not registered");
        _;
    }

    modifier notFrozen(bytes32 startupId) {
        require(!_escrows[startupId].isFrozen, "MilestoneEscrow: funding is frozen by oracle");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address oracle) {
        owner           = msg.sender;
        oracleAuthority = oracle;
    }

    // ── Deposit & Initialise ──────────────────────────────────────────────────

    /**
     * @notice Deposit investment funds into escrow for a startup.
     *         Tranche 1 (25%) is released immediately to the beneficiary.
     * @param startupId   Unique startup identifier (bytes32 of startup UUID).
     * @param beneficiary Startup wallet address to receive released tranches.
     */
    function depositFunds(bytes32 startupId, address beneficiary)
        external payable
    {
        require(msg.value > 0, "MilestoneEscrow: must send ETH");
        require(beneficiary != address(0), "MilestoneEscrow: zero address beneficiary");
        require(!_exists[startupId], "MilestoneEscrow: startup already registered");

        uint256 total     = msg.value;
        uint256 tranchAmt = (total * TRANCHE_BPS) / 10000;

        EscrowAccount storage esc = _escrows[startupId];
        esc.startupId         = startupId;
        esc.beneficiary       = beneficiary;
        esc.totalDepositedWei = total;
        esc.totalReleasedWei  = 0;
        esc.isFrozen          = false;

        // Initialise 4 tranches
        esc.tranches[0] = Tranche(0, MilestoneType.IMMEDIATE,        tranchAmt, TrancheStatus.PENDING, 0, bytes32(0));
        esc.tranches[1] = Tranche(1, MilestoneType.GITHUB_VELOCITY,  tranchAmt, TrancheStatus.PENDING, 0, bytes32(0));
        esc.tranches[2] = Tranche(2, MilestoneType.TRUST_SCORE,      tranchAmt, TrancheStatus.PENDING, 0, bytes32(0));
        esc.tranches[3] = Tranche(3, MilestoneType.MCA_AUDIT,        tranchAmt, TrancheStatus.PENDING, 0, bytes32(0));

        _startupIds.push(startupId);
        _exists[startupId] = true;

        // Release Tranche 1 immediately
        _releaseTranche(startupId, 0, bytes32(block.timestamp));

        emit FundsDeposited(startupId, beneficiary, total, tranchAmt);
    }

    // ── Oracle Functions ──────────────────────────────────────────────────────

    /**
     * @notice Oracle approves release of a specific tranche after confirming milestone.
     * @param startupId   Target startup.
     * @param trancheId   0–3 (0=immediate, 1=github, 2=trust, 3=mca).
     * @param trustScore  Current trust score × 1000 (e.g. 0.72 → 720).
     */
    function oracleApprove(
        bytes32 startupId,
        uint8   trancheId,
        uint256 trustScore,
        bytes32 txHash
    )
        external onlyOracle escrowExists(startupId) notFrozen(startupId)
    {
        require(trancheId < TRANCHE_COUNT, "MilestoneEscrow: invalid tranche ID");
        require(
            _escrows[startupId].tranches[trancheId].status == TrancheStatus.PENDING,
            "MilestoneEscrow: tranche not pending"
        );

        // Enforce trust score threshold for tranches 2 and 3
        if (trancheId == 2) {
            require(
                trustScore >= 500,  // 0.50 × 1000
                "MilestoneEscrow: trust score < 0.50, tranche 3 cannot be released"
            );
        }

        // Check if overall risk triggers freeze
        if (trustScore < FREEZE_THRESHOLD_X1000) {
            _freeze(startupId, trustScore, "Oracle: trust score < 0.35");
            return;
        }

        _escrows[startupId].lastTrustScore = trustScore;
        _releaseTranche(startupId, trancheId, txHash);
        emit OracleApproval(startupId, trancheId, trustScore);
    }

    /**
     * @notice Freeze all pending milestone tranches for a startup.
     *         Called when AI risk_score < 0.35.
     * @param startupId  Target startup.
     * @param trustScore Trust score × 1000 that triggered the freeze.
     */
    function freezeMilestoneFunding(bytes32 startupId, uint256 trustScore)
        external onlyOracle escrowExists(startupId)
    {
        _freeze(startupId, trustScore, "Oracle: AI detected risk score < 0.35");
    }

    // ── Admin Functions ───────────────────────────────────────────────────────

    /**
     * @notice Restore funding after a freeze (manual override by platform owner).
     */
    function restoreFunding(bytes32 startupId)
        external onlyOwner escrowExists(startupId)
    {
        _escrows[startupId].isFrozen = false;
        // Restore FROZEN tranches back to PENDING
        for (uint8 i = 0; i < TRANCHE_COUNT; i++) {
            if (_escrows[startupId].tranches[i].status == TrancheStatus.FROZEN) {
                _escrows[startupId].tranches[i].status = TrancheStatus.PENDING;
            }
        }
        emit FundingRestored(startupId, block.timestamp);
    }

    function updateOracleAuthority(address newOracle) external onlyOwner {
        oracleAuthority = newOracle;
        emit OracleAuthorityUpdated(newOracle);
    }

    // ── View Functions ────────────────────────────────────────────────────────

    function getEscrow(bytes32 startupId)
        external view escrowExists(startupId)
        returns (
            address  beneficiary,
            uint256  totalDeposited,
            uint256  totalReleased,
            bool     frozen,
            uint256  lastTrustScore
        )
    {
        EscrowAccount storage esc = _escrows[startupId];
        return (
            esc.beneficiary,
            esc.totalDepositedWei,
            esc.totalReleasedWei,
            esc.isFrozen,
            esc.lastTrustScore
        );
    }

    function getTranche(bytes32 startupId, uint8 trancheId)
        external view escrowExists(startupId)
        returns (Tranche memory)
    {
        require(trancheId < TRANCHE_COUNT, "MilestoneEscrow: invalid tranche ID");
        return _escrows[startupId].tranches[trancheId];
    }

    function isFrozen(bytes32 startupId) external view returns (bool) {
        if (!_exists[startupId]) return false;
        return _escrows[startupId].isFrozen;
    }

    function pendingTranches(bytes32 startupId)
        external view escrowExists(startupId)
        returns (uint8[] memory pending)
    {
        uint8 count = 0;
        for (uint8 i = 0; i < TRANCHE_COUNT; i++) {
            if (_escrows[startupId].tranches[i].status == TrancheStatus.PENDING) count++;
        }
        pending = new uint8[](count);
        uint8 j = 0;
        for (uint8 i = 0; i < TRANCHE_COUNT; i++) {
            if (_escrows[startupId].tranches[i].status == TrancheStatus.PENDING) {
                pending[j++] = i;
            }
        }
    }

    function totalStartups() external view returns (uint256) {
        return _startupIds.length;
    }

    // ── Internal Helpers ──────────────────────────────────────────────────────

    function _releaseTranche(bytes32 startupId, uint8 trancheId, bytes32 txHash) internal {
        EscrowAccount storage esc = _escrows[startupId];
        Tranche storage t = esc.tranches[trancheId];

        t.status       = TrancheStatus.RELEASED;
        t.releasedAt   = block.timestamp;
        t.oracleTxHash = txHash;
        esc.totalReleasedWei += t.amountWei;

        // Transfer funds to beneficiary
        (bool ok, ) = payable(esc.beneficiary).call{value: t.amountWei}("");
        require(ok, "MilestoneEscrow: ETH transfer failed");

        emit TrancheReleased(startupId, trancheId, t.milestone, t.amountWei, txHash);
    }

    function _freeze(bytes32 startupId, uint256 trustScore, string memory reason) internal {
        EscrowAccount storage esc = _escrows[startupId];
        esc.isFrozen  = true;
        esc.frozenAt  = block.timestamp;
        esc.lastTrustScore = trustScore;

        // Mark all PENDING tranches as FROZEN
        for (uint8 i = 0; i < TRANCHE_COUNT; i++) {
            if (esc.tranches[i].status == TrancheStatus.PENDING) {
                esc.tranches[i].status = TrancheStatus.FROZEN;
            }
        }
        emit FundingFrozen(startupId, trustScore, block.timestamp, reason);
    }
}
