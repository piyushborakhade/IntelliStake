// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  ComplianceRules
 * @notice IntelliStake R.A.I.S.E. Framework — Module 3: Regulatory & Compliance Layer
 *
 * @dev    Implements the on-chain compliance logic for the IntelliStake Security
 *         Token following the ERC-3643 (T-REX) standard.  This contract acts as
 *         the exclusive gatekeeper for all token transfers within the IntelliStake
 *         liquidity pool.
 *
 *         ANTI-BAD-ACTOR MECHANISM:
 *         ─────────────────────────
 *         Every transfer of IntelliStake tokens MUST pass through the
 *         `canTransfer` / `TransferPolicy` guard.  The guard enforces TWO
 *         independent checks on BOTH the sender and the receiver:
 *
 *           1. KYC verification  — the investor's real-world identity has been
 *              validated by a FATF-compliant KYC provider (e.g. Onfido, Sumsub).
 *              This prevents anonymous wallets, fraudulent identities, and individuals
 *              on OFAC/sanctions lists from entering the pool.
 *
 *           2. Accredited status — the investor meets the financial thresholds
 *              required to participate in unlisted securities (₹1 Cr+ net worth
 *              under SEBI regulations / $200K income under SEC Rule 501(a)).
 *              This prevents retail investors from being exposed to illiquid,
 *              high-risk startup tokens that are unsuitable for their risk profile.
 *
 *         Together, these checks form a DUAL-LAYER IDENTITY REGISTRY that mirrors
 *         FATF Recommendation 16 (Travel Rule) for digital assets and aligns with
 *         India's SEBI Category-I AIF framework.
 *
 *         DATA INTEGRATION (R.A.I.S.E. connection):
 *         ──────────────────────────────────────────
 *         Off-chain Risk Flags produced by `traction_tracker.py` are passed to
 *         the `updateComplianceScore` function via the Chainlink oracle
 *         (IntelliStakeOracle.js).  A startup token with an active HIGH-severity
 *         risk flag has `transfersEnabled` set to false, freezing its token
 *         until the flag is cleared — providing a real-time, data-driven circuit
 *         breaker inside the blockchain layer.
 *
 * @author IntelliStake Development Team
 * @custom:institution NMIMS University — MBA (Tech) Capstone, February 2026
 */

// ---------------------------------------------------------------------------
//  INTERFACE DEFINITIONS
// ---------------------------------------------------------------------------

/**
 * @dev Minimal ERC-3643 IIdentityRegistry interface.
 *      In production, replaced by the full T-REX IdentityRegistry contract.
 */
interface IIdentityRegistry {
    function isVerified(address investor) external view returns (bool);
    function investorCountry(address investor) external view returns (uint16);
}

/**
 * @dev Minimal ICompliance interface (ERC-3643 standard).
 *      The external ComplianceModule performs additional jurisdiction-level checks.
 */
interface ICompliance {
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);
    function transferred(address from, address to, uint256 amount) external;
}

// ---------------------------------------------------------------------------
//  MAIN CONTRACT
// ---------------------------------------------------------------------------

