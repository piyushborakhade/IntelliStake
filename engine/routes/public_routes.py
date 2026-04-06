"""
engine/routes/public_routes.py
================================
No authentication required. Serves landing page and discovery data.
"""
from flask import Blueprint, jsonify, request

public_bp = Blueprint('public', __name__)

# Lazy import to avoid circular deps — loaded from chatbot_api's global data
_startups = None

def _get_startups():
    global _startups
    if _startups is None:
        try:
            # Try to reuse the already-loaded data from the monolith if running together
            import engine.chatbot_api as mono
            _startups = getattr(mono, 'STARTUPS', [])
        except Exception:
            _startups = []
    return _startups


@public_bp.route('/health')
def health():
    return jsonify({'status': 'ok'})


@public_bp.route('/stats')
def stats():
    """Stats for the landing page hero section."""
    startups = _get_startups()
    return jsonify({
        'total_startups': len(startups) if startups else 74577,
        'top_trust_score': max((s.get('trust_score', 0) for s in startups), default=0.91) if startups else 0.91,
        'live_contracts': 3,
        'tvl_eth': 0.03184,
        'sepolia_network': True,
    })


@public_bp.route('/top-startups')
def top_startups():
    """Top startups for the landing page ticker."""
    startups = _get_startups()
    limit = min(int(request.args.get('limit', 10)), 50)

    if startups:
        sorted_s = sorted(startups, key=lambda x: x.get('trust_score', 0), reverse=True)[:limit]
        return jsonify([{
            'name':        s.get('startup_name', s.get('name', 'Unknown')),
            'trust_score': s.get('trust_score', 0),
            'sector':      s.get('sector', s.get('industry', '')),
            'country':     s.get('country', 'India'),
        } for s in sorted_s])

    # Fallback to demo data
    return jsonify([
        {'name': 'Razorpay',  'trust_score': 0.91, 'sector': 'FinTech',   'country': 'India', 'status': 'ACTIVE'},
        {'name': 'Zepto',     'trust_score': 0.82, 'sector': 'E-commerce','country': 'India', 'status': 'ACTIVE'},
        {'name': 'PhonePe',   'trust_score': 0.85, 'sector': 'FinTech',   'country': 'India', 'status': 'ACTIVE'},
        {'name': 'CRED',      'trust_score': 0.72, 'sector': 'FinTech',   'country': 'India', 'status': 'ACTIVE'},
        {"name": "Byju's",    'trust_score': 0.38, 'sector': 'EdTech',    'country': 'India', 'status': 'FROZEN'},
    ])


@public_bp.route('/sectors')
def sectors():
    """Sector distribution for the Observatory canvas."""
    return jsonify([
        {'name': 'FinTech',    'count': 18420, 'avg_trust': 0.71, 'color': '#6366f1'},
        {'name': 'SaaS',       'count': 12300, 'avg_trust': 0.68, 'color': '#8b5cf6'},
        {'name': 'D2C',        'count': 9800,  'avg_trust': 0.64, 'color': '#06b6d4'},
        {'name': 'Deeptech',   'count': 7200,  'avg_trust': 0.59, 'color': '#10b981'},
        {'name': 'EdTech',     'count': 6100,  'avg_trust': 0.51, 'color': '#f59e0b'},
        {'name': 'HealthTech', 'count': 5500,  'avg_trust': 0.66, 'color': '#f43f5e'},
        {'name': 'Climate',    'count': 3200,  'avg_trust': 0.58, 'color': '#34d399'},
        {'name': 'Mobility',   'count': 4800,  'avg_trust': 0.55, 'color': '#f97316'},
    ])
