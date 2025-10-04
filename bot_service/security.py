"""
Модуль безопасности для продакшен среды
"""
import os
import secrets
import hashlib
from datetime import datetime, timedelta
from functools import wraps
from fastapi import HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import redis
from typing import Optional

# Rate limiting с Redis (опционально)
try:
    redis_client = redis.Redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
except:
    redis_client = None

class SecurityManager:
    def __init__(self):
        self.secret_key = os.getenv('SECRET_KEY', secrets.token_urlsafe(32))
        self.rate_limit_enabled = os.getenv('RATE_LIMIT_ENABLED', 'true').lower() == 'true'
        self.max_requests_per_minute = int(os.getenv('MAX_REQUESTS_PER_MINUTE', '60'))
        
    def generate_api_key(self) -> str:
        """Генерация API ключа для внешних сервисов"""
        return secrets.token_urlsafe(32)
    
    def hash_password(self, password: str) -> str:
        """Хеширование пароля"""
        salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return f"{salt}:{hashed.hex()}"
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """Проверка пароля"""
        try:
            salt, stored_hash = hashed.split(':')
            hashed_password = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
            return stored_hash == hashed_password.hex()
        except:
            return False
    
    def rate_limit_check(self, request: Request, identifier: str = None) -> bool:
        """Проверка rate limiting"""
        if not self.rate_limit_enabled or not redis_client:
            return True
            
        if not identifier:
            identifier = request.client.host
            
        key = f"rate_limit:{identifier}"
        current_requests = redis_client.get(key)
        
        if current_requests is None:
            redis_client.setex(key, 60, 1)
            return True
        
        if int(current_requests) >= self.max_requests_per_minute:
            return False
            
        redis_client.incr(key)
        return True

# Глобальный экземпляр
security = SecurityManager()

def rate_limit(identifier_func=None):
    """Декоратор для rate limiting"""
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            identifier = None
            if identifier_func:
                identifier = identifier_func(request)
                
            if not security.rate_limit_check(request, identifier):
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again later."
                )
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator

def require_api_key():
    """Декоратор для проверки API ключа"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Здесь должна быть логика проверки API ключа
            # Пока пропускаем
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Middleware для безопасности
class SecurityMiddleware:
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Добавляем security headers
            async def send_wrapper(message):
                if message["type"] == "http.response.start":
                    headers = dict(message.get("headers", []))
                    
                    # Security headers
                    security_headers = {
                        b"x-content-type-options": b"nosniff",
                        b"x-frame-options": b"DENY", 
                        b"x-xss-protection": b"1; mode=block",
                        b"strict-transport-security": b"max-age=31536000; includeSubDomains",
                        b"referrer-policy": b"strict-origin-when-cross-origin"
                    }
                    
                    for key, value in security_headers.items():
                        headers[key] = value
                    
                    message["headers"] = list(headers.items())
                
                await send(message)
            
            await self.app(scope, receive, send_wrapper)
        else:
            await self.app(scope, receive, send)
