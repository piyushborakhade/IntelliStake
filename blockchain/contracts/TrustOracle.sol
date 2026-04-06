// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  TrustOracle
 * @notice IntelliStake R.A.I.S.E. Framework — On-Chain Oracle Receiver
 *
 * Architecture:
 *   Off-chain AI engine (oracle_bridge.py / IntelliStakeOracle.js) generates
 *   trust scores and ECDSA-signs them. This contract verifies those signatures
 *   and routes the score to:
 *     1. MilestoneEscrow  — approve tranche or freeze funding
 *     2. ComplianceRules  — update on-chain compliance score
 *
 * Security:
 *   - ECDSA signature verification (eth_sign format) prevents spoofed scores
 *   - Nonce-based replay protection: each (startupId, nonce) pair can only be used once
 *   - Timestamp freshness: data older than 6 hours is rejected
 *   - Per-startup rate limit: max one update per hour
 *   - Only owner can change oracle signer or contract references
 *
 * Trust Score Scaling:
 *   Scores are multiplied by 1000 (TRUST_SCALE) so float 0.72 → uint 720.
 *   FREEZE_THRESHOLD = 350 means scores below 0.35 trigger an escrow freeze.
 *
 * Integration:
 *   - oracle_bridge.py calls pushTrustScore() with signed payload
 *   - MilestoneEscrow.oracleApprove() / freezeMilestoneFunding() are called here
 *   - ComplianceRules.updateComplianceScore() is called here
 *
 * Author: IntelliStake Development Team
 * Course: MBA (Tech) Capstone - NMIMS, February 2026
 */

// ── Interfaces ────────────────────────────────────────────────────────────────

interface IMilestoneEscrow {
    function oracleApprove(
        bytes32 startupId,
        uint8   trancheId,
        uint256 trustScore,
        bytes32 txHash
    ) external;

    function freezeMilestoneFunding(
        bytes32 startupId,
        uint256 trustScore
    ) external;

    function isFrozen(bytes32 startupId) external view returns (bool);
}

interface IComplianceRules {
    function updateComplianceScore(address startupToken, uint8 score) external;
    function setTransferEnabled(address startupToken, bool enabled, string calldata reason) external;
}

// ── Main Contract ─────────────────────────────────────────────────────────────

