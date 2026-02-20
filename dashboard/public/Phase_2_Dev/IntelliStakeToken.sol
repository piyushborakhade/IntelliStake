// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
    event TrancheLocked(uint256 indexed startupId, uint256 amount, bytes32 milestoneHash);
    event TrancheReleased(uint256 indexed startupId, uint256 trancheIndex, uint256 amount);
    event MilestoneVerified(bytes32 indexed milestoneHash, uint256 timestamp);
    event AccreditationUpdated(address indexed investor, bool status);
    event TransferRejected(address indexed from, address indexed to, uint256 amount, string reason);
    
    // ==================== Errors ====================
    
    error NotIdentityVerified(address account);
    error NotAccredited(address account);
    error ExceedsMaxHolding(address account, uint256 amount);
    error BelowMinInvestment(uint256 amount);
    error TrancheAlreadyReleased(uint256 startupId, uint256 trancheIndex);
    error MilestoneNotVerified(bytes32 milestoneHash);
    error InvalidMilestoneProof();
    error TransferNotCompliant(address from, address to);
    
    // ==================== Constructor ====================
    
    /**
     * @dev Initialize IntelliStake security token
     * @param _initialOwner Address of the contract owner
     */
    constructor(address _initialOwner) 
        ERC20("IntelliStake Security Token", "ISTK")
        Ownable(_initialOwner)
    {
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
        
        // Check 5: External compliance module (if set)
        if (address(compliance) != address(0)) {
            return compliance.canTransfer(from, to, amount);
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
     * @dev Verify milestone completion using oracle proof
     * @param milestoneHash Hash of the milestone
     * @param proof Cryptographic proof from Chainlink oracle
     * @return True if milestone is verified
     * 
     * @notice In production, this would verify a signature from the oracle.
     * For capstone demonstration, we accept any non-empty proof.
     */
    function verifyMilestone(
        bytes32 milestoneHash,
        bytes calldata proof
    ) internal pure returns (bool) {
        // Production implementation would:
        // 1. Extract oracle signature from proof
        // 2. Verify signature against trusted oracle public key
        // 3. Decode milestone status from signed data
        // 4. Check timestamp freshness
        
        // Simplified for demonstration
        return proof.length > 0 && milestoneHash != bytes32(0);
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
 * @dev Interface for T-REX Compliance Module
 */
interface ICompliance {
    /**
     * @dev Check if a transfer is compliant
     */
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view returns (bool);
}
