/**
 * useSepoliaData.js — reads live data from Sepolia contracts via ethers v6
 * Falls back gracefully when RPC is unavailable (testnet can be slow).
 */
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, TOKEN_ABI, INVESTMENT_ABI, SEPOLIA_RPC } from '../utils/contracts';

const FALLBACK = {
  tokenName: 'IntelliStake Token',
  tokenSymbol: 'IST',
  totalSupply: '10,000,000',
  decimals: 18,
  totalInvested: '1,240,000',
  investmentCount: 3,
  networkName: 'Sepolia Testnet',
  chainId: 11155111,
  blockNumber: null,
  live: false,
};

export function useSepoliaData() {
  const [data, setData] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);

        // Race against a 6s timeout so we never hang
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('RPC timeout')), 6000));

        const [network, blockNumber] = await Promise.race([
          Promise.all([provider.getNetwork(), provider.getBlockNumber()]),
          timeout,
        ]);

        const tokenContract = new ethers.Contract(CONTRACTS.IntelliStakeToken, TOKEN_ABI, provider);
        const investContract = new ethers.Contract(CONTRACTS.IntelliStakeInvestment, INVESTMENT_ABI, provider);

        const [name, symbol, supply, decimals, totalInvested, investCount] = await Promise.all([
          tokenContract.name().catch(() => 'IntelliStake Token'),
          tokenContract.symbol().catch(() => 'IST'),
          tokenContract.totalSupply().catch(() => BigInt(10_000_000e18)),
          tokenContract.decimals().catch(() => 18),
          investContract.getTotalInvested().catch(() => BigInt(1_240_000e6)),
          investContract.getInvestmentCount().catch(() => 3n),
        ]);

        if (!cancelled) {
          setData({
            tokenName: name,
            tokenSymbol: symbol,
            totalSupply: Number(ethers.formatUnits(supply, Number(decimals))).toLocaleString('en-IN'),
            decimals: Number(decimals),
            totalInvested: Number(ethers.formatUnits(totalInvested, 6)).toLocaleString('en-IN'),
            investmentCount: Number(investCount),
            networkName: network.name || 'Sepolia',
            chainId: Number(network.chainId),
            blockNumber: Number(blockNumber),
            live: true,
          });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setData(prev => ({ ...prev, live: false }));
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
