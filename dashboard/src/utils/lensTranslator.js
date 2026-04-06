/**
 * lensTranslator.js — IntelliStake Lens System
 * =============================================
 * Converts every raw ML/finance metric into human-readable language.
 * Every component that renders data should pass it through here.
 *
 * Usage:
 *   import { translateTrustScore, translateMetric } from '../utils/lensTranslator'
 *   const display = mode === 'user' ? translateTrustScore(0.73).label : '0.73'
 */

// ── Trust Score ───────────────────────────────────────────────────────────────
export const TRUST_BANDS = [
  { min: 0.80, max: 1.01, label: '🟢 Top Performer',          color: '#10b981', bg: 'rgba(16,185,129,0.12)', desc: 'This startup consistently scores in the top tier across all our signals.' },
  { min: 0.60, max: 0.80, label: '🟢 Strong Performer',       color: '#34d399', bg: 'rgba(52,211,153,0.10)', desc: 'Solid across most metrics with positive momentum.' },
  { min: 0.45, max: 0.60, label: '🟡 Moderate Risk',          color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', desc: 'Shows promise but carries some risk. Worth monitoring.' },
  { min: 0.35, max: 0.45, label: '🟠 High Risk',              color: '#f97316', bg: 'rgba(249,115,22,0.12)', desc: 'Significant risk signals present. Invest with caution.' },
  { min: 0.00, max: 0.35, label: '🔴 Deal Frozen',            color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  desc: 'Our compliance system has paused activity on this startup.' },
];

export function translateTrustScore(score) {
  const band = TRUST_BANDS.find(b => score >= b.min && score < b.max) || TRUST_BANDS[TRUST_BANDS.length - 1];
  return { ...band, raw: score, percentage: Math.round(score * 100) };
}

// ── Funding Stages ────────────────────────────────────────────────────────────
const STAGE_MAP = {
  'Pre-Seed':  { user: 'Very Early — Idea Stage',             color: '#8b5cf6' },
  'Seed':      { user: 'Early — Product Being Built',         color: '#6366f1' },
  'Series A':  { user: 'Growing — Product-Market Fit Found',  color: '#3b82f6' },
  'Series B':  { user: 'Established — Already Proven at Scale', color: '#06b6d4' },
  'Series C':  { user: 'Scaling — Going for Market Dominance', color: '#10b981' },
  'Series D':  { user: 'Leading — Expanding Nationally',      color: '#10b981' },
  'Series E':  { user: 'Dominant — Pre-IPO Territory',        color: '#f59e0b' },
  'Pre-IPO':   { user: 'Pre-IPO — Highest Growth, Nearest Exit', color: '#f59e0b' },
};

export function translateStage(stage) {
  return STAGE_MAP[stage] || { user: stage, color: '#94a3b8' };
}

// ── Financial Metrics ─────────────────────────────────────────────────────────
export function translateSharpe(sharpe, mode) {
  if (mode === 'admin') return `Sharpe: ${sharpe.toFixed(4)}`;
  if (sharpe >= 2.0) return 'Exceptional returns for the risk taken';
  if (sharpe >= 1.5) return 'Very good returns for the risk taken';
  if (sharpe >= 1.0) return 'Good returns for the risk taken';
  if (sharpe >= 0.5) return 'Acceptable returns for the risk taken';
  return 'Risk may outweigh the expected returns';
}

export function translateR2(r2, mode) {
  if (mode === 'admin') return `R²=${r2.toFixed(4)} (synthetic-blended)`;
  if (r2 >= 0.95) return 'Predictions are highly reliable';
  if (r2 >= 0.85) return 'Predictions are quite reliable';
  if (r2 >= 0.70) return 'Predictions are reasonably reliable';
  return 'Predictions carry some uncertainty';
}

export function translateVaR(varPct, mode) {
  if (mode === 'admin') return `VaR(95)=${varPct.toFixed(1)}%`;
  return `In a bad year, you might lose up to ${varPct.toFixed(0)}%`;
}

export function translateSentiment(score, signalCount, mode) {
  if (mode === 'admin') return `VADER: ${score.toFixed(2)} · ${signalCount} signals`;
  if (score >= 0.6) return 'The market is very positive about this company';
  if (score >= 0.3) return 'The market is talking positively about this company';
  if (score >= -0.1) return 'Neutral market coverage — no strong signals';
  if (score >= -0.4) return 'Some negative press — worth monitoring';
  return 'Significant negative market sentiment detected';
}

export function translateMonteCarlo(p70, mode) {
  if (mode === 'admin') return `μ=0.224 · σ=0.18 · p70=${p70.toFixed(1)}x`;
  if (p70 >= 3.0) return `In most scenarios, this triples in value within 3 years`;
  if (p70 >= 2.0) return `70% chance of doubling your money in 3 years`;
  if (p70 >= 1.5) return `Expected to grow 50%+ in most market scenarios`;
  return `Projected modest growth — higher risk than typical`;
}

// ── Oracle / Contract Events ──────────────────────────────────────────────────
export function translateOracleAction(action, txHash, trustScore, mode) {
  if (mode === 'admin') return `TX: ${txHash?.slice(0,10)}… · trust=${trustScore?.toFixed(2)} · ${action}`;
  if (action === 'ORACLE_FREEZE' || action === 'freezeMilestoneFunding') {
    return '⚠️ This deal has been paused by our compliance system';
  }
  if (action === 'TRANCHE_RELEASED') return '✅ Milestone reached — funds released to startup';
  return action;
}

// ── INR Formatter ─────────────────────────────────────────────────────────────
export function formatINR(usd) {
  const inr = usd * 83.5; // rough INR conversion
  if (inr >= 10_000_000) return `₹${(inr / 10_000_000).toFixed(1)}Cr`;
  if (inr >= 100_000)    return `₹${(inr / 100_000).toFixed(1)}L`;
  return `₹${Math.round(inr).toLocaleString('en-IN')}`;
}

export function formatUSD(usd) {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000)     return `$${(usd / 1_000_000).toFixed(0)}M`;
  if (usd >= 1_000)         return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd}`;
}

// ── Full startup translation ───────────────────────────────────────────────────
export function translateStartup(startup, mode) {
  if (mode === 'admin') return startup;

  const trust = translateTrustScore(startup.trust_score || 0);
  const stage = translateStage(startup.funding_stage || '');

  return {
    ...startup,
    trust_display: trust,
    stage_display: stage.user,
    stage_color: stage.color,
    revenue_display: formatINR(startup.estimated_revenue_usd || 0),
    valuation_display: formatUSD((startup.estimated_valuation_usd || startup.estimated_revenue_usd || 0) * 10),
    sentiment_display: translateSentiment(startup.sentiment_compound || 0, startup.sentiment_count || 0, mode),
  };
}
