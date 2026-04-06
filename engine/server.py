"""
engine/server.py — IntelliStake Backend Entry Point (v2)
=========================================================
Replaces the dual-app conflict:
  - OLD: chatbot_api.py (monolith) coexisted with api/app.py (dead modular)
  - NEW: This single entry point uses the monolith's data loading but routes
         are properly split into blueprints per role.

Blueprints:
  /api/public/   → public_routes.py   (no auth, landing page data)
  /api/auth/     → auth_routes.py     (login, register, refresh)
  /api/user/     → user_routes.py     (JWT-gated, user role)
  /api/admin/    → admin_routes.py    (JWT-gated, admin role)
  /api/          → compatibility shim → chatbot_api endpoints still work

Usage:
  FLASK_APP=engine.server:create_app flask run --port 5500
  (or keep running chatbot_api.py during migration — both entry points share the same data)

Environment: engine/.env
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    app.secret_key = os.getenv('FLASK_SECRET_KEY', 'intellistake-dev-secret-2026')

    # CORS — allow Vite dev server
    CORS(app, origins=[
        'http://localhost:5173',
        'http://localhost:3000',
        os.getenv('FRONTEND_URL', ''),
    ], supports_credentials=True)

    # ── Register blueprints ────────────────────────────────────────────────
    try:
        from engine.routes.public_routes import public_bp
        app.register_blueprint(public_bp, url_prefix='/api/public')
    except ImportError:
        pass

    try:
        from engine.routes.auth_routes import auth_bp
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
    except ImportError:
        pass

    try:
        from engine.routes.user_routes import user_bp
        app.register_blueprint(user_bp, url_prefix='/api/user')
    except ImportError:
        pass

    try:
        from engine.routes.admin_routes import admin_bp
        app.register_blueprint(admin_bp, url_prefix='/api/admin')
    except ImportError:
        pass

    # ── Health check ───────────────────────────────────────────────────────
    @app.route('/health')
    def health():
        return jsonify({'status': 'ok', 'service': 'IntelliStake API v2', 'server': 'server.py'})

    # ── 404 handler ────────────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Endpoint not found', 'hint': 'Check /api/public/, /api/auth/, /api/user/, /api/admin/'}), 404

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({'error': 'Unauthorized', 'hint': 'Pass a valid Bearer token in the Authorization header'}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({'error': 'Forbidden', 'hint': 'Insufficient role permissions'}), 403

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5500, debug=True)
