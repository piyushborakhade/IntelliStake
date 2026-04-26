/**
 * contracts.js — Sepolia contract addresses + minimal ABIs
 * All contracts are deployed on Sepolia testnet.
 */

export const CONTRACTS = {
  IdentityRegistry:        '0x3427a20B61033e8D5A5bac25aff3EB1C7569689F',
  IntelliStakeToken:       '0x7F0A6bD2A655C523B42A97B98298e34B8E69e8Bb',
  IntelliStakeInvestment:  '0x1a955Dd02199781DFeBFDfE548786ecdd875f4c7',
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
