"""Investment & Portfolio Routes"""
from flask import Blueprint, request, jsonify
from ..services.portfolio_service import PortfolioService
from ..services.simulation_service import SimulationService

bp = Blueprint('investment', __name__, url_prefix='/api/investment')
portfolio_service = PortfolioService()
simulation_service = SimulationService()

@bp.route('/simulate', methods=['POST'])
def simulate_investment():
    """Run Black-Litterman optimization and Monte Carlo simulation"""
    try:
        data = request.get_json()
        amount = float(data.get('amount_inr', 100000))
        
        result = simulation_service.run_simulation(amount)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/memo', methods=['POST'])
def generate_memo():
    """Generate AI investment memo for a startup"""
    try:
        data = request.get_json()
        startup_name = data.get('startup_name', 'Unknown')
        
        memo = portfolio_service.generate_investment_memo(startup_name, data)
        return jsonify({'memo': memo})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
