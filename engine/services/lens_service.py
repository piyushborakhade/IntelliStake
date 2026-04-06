"""
engine/services/lens_service.py
================================
Translates raw ML/finance data into user-facing language.
Mirror of frontend lensTranslator.js for server-side rendering.

Usage:
    from engine.services.lens_service import translate_startup, translate_trust_score
"""

from __future__ import annotations

# ── Trust Score Bands ─────────────────────────────────────────────────────────
TRUST_BANDS = [
    {'min': 0.80, 'max': 1.01, 'label': '🟢 Top Performer',        'color': '#10b981'},
    {'min': 0.60, 'max': 0.80, 'label': '🟢 Strong Performer',     'color': '#34d399'},
    {'min': 0.45, 'max': 0.60, 'label': '🟡 Moderate Risk',        'color': '#f59e0b'},
    {'min': 0.35, 'max': 0.45, 'label': '🟠 High Risk',            'color': '#f97316'},
    {'min': 0.00, 'max': 0.35, 'label': '🔴 Deal Frozen',          'color': '#ef4444'},
]

STAGE_MAP = {
    'Pre-Seed': 'Very Early — Idea Stage',
    'Seed':     'Early — Product Being Built',
    'Series A': 'Growing — Product-Market Fit Found',
    'Series B': 'Established — Already Proven at Scale',
    'Series C': 'Scaling — Going for Market Dominance',
    'Series D': 'Leading — Expanding Nationally',
    'Series E': 'Dominant — Pre-IPO Territory',
    'Pre-IPO':  'Pre-IPO — Highest Growth, Nearest Exit',
}

def translate_trust_score(score: float) -> dict:
    """Return human-readable band for a raw trust score."""
    for band in TRUST_BANDS:
        if band['min'] <= score < band['max']:
            return {**band, 'raw': score, 'percentage': round(score * 100)}
    return TRUST_BANDS[-1] | {'raw': score, 'percentage': 0}


def format_inr(usd: float) -> str:
    """Convert USD to INR shorthand (₹Cr / ₹L)."""
    inr = usd * 83.5
    if inr >= 10_000_000:
        return f'₹{inr / 10_000_000:.1f}Cr'
    if inr >= 100_000:
        return f'₹{inr / 100_000:.1f}L'
    return f'₹{round(inr):,}'


def translate_sentiment(score: float, signals: int, mode: str) -> str:
    if mode == 'admin':
        return f'VADER: {score:.2f} · {signals} signals'
    if score >= 0.6:   return 'The market is very positive about this company'
    if score >= 0.3:   return 'The market is talking positively about this company'
    if score >= -0.1:  return 'Neutral market coverage — no strong signals'
    if score >= -0.4:  return 'Some negative press — worth monitoring'
    return 'Significant negative market sentiment detected'


def translate_sharpe(sharpe: float, mode: str) -> str:
    if mode == 'admin':
        return f'Sharpe: {sharpe:.4f}'
    if sharpe >= 2.0:  return 'Exceptional returns for the risk taken'
    if sharpe >= 1.5:  return 'Very good returns for the risk taken'
    if sharpe >= 1.0:  return 'Good returns for the risk taken'
    if sharpe >= 0.5:  return 'Acceptable returns for the risk taken'
    return 'Risk may outweigh the expected returns'


def translate_startup(startup: dict, mode: str) -> dict:
    """
    Translates a raw startup dict into a user-friendly version.
    In admin mode, returns the original dict unchanged.
    """
    if mode == 'admin':
        return startup

    data = dict(startup)       # shallow copy
    trust_score = startup.get('trust_score', 0)
    trust_band  = translate_trust_score(trust_score)

    data['trust_display']    = trust_band
    data['stage_display']    = STAGE_MAP.get(startup.get('funding_stage', ''), startup.get('funding_stage', ''))
    data['revenue_display']  = format_inr(startup.get('estimated_revenue_usd', 0))
    data['sentiment_display']= translate_sentiment(
        startup.get('sentiment_compound', 0),
        startup.get('sentiment_count', 0),
        mode,
    )
    return data


def translate_portfolio(portfolio: dict, mode: str) -> dict:
    """Translates portfolio BL output for the user lens."""
    if mode == 'admin':
        return portfolio

    sharpe = portfolio.get('sharpe_ratio', 0)
    var95  = portfolio.get('var_95', 0)

    return {
        **portfolio,
        'sharpe_display': translate_sharpe(sharpe, mode),
        'var_display': f'In a bad year, you might lose up to {abs(var95):.0f}%',
        'risk_label': (
            'Low Risk' if sharpe >= 1.5 else
            'Moderate Risk' if sharpe >= 0.8 else
            'Higher Risk'
        ),
    }