contract TrustOracle {

    // ── Constants ─────────────────────────────────────────────────────────────

    /// @notice Scores are scaled ×1000: 0.72 trust_score → 720
    uint256 public constant TRUST_SCALE          = 1000;

    /// @notice Scores below this trigger an escrow freeze (0.35 × 1000 = 350)
    uint256 public constant FREEZE_THRESHOLD     = 350;

    /// @notice Max data age accepted from oracle (prevents stale pushes)
    uint256 public constant MAX_DATA_AGE         = 6 hours;

    /// @notice Minimum interval between updates for same startup (anti-spam)
    uint256 public constant UPDATE_INTERVAL      = 1 hours;

    /// @notice trancheId value meaning "freeze only, no milestone approval"
    uint8   public constant TRANCHE_FREEZE_ONLY  = 255;

    // ── State ─────────────────────────────────────────────────────────────────

    address public owner;

    /// @notice Off-chain oracle node's Ethereum signing key
    address public oracleSigner;

    /// @notice Destination for milestone gating
    IMilestoneEscrow public milestoneEscrow;

    /// @notice Destination for compliance score updates
    IComplianceRules public complianceRules;

    /// @notice startupId → last pushed trust score (×1000)
    mapping(bytes32 => uint256) public lastTrustScore;

    /// @notice startupId → block.timestamp of last update
    mapping(bytes32 => uint256) public lastUpdateTime;

    /// @notice nonce → consumed (replay protection)
    mapping(bytes32 => bool) public usedNonces;

    // ── Events ────────────────────────────────────────────────────────────────

    event TrustScoreUpdated(
        bytes32 indexed startupId,
        uint256 trustScore,
        uint8   trancheId,
        address startupToken,
        uint256 timestamp
    );
    event FreezeTriggered(
        bytes32 indexed startupId,
        uint256 trustScore,
        string  reason
    );
    event TrancheApprovalForwarded(
        bytes32 indexed startupId,
        uint8   trancheId,
        uint256 trustScore
    );
    event ComplianceScoreForwarded(
        bytes32 indexed startupId,
        address startupToken,
        uint8   complianceScore
    );
    event OracleSignerUpdated(address indexed newSigner);
    event MilestoneEscrowUpdated(address indexed newEscrow);
    event ComplianceRulesUpdated(address indexed newCompliance);

    // ── Errors ────────────────────────────────────────────────────────────────

    error Unauthorised(address caller);
    error InvalidSignature(address recovered, address expected);
    error NonceAlreadyUsed(bytes32 nonce);
    error StaleOracleData(uint256 dataTimestamp, uint256 currentTime, uint256 maxAge);
    error UpdateTooFrequent(bytes32 startupId, uint256 nextAllowedTime);
    error InvalidTrustScore(uint256 score);
    error ZeroAddress();

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorised(msg.sender);
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param _oracleSigner    Ethereum address of the off-chain oracle signing key
     * @param _milestoneEscrow Address of MilestoneEscrow.sol (or zero to disable)
     * @param _complianceRules Address of ComplianceRules.sol (or zero to disable)
     */
    constructor(
        address _oracleSigner,
        address _milestoneEscrow,
        address _complianceRules
    ) {
        if (_oracleSigner == address(0)) revert ZeroAddress();
        owner          = msg.sender;
        oracleSigner   = _oracleSigner;
        milestoneEscrow = IMilestoneEscrow(_milestoneEscrow);
        complianceRules = IComplianceRules(_complianceRules);
    }

    // ── Core: Push Trust Score ────────────────────────────────────────────────

    /**
     * @notice Accept a signed trust score from the IntelliStake oracle node.
     *
     * Called by the oracle backend (oracle_bridge.py / oracle_bridge_full.py)
     * after the Python AI engine finishes a risk audit cycle.
     *
     * @param startupId     Bytes32 startup identifier (keccak256 of startup UUID)
     * @param trustScore    Trust score × 1000 (e.g. 0.72 → 720)
     * @param trancheId     Milestone tranche to approve (0–3), or TRANCHE_FREEZE_ONLY (255)
     * @param startupToken  ERC-3643 token address for compliance score update (zero to skip)
     * @param dataTimestamp Unix timestamp when oracle generated this score
     * @param nonce         Unique per-call bytes32 nonce (prevents replay attacks)
     * @param signature     ECDSA signature: eth_sign( keccak256(startupId ‖ trustScore ‖ dataTimestamp ‖ nonce) )
     */
    function pushTrustScore(
        bytes32 startupId,
        uint256 trustScore,
        uint8   trancheId,
        address startupToken,
        uint256 dataTimestamp,
        bytes32 nonce,
        bytes   calldata signature
    ) external {
        // ── 1. Validate trust score range ─────────────────────────────────────
        if (trustScore > TRUST_SCALE) revert InvalidTrustScore(trustScore);

        // ── 2. Replay protection ──────────────────────────────────────────────
        if (usedNonces[nonce]) revert NonceAlreadyUsed(nonce);

        // ── 3. Timestamp freshness ────────────────────────────────────────────
        if (block.timestamp > dataTimestamp + MAX_DATA_AGE) {
            revert StaleOracleData(dataTimestamp, block.timestamp, MAX_DATA_AGE);
        }

        // ── 4. Rate limiting (one update per startup per hour) ────────────────
        uint256 nextAllowed = lastUpdateTime[startupId] + UPDATE_INTERVAL;
        if (block.timestamp < nextAllowed) {
            revert UpdateTooFrequent(startupId, nextAllowed);
        }

        // ── 5. ECDSA signature verification ───────────────────────────────────
        bytes32 messageHash = keccak256(abi.encodePacked(
            startupId,
            trustScore,
            dataTimestamp,
            nonce
        ));
        // Reproduce Ethereum signed message hash (eth_sign / personal_sign)
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        address signer = _recoverSigner(ethSignedHash, signature);
        if (signer != oracleSigner) revert InvalidSignature(signer, oracleSigner);

        // ── 6. Commit state ───────────────────────────────────────────────────
        usedNonces[nonce]           = true;
        lastTrustScore[startupId]   = trustScore;
        lastUpdateTime[startupId]   = block.timestamp;

        emit TrustScoreUpdated(startupId, trustScore, trancheId, startupToken, block.timestamp);

        // ── 7. Route: freeze if below threshold ───────────────────────────────
        if (trustScore < FREEZE_THRESHOLD) {
            emit FreezeTriggered(startupId, trustScore, "trust_score < 0.35");

            if (address(milestoneEscrow) != address(0)) {
                try milestoneEscrow.freezeMilestoneFunding(startupId, trustScore) {
                    // freeze forwarded
                } catch {
                    // escrow may already be frozen or startup not registered — continue
                }
            }

            // Auto-freeze compliance (score 0 → transfers frozen by ComplianceRules)
            if (address(complianceRules) != address(0) && startupToken != address(0)) {
                uint8 compScore = _toComplianceScore(trustScore);
                try complianceRules.updateComplianceScore(startupToken, compScore) {
                    emit ComplianceScoreForwarded(startupId, startupToken, compScore);
                } catch {
                    // compliance module unavailable — non-fatal
                }
            }
            return; // Do NOT approve any tranche when frozen
        }

        // ── 8. Route: approve milestone tranche ──────────────────────────────
        if (trancheId != TRANCHE_FREEZE_ONLY && address(milestoneEscrow) != address(0)) {
            bytes32 txHash = keccak256(abi.encodePacked(
                startupId, trancheId, block.timestamp, block.number
            ));
            try milestoneEscrow.oracleApprove(startupId, trancheId, trustScore, txHash) {
                emit TrancheApprovalForwarded(startupId, trancheId, trustScore);
            } catch {
                // tranche may already be released or startup not yet registered — non-fatal
            }
        }

        // ── 9. Update compliance score ────────────────────────────────────────
        if (address(complianceRules) != address(0) && startupToken != address(0)) {
            uint8 compScore = _toComplianceScore(trustScore);
            try complianceRules.updateComplianceScore(startupToken, compScore) {
                emit ComplianceScoreForwarded(startupId, startupToken, compScore);
            } catch {
                // non-fatal
            }
        }
    }

    // ── Admin: Oracle-Triggered Risk Stop ─────────────────────────────────────

    /**
     * @notice Emergency manual freeze callable by owner (e.g. court order, regulatory action).
     *         Does NOT require a valid oracle signature — owner-only override.
     * @param startupId  Target startup
     * @param reason     Human-readable reason for audit trail
     */
    function emergencyFreeze(bytes32 startupId, string calldata reason)
        external
        onlyOwner
    {
        emit FreezeTriggered(startupId, 0, reason);

        if (address(milestoneEscrow) != address(0)) {
            try milestoneEscrow.freezeMilestoneFunding(startupId, 0) {} catch {}
        }
    }

    // ── Admin: Configuration ──────────────────────────────────────────────────

    /**
     * @notice Replace the oracle signing key (e.g. after key rotation).
     * @param _signer New oracle node Ethereum address
     */
    function setOracleSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        oracleSigner = _signer;
        emit OracleSignerUpdated(_signer);
    }

    /**
     * @notice Update MilestoneEscrow reference.
     * @param _escrow New escrow contract address (zero to disable routing)
     */
    function setMilestoneEscrow(address _escrow) external onlyOwner {
        milestoneEscrow = IMilestoneEscrow(_escrow);
        emit MilestoneEscrowUpdated(_escrow);
    }

    /**
     * @notice Update ComplianceRules reference.
     * @param _compliance New compliance contract address (zero to disable routing)
     */
    function setComplianceRules(address _compliance) external onlyOwner {
        complianceRules = IComplianceRules(_compliance);
        emit ComplianceRulesUpdated(_compliance);
    }

    /**
     * @notice Transfer contract ownership.
     * @param newOwner New owner address (should be a multi-sig in production)
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Get latest trust score and update time for a startup.
     * @param startupId  Startup identifier
     * @return score     Last trust score × 1000
     * @return updatedAt Timestamp of last oracle update (0 if never updated)
     */
    function getTrustScore(bytes32 startupId)
        external
        view
        returns (uint256 score, uint256 updatedAt)
    {
        return (lastTrustScore[startupId], lastUpdateTime[startupId]);
    }

    /**
     * @notice Check whether a nonce has already been used (replay detection).
     * @param nonce  The nonce to check
     * @return True if already consumed
     */
    function isNonceUsed(bytes32 nonce) external view returns (bool) {
        return usedNonces[nonce];
    }

    /**
     * @notice Verify a signature without submitting it (off-chain preview / debugging).
     * @param startupId     Startup identifier used in original signing
     * @param trustScore    Trust score × 1000 used in original signing
     * @param dataTimestamp Timestamp used in original signing
     * @param nonce         Nonce used in original signing
     * @param signature     ECDSA signature bytes
     * @return signer       Recovered signer address
     * @return valid        True if signer matches oracleSigner
     */
    function verifySignature(
        bytes32 startupId,
        uint256 trustScore,
        uint256 dataTimestamp,
        bytes32 nonce,
        bytes   calldata signature
    ) external view returns (address signer, bool valid) {
        bytes32 messageHash = keccak256(abi.encodePacked(
            startupId, trustScore, dataTimestamp, nonce
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        signer = _recoverSigner(ethSignedHash, signature);
        valid  = (signer == oracleSigner);
    }

    // ── Internal Helpers ──────────────────────────────────────────────────────

    /**
     * @dev Convert trust score (×1000) to compliance score (0–100).
     *      trust 720 → compliance 72.  trust 350 → compliance 35.
     */
    function _toComplianceScore(uint256 trustScore) internal pure returns (uint8) {
        // trustScore is in [0, 1000]; map to [0, 100]
        uint256 scaled = (trustScore * 100) / TRUST_SCALE;
        return uint8(scaled > 100 ? 100 : scaled);
    }

    /**
     * @dev ECDSA signature recovery (r, s, v components, no SafeMath needed in 0.8.x).
     */
    function _recoverSigner(bytes32 hash, bytes calldata sig)
        internal
        pure
        returns (address)
    {
        require(sig.length == 65, "TrustOracle: invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8   v;

        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }

        // Normalise v (some signers return 0/1 instead of 27/28)
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "TrustOracle: invalid v value");

        return ecrecover(hash, v, r, s);
    }
}