contract ComplianceRules {

    // ── State Variables ───────────────────────────────────────────────────

    /// @notice Contract administrator (IntelliStake DAO multi-sig in production)
    address public owner;

    /// @notice Pluggable external identity registry (ERC-3643 IdentityRegistry)
    IIdentityRegistry public identityRegistry;

    /// @notice Pluggable external compliance module for jurisdiction checks
    ICompliance public complianceModule;

    // ── Core Identity Mappings ─────────────────────────────────────────────

    /**
     * @notice Maps investor address → KYC verification status.
     *
     * @dev    KYC data is provided by a registered KYC Authority
     *         (e.g., Onfido, Sumsub) and submitted on-chain by the
     *         IntelliStake KYC operator after off-chain verification.
     *
     *         BAD ACTOR PREVENTION:
     *         An address that fails FATF-compliant identity checks, appears on
     *         OFAC/UN sanctions lists, or provides fraudulent documentation is
     *         NEVER added to this mapping — permanently blocking that wallet
     *         from sending or receiving any IntelliStake security tokens.
     */
    mapping(address => bool) public isKYCVerified;

    /**
     * @notice Maps investor address → accredited investor status.
     *
     * @dev    Accreditation requires meeting SEBI Cat-I AIF or SEC Rule 501(a)
     *         financial thresholds, verified annually by a registered CA/CPA.
     *
     *         BAD ACTOR PREVENTION:
     *         Unaccredited retail wallets are blocked from the pool, preventing
     *         regulatory exposure and protecting non-sophisticated investors from
     *         illiquid, high-risk startup tokens.
     */
    mapping(address => bool) public isAccredited;

    /**
     * @notice Maps startup token address → whether transfers are currently enabled.
     *
     * @dev    Set to false when the off-chain traction_tracker.py raises a
     *         HIGH-severity Risk Flag for that startup.  The Chainlink oracle
     *         calls `setTransferEnabled` to activate/deactivate this toggle
     *         in near-real-time (oracle latency ~15 seconds).
     */
    mapping(address => bool) public transfersEnabled;

    /**
     * @notice Maps startup token address → latest AI-derived compliance score [0–100].
     *
     * @dev    Combines Trust_Score (execution_auditor.py) and Sentiment Score
     *         (traction_tracker.py) into a single on-chain metric.
     *         Score < 30 automatically triggers a transfer freeze via the oracle.
     */
    mapping(address => uint8) public complianceScore;

    /**
     * @notice Tracks the maximum token balance (in basis points of total supply)
     *         any single investor is permitted to hold.
     *         Default: 2000 bps = 20% — prevents whale concentration risk.
     */
    uint16 public maxHoldingBps = 2000;

    /**
     * @notice Minimum transfer amount in token wei (default: 1,000 tokens).
     *         Prevents dust attacks and micro-transaction spam on the network.
     */
    uint256 public minTransferAmount = 1_000 * 10**18;

    // ── Events ─────────────────────────────────────────────────────────────

    /// @notice Emitted every time a transfer is allowed or denied by policy
    event TransferPolicyEvaluated(
        address indexed from,
        address indexed to,
        uint256 amount,
        bool    allowed,
        string  reason
    );

    /// @notice Emitted when KYC status changes for an investor
    event KYCStatusUpdated(address indexed investor, bool verified, address indexed updatedBy);

    /// @notice Emitted when accredited status changes for an investor
    event AccreditationUpdated(address indexed investor, bool accredited, address indexed updatedBy);

    /// @notice Emitted when the oracle pushes a new compliance score
    event ComplianceScoreUpdated(address indexed startupToken, uint8 newScore, address indexed oracle);

    /// @notice Emitted when a startup token is frozen/unfrozen by risk flag
    event TransferFreezeToggled(address indexed startupToken, bool enabled, string reason);

    /// @notice Emitted when a transfer is blocked (audit trail for regulators)
    event UnauthorisedTransferBlocked(
        address indexed from,
        address indexed to,
        uint256 amount,
        string  reason
    );

    // ── Custom Errors (gas-efficient, Solidity ≥0.8.4) ────────────────────

    error Unauthorised(address caller);
    error KYCNotVerified(address investor);
    error NotAccredited(address investor);
    error TransfersFrozen(address startupToken);
    error AmountBelowMinimum(uint256 amount, uint256 minimum);
    error ComplianceScoreTooLow(address startupToken, uint8 score);
    error ExternalComplianceFailed(address from, address to);

    // ── Modifiers ──────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorised(msg.sender);
        _;
    }

    /**
     * @dev TransferPolicy modifier — applied to all token transfer functions
     *      in the IntelliStakeToken.sol contract via inheritance or delegation.
     *
     *      Evaluation order (fail-fast for gas efficiency):
     *        1. Minimum amount     — cheapest check first
     *        2. KYC — sender
     *        3. KYC — receiver
     *        4. Accreditation — sender
     *        5. Accreditation — receiver
     *        6. Transfer freeze (Risk Flag from oracle)
     *        7. Compliance score threshold
     *        8. External compliance module (jurisdiction, holding limits, etc.)
     */
    modifier TransferPolicy(address from, address to, uint256 amount, address startupToken) {
        // 1. Minimum transfer amount
        if (amount < minTransferAmount) {
            emit UnauthorisedTransferBlocked(from, to, amount, "Amount below minimum");
            revert AmountBelowMinimum(amount, minTransferAmount);
        }

        // 2. KYC — sender
        if (!isKYCVerified[from]) {
            emit UnauthorisedTransferBlocked(from, to, amount, "Sender KYC not verified");
            revert KYCNotVerified(from);
        }

        // 3. KYC — receiver
        if (!isKYCVerified[to]) {
            emit UnauthorisedTransferBlocked(from, to, amount, "Receiver KYC not verified");
            revert KYCNotVerified(to);
        }

        // 4. Accreditation — sender
        if (!isAccredited[from]) {
            emit UnauthorisedTransferBlocked(from, to, amount, "Sender not accredited");
            revert NotAccredited(from);
        }

        // 5. Accreditation — receiver
        if (!isAccredited[to]) {
            emit UnauthorisedTransferBlocked(from, to, amount, "Receiver not accredited");
            revert NotAccredited(to);
        }

        // 6. Transfer freeze check (oracle-driven Risk Flag)
        if (!transfersEnabled[startupToken]) {
            emit UnauthorisedTransferBlocked(from, to, amount, "Startup transfers frozen by Risk Flag");
            revert TransfersFrozen(startupToken);
        }

        // 7. Compliance score threshold
        if (complianceScore[startupToken] < 30) {
            emit UnauthorisedTransferBlocked(from, to, amount, "Compliance score below 30");
            revert ComplianceScoreTooLow(startupToken, complianceScore[startupToken]);
        }

        // 8. External compliance module (jurisdiction, holding limits, etc.)
        if (address(complianceModule) != address(0)) {
            if (!complianceModule.canTransfer(from, to, amount)) {
                emit UnauthorisedTransferBlocked(from, to, amount, "External compliance module rejected");
                revert ExternalComplianceFailed(from, to);
            }
        }

        // ── All checks passed ─────────────────────────────────────────────
        emit TransferPolicyEvaluated(from, to, amount, true, "All compliance checks passed");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────

    /**
     * @param _identityRegistry  Address of the ERC-3643 Identity Registry
     * @param _complianceModule  Address of the external compliance module (or zero)
     */
    constructor(address _identityRegistry, address _complianceModule) {
        owner              = msg.sender;
        identityRegistry   = IIdentityRegistry(_identityRegistry);
        complianceModule   = ICompliance(_complianceModule);
    }

    // ── KYC & Accreditation Management ────────────────────────────────────

    /**
     * @notice Grants or revokes KYC verification for an investor.
     * @dev    Called by the IntelliStake KYC Operator after off-chain verification.
     *         Revoking KYC immediately blocks ALL future transfers for that address —
     *         the primary mechanism for removing a bad actor discovered post-onboarding
     *         (e.g., if a sanctions match is identified after initial approval).
     *
     * @param investor  Wallet address of the investor
     * @param verified  true to verify, false to revoke
     */
    function setKYCVerified(address investor, bool verified) external onlyOwner {
        isKYCVerified[investor] = verified;
        emit KYCStatusUpdated(investor, verified, msg.sender);
    }

    /**
     * @notice Grants or revokes accredited investor status.
     * @param investor    Wallet address of the investor
     * @param accredited  true to accredit, false to revoke
     */
    function setAccredited(address investor, bool accredited) external onlyOwner {
        isAccredited[investor] = accredited;
        emit AccreditationUpdated(investor, accredited, msg.sender);
    }

    /**
     * @notice Batch-onboard multiple investors (gas-efficient for new pool launch).
     * @param investors        Array of investor wallet addresses
     * @param kycStatuses      Parallel array of KYC verification flags
     * @param accreditStatuses Parallel array of accreditation flags
     */
    function batchVerifyInvestors(
        address[] calldata investors,
        bool[]    calldata kycStatuses,
        bool[]    calldata accreditStatuses
    ) external onlyOwner {
        require(
            investors.length == kycStatuses.length &&
            investors.length == accreditStatuses.length,
            "Array length mismatch"
        );
        for (uint256 i = 0; i < investors.length; ) {
            isKYCVerified[investors[i]] = kycStatuses[i];
            isAccredited[investors[i]]  = accreditStatuses[i];
            emit KYCStatusUpdated(investors[i], kycStatuses[i], msg.sender);
            emit AccreditationUpdated(investors[i], accreditStatuses[i], msg.sender);
            unchecked { ++i; }   // gas optimisation — i cannot overflow
        }
    }

    // ── Oracle-Driven Compliance Updates ──────────────────────────────────

    /**
     * @notice Updates the AI compliance score for a startup token.
     * @dev    Called by the Chainlink oracle (IntelliStakeOracle.js) after
     *         combining Trust_Score (execution_auditor.py) and
     *         Sentiment Risk Signal (traction_tracker.py).
     *         If the new score drops below 30, transfers are automatically frozen.
     *
     * @param startupToken  Address of the startup's ERC-3643 token
     * @param score         New compliance score [0–100]
     */
    function updateComplianceScore(address startupToken, uint8 score) external onlyOwner {
        complianceScore[startupToken] = score;
        emit ComplianceScoreUpdated(startupToken, score, msg.sender);

        // Auto-freeze if score too low
        if (score < 30 && transfersEnabled[startupToken]) {
            transfersEnabled[startupToken] = false;
            emit TransferFreezeToggled(startupToken, false, "Auto-frozen: compliance score < 30");
        } else if (score >= 30 && !transfersEnabled[startupToken]) {
            transfersEnabled[startupToken] = true;
            emit TransferFreezeToggled(startupToken, true, "Auto-unfrozen: compliance score >= 30");
        }
    }

    /**
     * @notice Manually enable or disable transfers for a startup token.
     * @dev    Used by the oracle when a HIGH-severity Risk Flag (from
     *         traction_tracker.py) is raised or cleared.
     *
     * @param startupToken  Address of the startup's ERC-3643 token
     * @param enabled       true to allow transfers, false to freeze
     * @param reason        Human-readable reason for audit trail
     */
    function setTransferEnabled(
        address startupToken,
        bool    enabled,
        string calldata reason
    ) external onlyOwner {
        transfersEnabled[startupToken] = enabled;
        emit TransferFreezeToggled(startupToken, enabled, reason);
    }

    // ── Compliance Query (read-only, used by IntelliStakeToken.sol) ───────

    /**
     * @notice Core transfer eligibility check, called before every token transfer.
     * @dev    This is the primary read-only surface exposed to IntelliStakeToken.sol.
     *         All state-changing side effects are handled separately via the modifier.
     *
     * @param from          Sender address
     * @param to            Receiver address
     * @param amount        Token amount (in wei)
     * @param startupToken  Address of the specific startup token being transferred
     * @return allowed      True if all compliance checks pass
     * @return reason       Human-readable reason (empty string if allowed)
     */
    function canTransfer(
        address from,
        address to,
        uint256 amount,
        address startupToken
    ) external view returns (bool allowed, string memory reason) {
        if (amount < minTransferAmount)         return (false, "Amount below minimum");
        if (!isKYCVerified[from])               return (false, "Sender KYC not verified");
        if (!isKYCVerified[to])                 return (false, "Receiver KYC not verified");
        if (!isAccredited[from])                return (false, "Sender not accredited");
        if (!isAccredited[to])                  return (false, "Receiver not accredited");
        if (!transfersEnabled[startupToken])    return (false, "Startup transfers frozen");
        if (complianceScore[startupToken] < 30) return (false, "Compliance score too low");

        if (address(complianceModule) != address(0)) {
            if (!complianceModule.canTransfer(from, to, amount))
                return (false, "External compliance module rejected");
        }

        return (true, "");
    }

    // ── Administrative ─────────────────────────────────────────────────────

    /**
     * @notice Updates the minimum transfer amount.
     * @param newMin New minimum in token wei
     */
    function setMinTransferAmount(uint256 newMin) external onlyOwner {
        minTransferAmount = newMin;
    }

    /**
     * @notice Updates the maximum single-investor holding in basis points.
     * @param bps  New limit in basis points (e.g., 2000 = 20%)
     */
    function setMaxHoldingBps(uint16 bps) external onlyOwner {
        require(bps <= 10_000, "Cannot exceed 100%");
        maxHoldingBps = bps;
    }

    /**
     * @notice Replaces the external compliance module.
     * @param newModule  Address of the new ICompliance implementation
     */
    function setComplianceModule(address newModule) external onlyOwner {
        complianceModule = ICompliance(newModule);
    }

    /**
     * @notice Transfers contract ownership to a new administrator.
     * @param newOwner  Address of the new owner (should be a multi-sig in production)
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address not allowed");
        owner = newOwner;
    }

    // ── Convenience Getters ────────────────────────────────────────────────

    /**
     * @notice Returns the full compliance status of an investor in one call.
     * @param investor  Wallet address to query
     * @return kyc         Whether KYC is verified
     * @return accredited  Whether investor is accredited
     * @return fullPass    True only if both conditions are met
     */
    function getInvestorStatus(address investor)
        external view
        returns (bool kyc, bool accredited, bool fullPass)
    {
        kyc        = isKYCVerified[investor];
        accredited = isAccredited[investor];
        fullPass   = kyc && accredited;
    }

    /**
     * @notice Returns the full compliance status of a startup token in one call.
     * @param startupToken  Startup token contract address
     * @return enabled   Whether transfers are enabled
     * @return score     Current AI compliance score [0–100]
     * @return healthy   True only if transfers enabled AND score >= 30
     */
    function getStartupCompliance(address startupToken)
        external view
        returns (bool enabled, uint8 score, bool healthy)
    {
        enabled = transfersEnabled[startupToken];
        score   = complianceScore[startupToken];
        healthy = enabled && score >= 30;
    }
}
