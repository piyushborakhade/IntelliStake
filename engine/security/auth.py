"""
Authentication & Authorization
JWT-based auth with role-based access control
"""
import os
import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
from cryptography.fernet import Fernet

class AuthService:
    """Handles authentication and authorization"""
    
    def __init__(self):
        self.secret_key = os.getenv('JWT_SECRET_KEY', 'dev-secret-change-in-production')
        self.algorithm = 'HS256'
        self.token_expiry = timedelta(hours=24)
        
        # API key encryption
        encryption_key = os.getenv('ENCRYPTION_KEY')
        if not encryption_key:
            # Generate one if not exists (save this to .env in production!)
            encryption_key = Fernet.generate_key().decode()
        self.cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
    
    def generate_token(self, user_id: str, role: str) -> str:
        """Generate JWT token"""
        payload = {
            'user_id': user_id,
            'role': role,
            'exp': datetime.utcnow() + self.token_expiry,
            'iat': datetime.utcnow()
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token: str) -> dict:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            raise ValueError('Token expired')
        except jwt.InvalidTokenError:
            raise ValueError('Invalid token')
    
    def encrypt_api_key(self, api_key: str) -> str:
        """Encrypt API key for storage"""
        return self.cipher.encrypt(api_key.encode()).decode()
    
    def decrypt_api_key(self, encrypted_key: str) -> str:
        """Decrypt API key"""
        return self.cipher.decrypt(encrypted_key.encode()).decode()
    
    def require_auth(self, required_role=None):
        """Decorator to require authentication"""
        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                token = request.headers.get('Authorization')
                
                if not token:
                    return jsonify({'error': 'No token provided'}), 401
                
                # Remove 'Bearer ' prefix if present
                if token.startswith('Bearer '):
                    token = token[7:]
                
                try:
                    payload = self.verify_token(token)
                    
                    # Check role if required
                    if required_role and payload.get('role') != required_role:
                        return jsonify({'error': 'Insufficient permissions'}), 403
                    
                    # Add user info to request context
                    request.user = payload
                    
                except ValueError as e:
                    return jsonify({'error': str(e)}), 401
                
                return f(*args, **kwargs)
            
            return decorated_function
        return decorator


# Global auth service instance
auth_service = AuthService()
