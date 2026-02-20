"""
IntelliStake Finance Domain - Black-Litterman Portfolio Optimizer
==================================================================

Implements the Black-Litterman model to combine market equilibrium (CAPM) with 
AI-generated valuation views, producing optimal portfolio allocations for 
decentralized venture capital investments.

Author: IntelliStake Development Team
Course: MBA (Tech) Capstone - NMIMS
Date: February 2026
"""

import os
import numpy as np
import pandas as pd
from scipy.optimize import minimize
import warnings

warnings.filterwarnings('ignore')

# Financial Constants
RISK_FREE_RATE = 0.03  # 3% annual risk-free rate (US Treasury)
MARKET_RETURN = 0.10   # 10% expected market return (VC industry average)
TAU = 0.05             # Uncertainty in prior (standard BL parameter)
RISK_AVERSION = 2.5    # Investor risk aversion coefficient


class BlackLittermanOptimizer:
    """
    Black-Litterman portfolio optimization engine.
    
    Combines market equilibrium returns (CAPM prior) with subjective investor views
    (AI predictions) to generate posterior expected returns and optimal asset weights.
    """
    
    def __init__(self, valuations_df: pd.DataFrame, risk_free_rate: float = RISK_FREE_RATE,
                 market_return: float = MARKET_RETURN, tau: float = TAU,
                 risk_aversion: float = RISK_AVERSION):
        """
        Initialize Black-Litterman optimizer with AI valuation data.
        
        Parameters
        ----------
        valuations_df : pd.DataFrame
            AI valuation predictions with columns: startup_id, estimated_valuation_usd, 
            predicted_growth_rate, confidence_score
        risk_free_rate : float
            Risk-free rate (default: 3% annual)
        market_return : float
            Market return expectation (default: 10% VC industry average)
        tau : float
            Uncertainty in prior equilibrium (default: 0.05)
        risk_aversion : float
            Investor risk aversion parameter (default: 2.5)
        """
        self.df = valuations_df
        self.rf = risk_free_rate
        self.rm = market_return
        self.tau = tau
        self.delta = risk_aversion
        self.n_assets = len(valuations_df)
        
        print(f"\n{'='*80}")
        print(f"{'Black-Litterman Portfolio Optimizer':^80}")
        print(f"{'IntelliStake Finance Domain':^80}")
        print(f"{'='*80}\n")
        print(f"[INFO] Initialized optimizer with {self.n_assets} assets")
        print(f"[INFO] Risk-free rate: {self.rf*100:.2f}%")
        print(f"[INFO] Market return: {self.rm*100:.2f}%")
        print(f"[INFO] Tau (prior uncertainty): {self.tau}")
        print(f"[INFO] Risk aversion (δ): {self.delta}\n")
    
    def calculate_returns_covariance(self) -> np.ndarray:
        """
        Estimate covariance matrix of returns based on historical volatility.
        
        In practice, this would use historical return data. For this capstone,
        we simulate based on valuation volatility and industry correlations.
        
        Returns
        -------
        np.ndarray
            n x n covariance matrix of asset returns
        """
        print("[INFO] Calculating covariance matrix of returns...")
        
        # Simulate volatilities based on valuation ranges
        # Higher valuations typically have lower volatility (more mature)
        valuations = self.df['estimated_valuation_usd'].values
        
        # Volatility inversely proportional to valuation (scaled)
        base_vol = 0.40  # 40% annual volatility for small startups
        volatilities = base_vol * (valuations.min() / valuations) ** 0.3
        
        # Create correlation matrix with realistic structure
        # Startups in same industry tend to be correlated
        correlation = np.full((self.n_assets, self.n_assets), 0.2)  # Base correlation
        np.fill_diagonal(correlation, 1.0)  # Perfect self-correlation
        
        # Convert to covariance matrix: Σ = D * Corr * D
        # where D is diagonal matrix of standard deviations
        D = np.diag(volatilities)
        covariance = D @ correlation @ D
        
        print(f"[SUCCESS] Covariance matrix calculated ({self.n_assets}x{self.n_assets})")
        print(f"[INFO] Mean volatility: {volatilities.mean()*100:.2f}%")
        print(f"[INFO] Volatility range: {volatilities.min()*100:.2f}% - {volatilities.max()*100:.2f}%\n")
        
        return covariance
    
    def calculate_market_equilibrium(self, covariance: np.ndarray) -> np.ndarray:
        """
        Calculate market-implied equilibrium returns (CAPM prior).
        
        Using reverse optimization: Π = δ * Σ * w_mkt
        where w_mkt is the market cap weighted portfolio.
        
        Parameters
        ----------
        covariance : np.ndarray
            Covariance matrix of returns
        
        Returns
        -------
        np.ndarray
            Implied equilibrium returns (Π)
        """
        print("[INFO] Calculating market equilibrium returns (CAPM prior)...")
        
        # Market cap weights (proportional to valuation)
        valuations = self.df['estimated_valuation_usd'].values
        market_weights = valuations / valuations.sum()
        
        # Implied equilibrium returns: Π = δ * Σ * w_mkt
        equilibrium_returns = self.delta * (covariance @ market_weights)
        
        print(f"[SUCCESS] Market equilibrium calculated")
        print(f"[INFO] Mean equilibrium return: {equilibrium_returns.mean()*100:.2f}%")
        print(f"[INFO] Return range: {equilibrium_returns.min()*100:.2f}% - {equilibrium_returns.max()*100:.2f}%\n")
        
        return equilibrium_returns
    
    def construct_views(self) -> tuple:
        """
        Construct investor views (Q) and view uncertainty (Ω) from AI predictions.
        
        AI-predicted growth rates become absolute return views.
        Confidence scores determine view precision (inverse of uncertainty).
        
        Returns
        -------
        tuple
            (P, Q, Omega) where:
            - P: k x n view matrix (which assets each view references)
            - Q: k x 1 view returns vector
            - Omega: k x k diagonal matrix of view uncertainties
        """
        print("[INFO] Constructing investor views from AI predictions...")
        
        k = self.n_assets  # Each startup gets one absolute view
        n = self.n_assets
        
        # P matrix: Identity (each view is about one specific asset)
        P = np.eye(k, n)
        
        # Q vector: AI-predicted returns
        # Assuming predicted_growth_rate is the expected annual return
        if 'predicted_growth_rate' in self.df.columns:
            Q = self.df['predicted_growth_rate'].values
        else:
            # If not available, infer from valuation relative to median
            median_val = self.df['estimated_valuation_usd'].median()
            relative_val = self.df['estimated_valuation_usd'] / median_val
            Q = self.rm + 0.05 * (relative_val - 1)  # Scale around market return
        
        # Omega: View uncertainty matrix (diagonal)
        # Higher confidence → lower uncertainty
        if 'confidence_score' in self.df.columns:
            confidence = self.df['confidence_score'].values
        else:
            # Use R² from ML model as proxy for confidence
            confidence = np.full(k, 0.88)  # Our model's R²
        
        # Uncertainty inversely proportional to confidence
        # Scaled by tau for consistency with BL framework
        view_variances = (1 / confidence) * self.tau * 0.5
        Omega = np.diag(view_variances)
        
        print(f"[SUCCESS] Constructed {k} investor views")
        print(f"[INFO] View returns (Q): mean={Q.mean()*100:.2f}%, std={Q.std()*100:.2f}%")
        print(f"[INFO] View uncertainty (Ω): mean diagonal={np.diag(Omega).mean():.4f}\n")
        
        return P, Q, Omega
    
    def calculate_posterior_returns(self, equilibrium: np.ndarray, covariance: np.ndarray,
                                   P: np.ndarray, Q: np.ndarray, Omega: np.ndarray) -> np.ndarray:
        """
        Calculate Black-Litterman posterior expected returns.
        
        Formula: E[R] = [(τΣ)^-1 + P'Ω^-1 P]^-1 [(τΣ)^-1 Π + P'Ω^-1 Q]
        
        This combines the market equilibrium (prior) with investor views using
        Bayesian updating, weighted by their respective uncertainties.
        
        Parameters
        ----------
        equilibrium : np.ndarray
            Market equilibrium returns (Π)
        covariance : np.ndarray
            Covariance matrix (Σ)
        P : np.ndarray
            View matrix
        Q : np.ndarray
            View returns
        Omega : np.ndarray
            View uncertainty matrix
        
        Returns
        -------
        np.ndarray
            Posterior expected returns
        """
        print("[INFO] Calculating Black-Litterman posterior returns...")
        
        # Precision of prior: (τΣ)^-1
        tau_sigma = self.tau * covariance
        tau_sigma_inv = np.linalg.inv(tau_sigma)
        
        # Precision of views: Ω^-1
        omega_inv = np.linalg.inv(Omega)
        
        # Combined precision: (τΣ)^-1 + P'Ω^-1 P
        combined_precision = tau_sigma_inv + P.T @ omega_inv @ P
        
        # Combined expected returns: (τΣ)^-1 Π + P'Ω^-1 Q
        combined_returns = tau_sigma_inv @ equilibrium + P.T @ omega_inv @ Q
        
        # Posterior: [(τΣ)^-1 + P'Ω^-1 P]^-1 [(τΣ)^-1 Π + P'Ω^-1 Q]
        posterior_returns = np.linalg.inv(combined_precision) @ combined_returns
        
        print(f"[SUCCESS] Posterior returns calculated")
        print(f"[INFO] Mean posterior return: {posterior_returns.mean()*100:.2f}%")
        print(f"[INFO] Impact of views: {(posterior_returns - equilibrium).mean()*100:+.2f}% shift\n")
        
        return posterior_returns
    
    def optimize_portfolio(self, expected_returns: np.ndarray, 
                          covariance: np.ndarray) -> np.ndarray:
        """
        Optimize portfolio weights using mean-variance optimization.
        
        Maximize: w'μ - (δ/2)w'Σw
        Subject to: Σw = 1, w ≥ 0 (long-only constraint)
        
        Parameters
        ----------
        expected_returns : np.ndarray
            Expected returns (from BL posterior)
        covariance : np.ndarray
            Covariance matrix
        
        Returns
        -------
        np.ndarray
            Optimal portfolio weights
        """
        print("[INFO] Optimizing portfolio weights (mean-variance)...")
        
        n = len(expected_returns)
        
        # Objective function: minimize -(w'μ - (δ/2)w'Σw)
        def objective(w):
            portfolio_return = w @ expected_returns
            portfolio_variance = w @ covariance @ w
            # Negative because we minimize
            return -(portfolio_return - (self.delta / 2) * portfolio_variance)
        
        # Constraints
        constraints = [
            {'type': 'eq', 'fun': lambda w: np.sum(w) - 1.0}  # Weights sum to 1
        ]
        
        # Bounds: long-only (0 ≤ w ≤ 1)
        bounds = tuple((0, 1) for _ in range(n))
        
        # Initial guess: equal weights
        w0 = np.ones(n) / n
        
        # Optimize
        result = minimize(
            objective,
            w0,
            method='SLSQP',
            bounds=bounds,
            constraints=constraints,
            options={'disp': False, 'maxiter': 1000}
        )
        
        if not result.success:
            print(f"[WARNING] Optimization did not converge: {result.message}")
            print("[INFO] Using equal weights as fallback")
            return w0
        
        weights = result.x
        
        # Calculate portfolio statistics
        portfolio_return = weights @ expected_returns
        portfolio_variance = weights @ covariance @ weights
        portfolio_volatility = np.sqrt(portfolio_variance)
        sharpe_ratio = (portfolio_return - self.rf) / portfolio_volatility
        
        print(f"[SUCCESS] Optimal portfolio calculated")
        print(f"[INFO] Expected return: {portfolio_return*100:.2f}%")
        print(f"[INFO] Portfolio volatility: {portfolio_volatility*100:.2f}%")
        print(f"[INFO] Sharpe ratio: {sharpe_ratio:.3f}")
        print(f"[INFO] Non-zero positions: {np.sum(weights > 0.001)}/{n}\n")
        
        return weights
    
    def calculate_risk_scores(self, weights: np.ndarray, 
                             covariance: np.ndarray) -> np.ndarray:
        """
        Calculate individual risk scores for each asset.
        
        Risk score combines:
        - Volatility (asset-specific risk)
        - Contribution to portfolio risk
        - Concentration (weight-adjusted)
        
        Parameters
        ----------
        weights : np.ndarray
            Portfolio weights
        covariance : np.ndarray
            Covariance matrix
        
        Returns
        -------
        np.ndarray
            Risk scores (0-100 scale, higher = riskier)
        """
        # Individual volatilities
        volatilities = np.sqrt(np.diag(covariance))
        
        # Marginal contribution to portfolio risk
        portfolio_variance = weights @ covariance @ weights
        marginal_risk = (covariance @ weights) / np.sqrt(portfolio_variance)
        
        # Normalize to 0-100 scale
        vol_score = (volatilities / volatilities.max()) * 50
        risk_contrib_score = (marginal_risk / marginal_risk.max()) * 50
        
        risk_scores = vol_score + risk_contrib_score
        
        return risk_scores
    
    def generate_recommendations(self, weights: np.ndarray, 
                                posterior_returns: np.ndarray,
                                covariance: np.ndarray,
                                output_path: str = 'investment_recommendations.csv'):
        """
        Generate investment recommendation CSV with allocation percentages.
        
        Parameters
        ----------
        weights : np.ndarray
            Optimal portfolio weights
        posterior_returns : np.ndarray
            BL posterior expected returns
        covariance : np.ndarray
            Covariance matrix
        output_path : str
            Path to save recommendations
        """
        print(f"[INFO] Generating investment recommendations...")
        
        # Calculate risk scores
        risk_scores = self.calculate_risk_scores(weights, covariance)
        
        # Create recommendations dataframe
        recommendations = pd.DataFrame({
            'startup_id': self.df['startup_id'],
            'startup_name': self.df.get('startup_name', ['Startup_' + str(i) for i in range(self.n_assets)]),
            'ai_valuation_usd': self.df['estimated_valuation_usd'],
            'allocation_percentage': weights * 100,
            'expected_return_pct': posterior_returns * 100,
            'risk_score': risk_scores,
            'recommendation': ['INVEST' if w > 0.01 else 'PASS' for w in weights]
        })
        
        # Sort by allocation (highest first)
        recommendations = recommendations.sort_values('allocation_percentage', ascending=False)
        
        # Save to CSV
        recommendations.to_csv(output_path, index=False, float_format='%.4f')
        
        print(f"[SUCCESS] Recommendations saved to: {output_path}")
        print(f"\n{'='*80}")
        print("Top 5 Investment Recommendations:")
        print(f"{'='*80}")
        print(recommendations.head(5).to_string(index=False))
        print(f"{'='*80}\n")
        
        return recommendations
    
    def run(self, output_path: str = 'investment_recommendations.csv') -> pd.DataFrame:
        """
        Execute complete Black-Litterman optimization pipeline.
        
        Parameters
        ----------
        output_path : str
            Path to save investment recommendations CSV
        
        Returns
        -------
        pd.DataFrame
            Investment recommendations with allocations and risk scores
        """
        # Step 1: Calculate covariance matrix
        covariance = self.calculate_returns_covariance()
        
        # Step 2: Calculate market equilibrium (prior)
        equilibrium = self.calculate_market_equilibrium(covariance)
        
        # Step 3: Construct investor views from AI
        P, Q, Omega = self.construct_views()
        
        # Step 4: Calculate posterior returns (BL formula)
        posterior_returns = self.calculate_posterior_returns(
            equilibrium, covariance, P, Q, Omega
        )
        
        # Step 5: Optimize portfolio weights
        weights = self.optimize_portfolio(posterior_returns, covariance)
        
        # Step 6: Generate recommendations
        recommendations = self.generate_recommendations(
            weights, posterior_returns, covariance, output_path
        )
        
        print(f"\n{'='*80}")
        print(f"{'BLACK-LITTERMAN OPTIMIZATION COMPLETE':^80}")
        print(f"{'='*80}\n")
        
        return recommendations


