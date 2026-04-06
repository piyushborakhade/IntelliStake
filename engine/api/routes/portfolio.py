"""Portfolio & Dashboard Routes"""
from flask import Blueprint, jsonify
from ..services.portfolio_service import PortfolioService

bp = Blueprint('portfolio', __name__, url_prefix='/api/portfolio')
portfolio_service = PortfolioService()

@bp.route('/data', methods=['GET'])
def get_portfolio_data():
    """Get portfolio overview data"""
    try:
        data = portfolio_service.get_portfolio_overview()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
