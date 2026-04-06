// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title IntelliStakeToken
 * @dev ERC-3643 compliant security token for AI-vetted startup investments
 * 
 * This contract implements the T-REX (Token for Regulated EXchanges) standard,
 * providing regulatory compliance for tokenized securities in decentralized VC.
 * 
 * Key Features:
 * - Identity verification via IdentityRegistry
 * - Accredited investor validation
 * - Milestone-based funding escrow
 * - Transfer restrictions and compliance checks
 * 
 * Author: IntelliStake Development Team
 * Course: MBA (Tech) Capstone - NMIMS
 * Date: February 2026
 */
contract IntelliStakeToken is ERC20, Ownable, ReentrancyGuard, Pausable {
    
    // ==================== State Variables ====================
    
    /// @dev Identity Registry contract for KYC verification
    IIdentityRegistry public identityRegistry;
    
    /// @dev Compliance contract for transfer validation
    ICompliance public compliance;
    
    /// @dev Mapping of startup ID to funding tranches
    mapping(uint256 => Tranche[]) public startupTranches;
    
    /// @dev Mapping of milestone hashes to verification status
    mapping(bytes32 => bool) public verifiedMilestones;
    
    /// @dev Mapping of addresses to accredited investor status
    mapping(address => bool) public accreditedInvestors;

    /// @dev Trusted oracle address that can call freezeMilestoneFunding()
    address public oracleAddress;

    /// @dev Mapping of startup token address → milestone funding frozen
    mapping(address => bool) public milestoneFrozen;

    /// @dev Maximum tokens per address (anti-concentration)
    uint256 public maxHoldingPerAddress;
    
    /// @dev Minimum investment amount
    uint256 public minInvestmentAmount;
    
    // ==================== Structs ====================
    
    /**
     * @dev Represents a funding tranche locked for milestone completion
     */
    struct Tranche {
        uint256 amount;              // Amount of tokens locked
        bytes32 milestoneHash;       // Hash of milestone requirements
        bool released;               // Whether funds have been released
        uint256 lockTimestamp;       // When the tranche was locked
        address beneficiary;         // Startup wallet address
    }
    
    // ==================== Events ====================
    
    event IdentityRegistrySet(address indexed registry);
    event ComplianceSet(address indexed compliance);
    event OracleAddressSet(address indexed oracle);
    event TrancheLocked(uint256 indexed startupId, uint256 amount, bytes32 milestoneHash);
    event TrancheReleased(uint256 indexed startupId, uint256 trancheIndex, uint256 amount);
    event MilestoneVerified(bytes32 indexed milestoneHash, uint256 timestamp);
    event AccreditationUpdated(address indexed investor, bool status);
    event TransferRejected(address indexed from, address indexed to, uint256 amount, string reason);
    event MilestoneFundingFrozen(address indexed startupToken, string reason, uint256 timestamp);
    event MilestoneFundingRestored(address indexed startupToken, uint256 timestamp);
    
    // ==================== Errors ====================
    
    error NotIdentityVerified(address account);
    error NotAccredited(address account);
    error ExceedsMaxHolding(address account, uint256 amount);
    error BelowMinInvestment(uint256 amount);
    error TrancheAlreadyReleased(uint256 startupId, uint256 trancheIndex);
    error MilestoneNotVerified(bytes32 milestoneHash);
    error InvalidMilestoneProof();
    error TransferNotCompliant(address from, address to);
    error MilestoneFundingCurrentlyFrozen(address startupToken);
    error NotOracle(address caller);
    
    // ==================== Constructor ====================
    
    /**
     * @dev Initialize IntelliStake security token
     * @param _initialOwner Address of the contract owner
     */
    constructor(address _initialOwner) 
        ERC20("IntelliStake Security Token", "ISTK")
        Ownable()
    {
        if (_initialOwner != address(0)) transferOwnership(_initialOwner);
        maxHoldingPerAddress = 1_000_000 * 10**decimals(); // 1M tokens max per address
        minInvestmentAmount = 1_000 * 10**decimals();      // 1K tokens minimum investment
    }
    
    // ==================== Identity & Compliance ====================
    
    /**
     * @dev Set the Identity Registry contract address
     * @param _identityRegistry Address of the T-REX Identity Registry
     */
    function setIdentityRegistry(address _identityRegistry) external onlyOwner {
        require(_identityRegistry != address(0), "Invalid registry address");
        identityRegistry = IIdentityRegistry(_identityRegistry);
        emit IdentityRegistrySet(_identityRegistry);
    }
    
    /**
     * @dev Set the Compliance contract address
     * @param _compliance Address of the T-REX Compliance contract
     */
    function setCompliance(address _compliance) external onlyOwner {
        require(_compliance != address(0), "Invalid compliance address");
        compliance = ICompliance(_compliance);
        emit ComplianceSet(_compliance);
    }
    
    /**
     * @dev Set the trusted oracle address (TrustOracle.sol or oracle_bridge backend wallet).
     *      The oracle can call freezeMilestoneFunding() to halt a startup's token transfers.
     * @param _oracle Address of the oracle contract or signer wallet
     */
    function setOracleAddress(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle address");
        oracleAddress = _oracle;
        emit OracleAddressSet(_oracle);
    }

    /**
     * @dev Freeze milestone funding for a startup token.
     *      Called by TrustOracle when trust_score < 0.35 or HIGH risk flag raised.
     *      Frozen token address cannot be used as the 'to' address in transfers.
     * @param startupToken Address of the startup's token (or wallet) to freeze
     * @param reason       Human-readable reason for the freeze (stored in event log)
     */
    function freezeMilestoneFunding(address startupToken, string calldata reason) external {
        require(
            msg.sender == oracleAddress || msg.sender == owner(),
            "IntelliStakeToken: not oracle or owner"
        );
        require(startupToken != address(0), "Invalid startup token address");
        milestoneFrozen[startupToken] = true;
        emit MilestoneFundingFrozen(startupToken, reason, block.timestamp);
    }

    /**
     * @dev Restore milestone funding after a freeze (manual override by owner).
     * @param startupToken Address to unfreeze
     */
    function restoreMilestoneFunding(address startupToken) external onlyOwner {
        milestoneFrozen[startupToken] = false;
        emit MilestoneFundingRestored(startupToken, block.timestamp);
    }

    /**
     * @dev Check if milestone funding is currently frozen for a startup token.
     * @param startupToken Address to check
     * @return frozen True if frozen
     */
    function getMilestoneStatus(address startupToken) external view returns (bool frozen) {
        return milestoneFrozen[startupToken];
    }

    /**
     * @dev Update accredited investor status
     * @param investor Address to update
     * @param status True if accredited, false otherwise
     */
    function setAccreditedInvestor(address investor, bool status) external onlyOwner {
        accreditedInvestors[investor] = status;
        emit AccreditationUpdated(investor, status);
    }
    
    /**
     * @dev Batch update accredited investors (gas efficient)
     * @param investors Array of investor addresses
     * @param statuses Array of accreditation statuses
     */
    function batchSetAccreditedInvestors(
        address[] calldata investors,
        bool[] calldata statuses
    ) external onlyOwner {
        require(investors.length == statuses.length, "Array length mismatch");
        
        for (uint256 i = 0; i < investors.length; i++) {
            accreditedInvestors[investors[i]] = statuses[i];
            emit AccreditationUpdated(investors[i], statuses[i]);
        }
    }
    
    /**
     * @dev Check if an address has valid KYC identity
     * @param account Address to check
     * @return True if identity is verified
     */
    function isIdentityVerified(address account) public view returns (bool) {
        if (address(identityRegistry) == address(0)) {
            return true; // If no registry set, allow transfers (for testing)
        }
        return identityRegistry.isVerified(account);
    }
    
    /**
     * @dev Check if transfer is compliant with all regulations
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount to transfer
     * @return True if transfer is allowed
     */
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) public view returns (bool) {
        // Check 1: Identity verification (KYC)
        if (!isIdentityVerified(from)) {
            return false;
        }
        if (!isIdentityVerified(to)) {
            return false;
        }
        
        // Check 2: Accredited investor status (for purchases)
        if (from == address(0)) { // Minting
            if (!accreditedInvestors[to]) {
                return false;
            }
        }
        
        // Check 3: Maximum holding limit (anti-concentration)
        if (balanceOf(to) + amount > maxHoldingPerAddress) {
            return false;
        }
        
        // Check 4: Minimum investment amount (for new positions)
        if (balanceOf(to) == 0 && amount < minInvestmentAmount) {
            return false;
        }
        
        // Check 5: Milestone funding freeze (oracle-driven circuit breaker)
        // If the receiving startup token is frozen, block further investment transfers
        if (milestoneFrozen[to]) {
            return false;
        }

        // Check 6: External compliance module (if set).
        // ComplianceRules.canTransfer takes 4 args: (from, to, amount, startupToken).
        // We pass address(this) as the startupToken since this IS the token contract.
        if (address(compliance) != address(0)) {
            (bool allowed,) = compliance.canTransfer(from, to, amount, address(this));
            return allowed;
        }
        
        return true;
    }
    
    // ==================== Milestone-Based Escrow ====================
    
    /**
     * @dev Lock a funding tranche for a startup, pending milestone completion
     * @param startupId Unique identifier for the startup
     * @param amount Amount of tokens to lock
     * @param milestoneHash Keccak256 hash of milestone requirements
     * @param beneficiary Address that will receive funds upon milestone completion
     */
    function lockTranche(
        uint256 startupId,
        uint256 amount,
        bytes32 milestoneHash,
        address beneficiary
    ) external onlyOwner nonReentrant {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be positive");
        require(milestoneHash != bytes32(0), "Invalid milestone hash");
        
        // Create new tranche
        Tranche memory newTranche = Tranche({
            amount: amount,
            milestoneHash: milestoneHash,
            released: false,
            lockTimestamp: block.timestamp,
            beneficiary: beneficiary
        });
        
        startupTranches[startupId].push(newTranche);
        
        // Mint tokens to this contract (escrowed)
        _mint(address(this), amount);
        
        emit TrancheLocked(startupId, amount, milestoneHash);
    }
    
    /**
     * @dev Release a tranche to the startup upon milestone verification
     * @param startupId Startup identifier
     * @param trancheIndex Index of the tranche in the array
     * @param proof Off-chain proof of milestone completion (oracle data)
     */
    function releaseTranche(
        uint256 startupId,
        uint256 trancheIndex,
        bytes calldata proof
    ) external onlyOwner nonReentrant {
        Tranche[] storage tranches = startupTranches[startupId];
        require(trancheIndex < tranches.length, "Invalid tranche index");
        
        Tranche storage tranche = tranches[trancheIndex];
        
        if (tranche.released) {
            revert TrancheAlreadyReleased(startupId, trancheIndex);
        }
        
        // Verify milestone completion
        bytes32 milestoneHash = tranche.milestoneHash;
        if (!verifyMilestone(milestoneHash, proof)) {
            revert InvalidMilestoneProof();
        }
        
        // Mark milestone as verified
        verifiedMilestones[milestoneHash] = true;
        emit MilestoneVerified(milestoneHash, block.timestamp);
        
        // Release funds
        tranche.released = true;
        _transfer(address(this), tranche.beneficiary, tranche.amount);
        
        emit TrancheReleased(startupId, trancheIndex, tranche.amount);
    }
    
    /**
     * @dev Verify milestone completion using ECDSA oracle proof.
     *
     * The off-chain oracle signs: eth_sign( keccak256(milestoneHash ‖ block.chainid) )
     * The `proof` parameter must be the 65-byte (r, s, v) ECDSA signature produced
     * by the oracle node's private key (corresponding to oracleAddress).
     *
     * @param milestoneHash Hash of the milestone that was completed
     * @param proof         65-byte ECDSA signature from the oracle wallet
     * @return True if signature is valid and came from oracleAddress
     */
    function verifyMilestone(
        bytes32 milestoneHash,
        bytes calldata proof
    ) internal view returns (bool) {
        // Require exactly 65 bytes (r=32, s=32, v=1)
        if (proof.length != 65) return false;
        if (milestoneHash == bytes32(0)) return false;

        // If no oracle configured, fall back to owner-only mode (testing only)
        if (oracleAddress == address(0)) return true;

        // Reproduce the Ethereum signed message hash
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            // Include chainId to prevent cross-chain replay
            keccak256(abi.encodePacked(milestoneHash, block.chainid))
        ));

        // Recover signer from ECDSA signature
        bytes32 r;
        bytes32 s;
        uint8   v;
        assembly {
            r := calldataload(proof.offset)
            s := calldataload(add(proof.offset, 32))
            v := byte(0, calldataload(add(proof.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return false;

        address signer = ecrecover(ethSignedHash, v, r, s);
        return signer != address(0) && signer == oracleAddress;
    }
    
    /**
     * @dev Get all tranches for a startup
     * @param startupId Startup identifier
     * @return Array of tranches
     */
    function getStartupTranches(uint256 startupId) 
        external 
        view 
        returns (Tranche[] memory) 
    {
        return startupTranches[startupId];
    }
    
    /**
     * @dev Get total locked amount for a startup
     * @param startupId Startup identifier
     * @return Total amount in escrow (unreleased)
     */
    function getLockedAmount(uint256 startupId) external view returns (uint256) {
        Tranche[] storage tranches = startupTranches[startupId];
        uint256 locked = 0;
        
        for (uint256 i = 0; i < tranches.length; i++) {
            if (!tranches[i].released) {
                locked += tranches[i].amount;
            }
        }
        
        return locked;
    }
    
    // ==================== ERC20 Overrides (Compliance Enforcement) ====================
    
    /**
     * @dev Override transfer to enforce compliance checks
     */
    function transfer(address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        returns (bool) 
    {
        if (!canTransfer(_msgSender(), to, amount)) {
            revert TransferNotCompliant(_msgSender(), to);
        }
        return super.transfer(to, amount);
    }
    
    /**
     * @dev Override transferFrom to enforce compliance checks
     */
    function transferFrom(address from, address to, uint256 amount)
        public
        override
        whenNotPaused
        returns (bool)
    {
        if (!canTransfer(from, to, amount)) {
            revert TransferNotCompliant(from, to);
        }
        return super.transferFrom(from, to, amount);
    }
    
    // ==================== Token Issuance ====================
    
    /**
     * @dev Mint new tokens to an investor (only accredited)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) 
        external 
        onlyOwner 
        whenNotPaused 
    {
        if (!isIdentityVerified(to)) {
            revert NotIdentityVerified(to);
        }
        if (!accreditedInvestors[to]) {
            revert NotAccredited(to);
        }
        if (balanceOf(to) + amount > maxHoldingPerAddress) {
            revert ExceedsMaxHolding(to, amount);
        }
        if (balanceOf(to) == 0 && amount < minInvestmentAmount) {
            revert BelowMinInvestment(amount);
        }
        
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens from an address
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        _burn(_msgSender(), amount);
    }
    
    // ==================== Administrative Functions ====================
    
    /**
     * @dev Update maximum holding per address
     * @param _maxHolding New maximum holding amount
     */
    function setMaxHolding(uint256 _maxHolding) external onlyOwner {
        require(_maxHolding > 0, "Max holding must be positive");
        maxHoldingPerAddress = _maxHolding;
    }
    
    /**
     * @dev Update minimum investment amount
     * @param _minInvestment New minimum investment
     */
    function setMinInvestment(uint256 _minInvestment) external onlyOwner {
        minInvestmentAmount = _minInvestment;
    }
    
    /**
     * @dev Pause all token transfers (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Recover accidentally sent ERC20 tokens
     * @param token Address of the token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverERC20(address token, address to, uint256 amount) 
        external 
        onlyOwner 
    {
        require(token != address(this), "Cannot recover native token");
        IERC20(token).transfer(to, amount);
    }
}

// ==================== Interfaces ====================

/**
 * @dev Interface for T-REX Identity Registry
 */
interface IIdentityRegistry {
    /**
     * @dev Check if an address has a verified identity
     */
    function isVerified(address account) external view returns (bool);
    
    /**
     * @dev Get the identity contract for an address
     */
    function identity(address account) external view returns (address);
}

/**
 * @dev Interface for T-REX Compliance Module — matches ComplianceRules.canTransfer()
 *
 * ComplianceRules.canTransfer() takes an extra `startupToken` address (the ERC-3643
 * token contract being transferred) and returns (bool allowed, string reason).
 * The ICompliance interface here mirrors that exact signature.
 */
interface ICompliance {
    /**
     * @dev Check if a transfer is compliant with all regulatory rules.
     * @param from         Sender address
     * @param to           Receiver address
     * @param amount       Token amount (in wei)
     * @param startupToken Address of the IntelliStake token contract (pass address(this))
     * @return allowed     True if all compliance checks pass
     * @return reason      Human-readable rejection reason (empty string if allowed)
     */
    function canTransfer(
        address from,
        address to,
        uint256 amount,
        address startupToken
    ) external view returns (bool allowed, string memory reason);
}