def load_ai_valuations(data_path: str = '../Data/startup_valuation_high_growth.csv',
                       sample_size: int = 20) -> pd.DataFrame:
    """
    Load AI valuation data and prepare for portfolio optimization.
    
    Parameters
    ----------
    data_path : str
        Path to valuation dataset
    sample_size : int
        Number of startups to include in portfolio (for demonstration)
    
    Returns
    -------
    pd.DataFrame
        Processed valuation data ready for BL optimization
    """
    print(f"[INFO] Loading AI valuation data from: {data_path}")
    
    df = pd.read_csv(data_path)
    
    # Sample top startups by valuation for portfolio
    df_sample = df.nlargest(sample_size, 'estimated_valuation_usd').copy()
    
    # Create predicted growth rate based on funding and revenue
    # This simulates the "AI view" - in production, this would come from ML model
    df_sample['predicted_growth_rate'] = (
        0.08 + 0.03 * (df_sample['estimated_revenue_usd'] / df_sample['estimated_revenue_usd'].median())
    ).clip(0.05, 0.25)  # Clip to 5-25% annual return
    
    # Confidence based on data quality (simulated - in production from model uncertainty)
    df_sample['confidence_score'] = np.random.uniform(0.75, 0.95, len(df_sample))
    
    print(f"[SUCCESS] Loaded {len(df_sample)} startups for portfolio optimization\n")
    
    return df_sample


def main():
    """
    Main execution pipeline for Black-Litterman portfolio optimization.
    """
    print("\n" + "="*80)
    print(" " * 20 + "IntelliStake Finance Domain - Portfolio Optimizer")
    print(" " * 25 + "Black-Litterman Model Implementation")
    print("="*80 + "\n")
    
    # Load AI valuation data
    valuations = load_ai_valuations(sample_size=20)
    
    # Initialize optimizer
    optimizer = BlackLittermanOptimizer(valuations)
    
    # Run optimization
    recommendations = optimizer.run(output_path='investment_recommendations.csv')
    
    # Summary statistics
    total_invested = recommendations[recommendations['allocation_percentage'] > 1.0].shape[0]
    avg_allocation = recommendations[recommendations['recommendation'] == 'INVEST']['allocation_percentage'].mean()
    
    print(f"[SUMMARY] Portfolio contains {total_invested} active positions")
    print(f"[SUMMARY] Average allocation per position: {avg_allocation:.2f}%")
    print(f"[SUMMARY] Total capital deployed: 100.00%\n")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    main()
