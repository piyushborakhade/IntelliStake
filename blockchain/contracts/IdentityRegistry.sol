// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IdentityRegistry
 * @dev IntelliStake ERC-3643 KYC Identity Registry
 *
 * Manages on-chain investor KYC identity for the IntelliStake platform.
 * Only registered, verified investors can receive/transfer IntelliStakeTokens.
 *
 * KYC Levels:
 *   0 = UNVERIFIED   — no registration
 *   1 = RETAIL       — basic KYC (Aadhar/PAN verified)
 *   2 = ACCREDITED   — meets SEBI accredited investor threshold
 *   3 = INSTITUTIONAL — SEBI Category-I FPI or regulated institution
 *
 * Integration:
 *   IntelliStakeToken.sol calls isVerified(wallet) before every transfer.
 *   Wallets with kycLevel == 0 (UNVERIFIED) are blocked.
 */
contract IdentityRegistry {

    // ── Structs ──────────────────────────────────────────────────────────────

    struct Identity {
        address  wallet;
        uint8    kycLevel;       // 0–3  as defined above
        string   entityName;     // investor or institution name
        string   kycProvider;    // e.g. "IntelliStake KYC", "Onfido", "CKYC"
        bool     isActive;       // false = identity revoked/locked
        uint256  registeredAt;   // block.timestamp at registration
        uint256  lastUpdated;    // block.timestamp of last update
    }

    // ── State ─────────────────────────────────────────────────────────────────

    address public owner;
    address public tokenContract;    // IntelliStakeToken address (set after deploy)

    mapping(address => Identity) private _identities;
    address[] private _registeredWallets;
    mapping(address => bool) private _exists;

    // Operator role — can register identities (e.g. KYC backend service wallet)
    mapping(address => bool) public operators;

    // ── Events ────────────────────────────────────────────────────────────────

    event InvestorRegistered(
        address indexed wallet,
        string  entityName,
        uint8   kycLevel,
        uint256 timestamp
    );
    event IdentityRevoked(address indexed wallet, string reason, uint256 timestamp);
    event KycLevelUpdated(address indexed wallet, uint8 oldLevel, uint8 newLevel);
    event IdentityRestored(address indexed wallet, uint256 timestamp);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event TokenContractSet(address indexed tokenContract);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "IdentityRegistry: not owner");
        _;
    }

    modifier onlyOperator() {
        require(
            msg.sender == owner || operators[msg.sender],
            "IdentityRegistry: not authorised operator"
        );
        _;
    }

    modifier walletMustExist(address wallet) {
        require(_exists[wallet], "IdentityRegistry: wallet not registered");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        operators[msg.sender] = true;
    }

    // ── Core Registration Functions ───────────────────────────────────────────

    /**
     * @notice Register a new investor wallet with KYC identity.
     * @param wallet      Ethereum wallet address of the investor.
     * @param entityName  Investor name or institution name.
     * @param kycLevel    KYC tier: 1=RETAIL, 2=ACCREDITED, 3=INSTITUTIONAL.
     * @param kycProvider Name of the KYC provider / verification source.
     */
    function registerInvestor(
        address wallet,
        string  calldata entityName,
        uint8   kycLevel,
        string  calldata kycProvider
    ) external onlyOperator {
        require(wallet != address(0), "IdentityRegistry: zero address");
        require(kycLevel >= 1 && kycLevel <= 3, "IdentityRegistry: invalid KYC level (1-3)");
        require(!_exists[wallet], "IdentityRegistry: already registered, use updateKycLevel");

        _identities[wallet] = Identity({
            wallet:       wallet,
            kycLevel:     kycLevel,
            entityName:   entityName,
            kycProvider:  kycProvider,
            isActive:     true,
            registeredAt: block.timestamp,
            lastUpdated:  block.timestamp
        });

        _registeredWallets.push(wallet);
        _exists[wallet] = true;

        emit InvestorRegistered(wallet, entityName, kycLevel, block.timestamp);
    }

    /**
     * @notice Batch registration — for seeding mock_investors.json at deployment.
     */
    function batchRegister(
        address[] calldata wallets,
        string[]  calldata entityNames,
        uint8[]   calldata kycLevels,
        string    calldata kycProvider
    ) external onlyOperator {
        require(
            wallets.length == entityNames.length && wallets.length == kycLevels.length,
            "IdentityRegistry: array length mismatch"
        );
        for (uint256 i = 0; i < wallets.length; i++) {
            if (_exists[wallets[i]] || wallets[i] == address(0)) continue;
            if (kycLevels[i] == 0 || kycLevels[i] > 3) continue;

            _identities[wallets[i]] = Identity({
                wallet:       wallets[i],
                kycLevel:     kycLevels[i],
                entityName:   entityNames[i],
                kycProvider:  kycProvider,
                isActive:     true,
                registeredAt: block.timestamp,
                lastUpdated:  block.timestamp
            });
            _registeredWallets.push(wallets[i]);
            _exists[wallets[i]] = true;

            emit InvestorRegistered(wallets[i], entityNames[i], kycLevels[i], block.timestamp);
        }
    }

    // ── Verification Functions ────────────────────────────────────────────────

    /**
     * @notice Check if a wallet holds an active, verified identity.
     * @dev Called by IntelliStakeToken.sol before every transfer.
     */
    function isVerified(address wallet) external view returns (bool) {
        if (!_exists[wallet]) return false;
        Identity storage id = _identities[wallet];
        return id.isActive && id.kycLevel >= 1;
    }

    /**
     * @notice Check if wallet meets a specific minimum KYC level.
     * @param wallet   Target wallet.
     * @param minLevel Minimum required KYC level.
     */
    function meetsKycLevel(address wallet, uint8 minLevel) external view returns (bool) {
        if (!_exists[wallet]) return false;
        Identity storage id = _identities[wallet];
        return id.isActive && id.kycLevel >= minLevel;
    }

    /**
     * @notice Returns full identity struct for a wallet.
     */
    function getIdentity(address wallet)
        external view walletMustExist(wallet)
        returns (Identity memory)
    {
        return _identities[wallet];
    }

    /**
     * @notice Returns KYC level label as a string.
     */
    function kycLevelLabel(address wallet) external view returns (string memory) {
        if (!_exists[wallet]) return "UNVERIFIED";
        uint8 lvl = _identities[wallet].kycLevel;
        if (!_identities[wallet].isActive) return "REVOKED";
        if (lvl == 1) return "RETAIL";
        if (lvl == 2) return "ACCREDITED";
        if (lvl == 3) return "INSTITUTIONAL";
        return "UNKNOWN";
    }

    // ── Admin Functions ───────────────────────────────────────────────────────

    /**
     * @notice Update the KYC level for an already-registered investor.
     */
    function updateKycLevel(address wallet, uint8 newLevel)
        external onlyOperator walletMustExist(wallet)
    {
        require(newLevel >= 1 && newLevel <= 3, "IdentityRegistry: invalid KYC level");
        uint8 old = _identities[wallet].kycLevel;
        _identities[wallet].kycLevel    = newLevel;
        _identities[wallet].lastUpdated = block.timestamp;
        emit KycLevelUpdated(wallet, old, newLevel);
    }

    /**
     * @notice Revoke an investor's identity (locks all token transfers for this wallet).
     * @param reason Human-readable reason (AML flag, court order, etc.)
     */
    function revokeIdentity(address wallet, string calldata reason)
        external onlyOperator walletMustExist(wallet)
    {
        _identities[wallet].isActive    = false;
        _identities[wallet].lastUpdated = block.timestamp;
        emit IdentityRevoked(wallet, reason, block.timestamp);
    }

    /**
     * @notice Restore a previously revoked identity.
     */
    function restoreIdentity(address wallet)
        external onlyOwner walletMustExist(wallet)
    {
        _identities[wallet].isActive    = true;
        _identities[wallet].lastUpdated = block.timestamp;
        emit IdentityRestored(wallet, block.timestamp);
    }

    // ── Operator Management ───────────────────────────────────────────────────

    function addOperator(address op) external onlyOwner {
        operators[op] = true;
        emit OperatorAdded(op);
    }

    function removeOperator(address op) external onlyOwner {
        operators[op] = false;
        emit OperatorRemoved(op);
    }

    function setTokenContract(address token) external onlyOwner {
        tokenContract = token;
        emit TokenContractSet(token);
    }

    // ── View Helpers ──────────────────────────────────────────────────────────

    function totalRegistered() external view returns (uint256) {
        return _registeredWallets.length;
    }

    function totalActive() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < _registeredWallets.length; i++) {
            if (_identities[_registeredWallets[i]].isActive) count++;
        }
        return count;
    }

    function getRegisteredWallets() external view returns (address[] memory) {
        return _registeredWallets;
    }

    /**
     * @notice Returns summary counts by KYC level.
     */
    function kycLevelCounts() external view returns (
        uint256 retail,
        uint256 accredited,
        uint256 institutional,
        uint256 revoked
    ) {
        for (uint256 i = 0; i < _registeredWallets.length; i++) {
            Identity storage id = _identities[_registeredWallets[i]];
            if (!id.isActive) { revoked++; continue; }
            if (id.kycLevel == 1) retail++;
            else if (id.kycLevel == 2) accredited++;
            else if (id.kycLevel == 3) institutional++;
        }
    }
}
