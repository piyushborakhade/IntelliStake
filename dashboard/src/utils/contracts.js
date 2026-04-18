/**
 * contracts.js — Sepolia contract addresses + minimal ABIs
 * All contracts are deployed on Sepolia testnet.
 */

export const CONTRACTS = {
  IdentityRegistry:        '0x3427daC36B47A1a1DC1a77F9A15D1d1dae49689F',
  IntelliStakeToken:       '0x7F0ADbC1Ee87Bda71A55DAD23E6B2FAbf3578Bb',
  IntelliStakeInvestment:  '0x1a95A8E33E0B5B93e5d45EB3A4DB53AfC4904c7',
};

// ERC-20 minimal ABI for IST token reads
export const TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// Investment contract ABI (subset used for dashboard reads)
export const INVESTMENT_ABI = [
  'function getTotalInvested() view returns (uint256)',
  'function getInvestmentCount() view returns (uint256)',
  'function getInvestment(uint256 id) view returns (address investor, address startup, uint256 amount, uint256 timestamp, bool active)',
  'event InvestmentMade(address indexed investor, address indexed startup, uint256 amount, uint256 timestamp)',
];

// Sepolia public RPC (no key needed for reads)
export const SEPOLIA_RPC = 'https://rpc.sepolia.org';
