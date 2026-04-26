/**
 * useInvestorDNA.js
 * Custom hook — loads investor DNA from sessionStorage (instant) then
 * hydrates from Supabase (async). Provides a consistent dna object
 * across Home.jsx, RiskAssessment.jsx, and the transaction modal.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchInvestorDNA } from './supabase';

// ── Derived helpers ────────────────────────────────────────────────────────────

const AMOUNT_LABELS = {
  under_10k: '₹10K–50K', '50k_2l': '₹50K–2L',
  '2l_10l': '₹2L–10L', '10l_50l': '₹10L–50L', '50l_plus': '₹50L+',
};
const AMOUNT_MAX = {
  under_10k: 50000, '50k_2l': 200000,
  '2l_10l': 1000000, '10l_50l': 5000000, '50l_plus': 20000000,
};
const BL_TAU = { conservative: 0.025, balanced: 0.05, aggressive: 0.10 };
const VAR_CONF = { conservative: 99, balanced: 95, aggressive: 90 };
const MAX_WEIGHT = { conservative: 0.15, balanced: 0.20, aggressive: 0.30 };

/**
 * Derive structured risk archetype from raw DNA answers.
 * Returns an enriched object with model parameters.
 */
export function deriveDNA(raw) {
  if (!raw) return null;

  const riskAppetite = raw.riskAppetite ||
    (raw.dropResponse === 'buy_more' ? 'aggressive' :
     raw.dropResponse === 'hold'     ? 'balanced'   : 'conservative');

  const archetype =
    riskAppetite === 'aggressive' ? 'Growth Investor' :
    riskAppetite === 'balanced'   ? 'Balanced Investor' : 'Conservative Investor';

  const archetypeColor =
    riskAppetite === 'aggressive' ? '#10b981' :
    riskAppetite === 'balanced'   ? '#f59e0b' : '#3b82f6';

  // Behavioural traits derived from answers
  const traits = [];
  if (raw.dropResponse === 'buy_more') traits.push({ icon: '📈', text: 'You buy dips — contrarian, high conviction' });
  if (raw.dropResponse === 'hold')     traits.push({ icon: '🧘', text: 'You hold through volatility — patient investor' });
  if (raw.dropResponse === 'sell_some') traits.push({ icon: '⚖️', text: 'You partially exit to manage risk exposure' });
  if (raw.dropResponse === 'sell_all') traits.push({ icon: '🛡️', text: 'Capital preservation is your top priority' });

  if (raw.angelExp === 'veteran') traits.push({ icon: '🦅', text: 'Seasoned angel with 10+ investments' });
  if (raw.angelExp === 'active')  traits.push({ icon: '🎯', text: 'Active angel building conviction' });
  if (raw.angelExp === 'none')    traits.push({ icon: '🌱', text: 'First-time startup investor — learning the ropes' });

  if (raw.handsOnLevel === 'passive') traits.push({ icon: '🤖', text: 'Autopilot preferred — AI drives decisions' });
  if (raw.handsOnLevel === 'active')  traits.push({ icon: '🔬', text: 'Hands-on — deep involvement in every deal' });

  if (raw.motivation === 'returns')   traits.push({ icon: '💰', text: 'IRR and multiples are your north star' });
  if (raw.motivation === 'impact')    traits.push({ icon: '🌍', text: 'Backing ideas that change the world' });

  if (raw.geoDiversity === 'india_only') traits.push({ icon: '🇮🇳', text: 'India-focused — deep domestic conviction' });
  if (raw.geoDiversity === 'global')     traits.push({ icon: '🌐', text: 'Global diversification across markets' });

  // BL + VaR params
  const blTau     = BL_TAU[riskAppetite]    || 0.05;
  const varConf   = VAR_CONF[riskAppetite]  || 95;
  const maxWeight = MAX_WEIGHT[riskAppetite] || 0.20;
  const capitalMax = AMOUNT_MAX[raw.investAmount] || 1000000;
  const perStartupMax = Math.round(capitalMax * maxWeight);

  return {
    ...raw,
    riskAppetite,
    archetype,
    archetypeColor,
    traits,
    blTau,
    varConf,
    maxWeight,
    capitalMax,
    perStartupMax,
    capitalLabel: AMOUNT_LABELS[raw.investAmount] || raw.investAmount || '₹10L–50L',
    preferredSectors: Array.isArray(raw.sectors) && raw.sectors.length > 0 ? raw.sectors : null,
    avoidSectors: Array.isArray(raw.sectorsToAvoid) && raw.sectorsToAvoid.length > 0 ? raw.sectorsToAvoid : [],
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInvestorDNA() {
  const { user } = useAuth();
  const [dna, setDna] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    // 1. Try sessionStorage first (instant)
    try {
      const cached = sessionStorage.getItem('is_investor_dna');
      if (cached) {
        setDna(deriveDNA(JSON.parse(cached)));
        setLoading(false);
        // Still fetch from Supabase in background to get latest
      }
    } catch (_) {}

    // 2. Fetch from Supabase (authoritative)
    if (user?.email) {
      const remote = await fetchInvestorDNA(user.email);
      if (remote) {
        sessionStorage.setItem('is_investor_dna', JSON.stringify(remote));
        setDna(deriveDNA(remote));
      }
    }

    setLoading(false);
  }, [user?.email]);

  useEffect(() => { load(); }, [load]);

  const refresh = () => load();

  return { dna, loading, refresh };
}
