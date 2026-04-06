"""
ML Model Training Pipeline with Monitoring and Retraining
Handles XGBoost + LightGBM ensemble training, validation, and deployment
"""
import json
import pickle
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Tuple
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import xgboost as xgb
import lightgbm as lgb

class ModelTrainer:
    """Handles model training, validation, and monitoring"""
    
    def __init__(self, data_path: str = None, model_dir: str = "models"):
        self.data_path = data_path or Path(__file__).parent.parent.parent / "unified_data"
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(exist_ok=True)
        
        # Model performance thresholds
        self.min_r2 = 0.85  # Minimum R² for deployment
        self.max_mae = 0.15  # Maximum MAE for deployment
        
    def load_training_data(self) -> Tuple[pd.DataFrame, pd.Series]:
        """Load and prepare training data"""
        # Load master graph
        data_file = self.data_path / "intellistake_master_graph.parquet"
        if not data_file.exists():
            raise FileNotFoundError(f"Training data not found: {data_file}")
        
        df = pd.read_parquet(data_file)
        
        # Feature selection (top 6 features)
        features = [
            'github_velocity',
            'founder_pedigree',
            'market_traction',
            'funding_momentum',
            'sentiment_score',
            'web_traffic_growth'
        ]
        
        # Target: log-transformed valuation
        target = 'log_valuation'
        
        # Filter valid rows
        df_clean = df[features + [target]].dropna()
        
        X = df_clean[features]
        y = df_clean[target]
        
        return X, y
    
    def train_models(self, X: pd.DataFrame, y: pd.Series) -> Dict:
        """Train XGBoost and LightGBM models"""
        print(f"[{datetime.now()}] Starting model training...")
        print(f"  Dataset: {len(X)} samples, {X.shape[1]} features")
        
        # Train/test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # XGBoost
        print("\n[XGBoost] Training...")
        start = time.time()
        xgb_model = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=42,
            n_jobs=-1
        )
        xgb_model.fit(X_train, y_train)
        xgb_time = time.time() - start
        
        # LightGBM
        print("[LightGBM] Training...")
        start = time.time()
        lgb_model = lgb.LGBMRegressor(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=42,
            n_jobs=-1,
            verbose=-1
        )
        lgb_model.fit(X_train, y_train)
        lgb_time = time.time() - start
        
        # Evaluate
        metrics = self._evaluate_models(
            xgb_model, lgb_model, X_train, X_test, y_train, y_test
        )
        
        # Save models if they meet quality thresholds
        if metrics['ensemble']['r2_test'] >= self.min_r2:
            self._save_models(xgb_model, lgb_model, metrics)
            print(f"\n✅ Models saved (R² = {metrics['ensemble']['r2_test']:.4f})")
        else:
            print(f"\n⚠️  Models below quality threshold (R² = {metrics['ensemble']['r2_test']:.4f} < {self.min_r2})")
        
        return {
            'xgb_model': xgb_model,
            'lgb_model': lgb_model,
            'metrics': metrics,
            'training_time': {'xgb': xgb_time, 'lgb': lgb_time}
        }
    
    def _evaluate_models(self, xgb_model, lgb_model, X_train, X_test, y_train, y_test) -> Dict:
        """Evaluate models and ensemble"""
        # Predictions
        xgb_pred_train = xgb_model.predict(X_train)
        xgb_pred_test = xgb_model.predict(X_test)
        
        lgb_pred_train = lgb_model.predict(X_train)
        lgb_pred_test = lgb_model.predict(X_test)
        
        # Ensemble (average)
        ensemble_pred_train = (xgb_pred_train + lgb_pred_train) / 2
        ensemble_pred_test = (xgb_pred_test + lgb_pred_test) / 2
        
        # Metrics
        metrics = {
            'xgboost': {
                'r2_train': r2_score(y_train, xgb_pred_train),
                'r2_test': r2_score(y_test, xgb_pred_test),
                'mae_train': mean_absolute_error(y_train, xgb_pred_train),
                'mae_test': mean_absolute_error(y_test, xgb_pred_test),
                'rmse_test': np.sqrt(mean_squared_error(y_test, xgb_pred_test))
            },
            'lightgbm': {
                'r2_train': r2_score(y_train, lgb_pred_train),
                'r2_test': r2_score(y_test, lgb_pred_test),
                'mae_train': mean_absolute_error(y_train, lgb_pred_train),
                'mae_test': mean_absolute_error(y_test, lgb_pred_test),
                'rmse_test': np.sqrt(mean_squared_error(y_test, lgb_pred_test))
            },
            'ensemble': {
                'r2_train': r2_score(y_train, ensemble_pred_train),
                'r2_test': r2_score(y_test, ensemble_pred_test),
                'mae_train': mean_absolute_error(y_train, ensemble_pred_train),
                'mae_test': mean_absolute_error(y_test, ensemble_pred_test),
                'rmse_test': np.sqrt(mean_squared_error(y_test, ensemble_pred_test))
            }
        }
        
        # Print results
        print("\n📊 Model Performance:")
        for model_name, model_metrics in metrics.items():
            print(f"\n{model_name.upper()}:")
            print(f"  R² (train): {model_metrics['r2_train']:.4f}")
            print(f"  R² (test):  {model_metrics['r2_test']:.4f}")
            print(f"  MAE (test): {model_metrics['mae_test']:.4f}")
            print(f"  RMSE (test): {model_metrics['rmse_test']:.4f}")
        
        return metrics
    
    def _save_models(self, xgb_model, lgb_model, metrics: Dict):
        """Save trained models and metadata"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save models
        xgb_path = self.model_dir / f"xgboost_{timestamp}.pkl"
        lgb_path = self.model_dir / f"lightgbm_{timestamp}.pkl"
        
        with open(xgb_path, 'wb') as f:
            pickle.dump(xgb_model, f)
        
        with open(lgb_path, 'wb') as f:
            pickle.dump(lgb_model, f)
        
        # Save metadata
        metadata = {
            'timestamp': timestamp,
            'xgb_model_path': str(xgb_path),
            'lgb_model_path': str(lgb_path),
            'metrics': metrics,
            'status': 'deployed' if metrics['ensemble']['r2_test'] >= self.min_r2 else 'candidate'
        }
        
        metadata_path = self.model_dir / f"metadata_{timestamp}.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Update current model pointer
        current_path = self.model_dir / "current_model.json"
        with open(current_path, 'w') as f:
            json.dump(metadata, f, indent=2)
    
    def monitor_model_drift(self, current_metrics: Dict, baseline_metrics: Dict) -> Dict:
        """Monitor for model drift"""
        r2_drift = baseline_metrics['ensemble']['r2_test'] - current_metrics['ensemble']['r2_test']
        mae_drift = current_metrics['ensemble']['mae_test'] - baseline_metrics['ensemble']['mae_test']
        
        needs_retraining = (
            r2_drift > 0.05 or  # R² dropped by more than 5%
            mae_drift > 0.02    # MAE increased by more than 2%
        )
        
        return {
            'r2_drift': r2_drift,
            'mae_drift': mae_drift,
            'needs_retraining': needs_retraining,
            'timestamp': datetime.now().isoformat()
        }
    
    def retrain_if_needed(self):
        """Check drift and retrain if necessary"""
        # Load current model metadata
        current_path = self.model_dir / "current_model.json"
        if not current_path.exists():
            print("No current model found. Running initial training...")
            X, y = self.load_training_data()
            return self.train_models(X, y)
        
        with open(current_path, 'r') as f:
            baseline_metadata = json.load(f)
        
        # Load new data and evaluate current model
        X, y = self.load_training_data()
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Load current models
        with open(baseline_metadata['xgb_model_path'], 'rb') as f:
            xgb_model = pickle.load(f)
        with open(baseline_metadata['lgb_model_path'], 'rb') as f:
            lgb_model = pickle.load(f)
        
        # Evaluate on new data
        current_metrics = self._evaluate_models(xgb_model, lgb_model, X_train, X_test, y_train, y_test)
        
        # Check drift
        drift_report = self.monitor_model_drift(current_metrics, baseline_metadata['metrics'])
        
        print(f"\n📈 Drift Analysis:")
        print(f"  R² drift: {drift_report['r2_drift']:.4f}")
        print(f"  MAE drift: {drift_report['mae_drift']:.4f}")
        print(f"  Needs retraining: {drift_report['needs_retraining']}")
        
        if drift_report['needs_retraining']:
            print("\n🔄 Retraining models...")
            return self.train_models(X, y)
        else:
            print("\n✅ Models are still performing well. No retraining needed.")
            return None


if __name__ == "__main__":
    trainer = ModelTrainer()
    
    # Initial training
    X, y = trainer.load_training_data()
    results = trainer.train_models(X, y)
    
    print("\n" + "="*60)
    print("Training complete!")
    print("="*60)
