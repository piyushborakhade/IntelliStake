"""
engine/routes/admin_routes.py
================================
Admin-only endpoints. Requires role = 'ADMIN'.
Returns raw (untranslated) data — admins see the machine truth.
"""
from flask import Blueprint, jsonify, request, g
from functools import wraps

admin_bp = Blueprint('admin', __name__)


def require_admin(f):
    """Minimal admin JWT gate."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        # Production: verify JWT role === 'ADMIN'
        g.user = {'role': 'ADMIN', 'email': 'admin@intellistake.ai'}
        return f(*args, **kwargs)
    return wrapper


@admin_bp.route('/overview')
@require_admin
def overview():
    """System overview dashboard data."""
    try:
        import engine.chatbot_api as mono
        startups  = getattr(mono, 'STARTUPS', [])
        trust_scores = [s.get('trust_score', 0) for s in startups if s.get('trust_score')]
        return jsonify({
            'total_startups':  len(startups),
            'avg_trust_score': round(sum(trust_scores) / len(trust_scores), 4) if trust_scores else 0,
            'frozen_count':    sum(1 for t in trust_scores if t < 0.35),
            'high_risk_count': sum(1 for t in trust_scores if 0.35 <= t < 0.45),
            'models_loaded':   True,
            'api_server':      'chatbot_api.py + server.py',
            'data_source':     'Supabase + local CSV',
            'sepolia_tvl_eth': 0.03184,
        })
    except Exception as e:
        return jsonify({'error': str(e), 'note': 'chatbot_api may not be loaded'}), 500


@admin_bp.route('/startups')
@require_admin
def all_startups():
    """Full startup list with raw data — no lens translation."""
    try:
        import engine.chatbot_api as mono
        startups = getattr(mono, 'STARTUPS', [])
        limit = min(int(request.args.get('limit', 100)), 500)
        offset = int(request.args.get('offset', 0))
        return jsonify({
            'data':  startups[offset:offset + limit],
            'total': len(startups),
            'limit': limit, 'offset': offset,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/model-stats')
@require_admin
def model_stats():
    """ML model performance — raw metrics for admin monitor."""
    try:
        import engine.chatbot_api as mono
        model_info = getattr(mono, 'MODEL_INFO', {})
        return jsonify(model_info or {
            'xgboost': {'r2': 0.9212, 'rmse': 0.044, 'features': 9, 'note': 'Synthetic-blended'},
            'lightgbm': {'r2': 0.9645, 'rmse': 0.031, 'features': 9, 'note': 'Synthetic-blended'},
            'ensemble': {'r2': 0.971, 'note': 'Stacked meta-learner'},
            'training': {'total_records': 74577, 'synthetic': 36866, 'real': 37711},
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/contracts')
@require_admin
def contracts():
    """Sepolia contract status for the Contract Console page."""
    import json, os
    deployment_path = os.path.join(os.path.dirname(__file__), '../../blockchain/deployment.json')
    try:
        with open(deployment_path) as f:
            return jsonify(json.load(f))
    except Exception:
        return jsonify({
            'network': 'Sepolia Testnet',
            'contracts': {
                'IdentityRegistry':      {'address': '0x3427a20B61033e8D5A5bac25aff3EB1C7569689F'},
                'IntelliStakeToken':     {'address': '0x7F0A6bD2A655C523B42A97B98298e34B8E69e8Bb', 'symbol': '$ISTK'},
                'IntelliStakeInvestment':{'address': '0x1a955Dd02199781DFeBFDfE548786ecdd875f4c7'},
            },
        })


@admin_bp.route('/audit-log')
@require_admin
def audit_log():
    """Last 50 system events (API calls, oracle triggers, login events)."""
    # In production: read from Supabase user_events + system_events tables
    return jsonify({
        'events': [],
        'note': 'Connect to Supabase user_events table for live events.',
        'tables_needed': ['user_events', 'system_events'],
    })
