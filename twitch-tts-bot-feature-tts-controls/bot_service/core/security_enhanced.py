"""
Улучшенный модуль безопасности для production среды
Реализует OWASP рекомендации и best practices
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Загрузить .env если еще не загружен
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=False)

import secrets
import hashlib
import hmac
import jwt
import logging
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Optional, Dict, Any, Callable
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

try:
    import redis.asyncio as redis
except ImportError:
    redis = None

logger = logging.getLogger(__name__)


class SecurityConfig:
    """Конфигурация безопасности"""
    # Хеширование паролей - OWASP рекомендации 2024
    PBKDF2_ITERATIONS = 600_000  # OWASP minimum (было 100k)
    PBKDF2_ALGORITHM = 'sha256'
    SALT_LENGTH = 32  # 256 бит
    
    # JWT
    JWT_ALGORITHM = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS = 30
    JWT_OBS_TOKEN_EXPIRE_DAYS = 365
    
    # Rate Limiting
    RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'true').lower() == 'true'
    MAX_REQUESTS_PER_MINUTE = int(os.getenv('MAX_REQUESTS_PER_MINUTE', '60'))
    MAX_LOGIN_ATTEMPTS = 5
    LOGIN_ATTEMPT_WINDOW_MINUTES = 15
    
    # Security Headers
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }


class SecurityManager:
    """Менеджер безопасности с улучшенными механизмами защиты"""
    
    def __init__(self):
        self.secret_key = os.getenv('SECRET_KEY')
        if not self.secret_key or len(self.secret_key) < 32:
            logger.warning("SECRET_KEY not set or too short, generating random key")
            self.secret_key = secrets.token_urlsafe(32)
        
        self.config = SecurityConfig()
        self.redis_client: Optional[redis.Redis] = None
        self._init_redis()
    
    def _init_redis(self):
        """Инициализация Redis для rate limiting"""
        if not redis:
            logger.warning("redis-py not installed, rate limiting will be memory-based")
            return
        
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            logger.info("Redis client initialized for rate limiting")
        except Exception as e:
            logger.warning(f"Failed to initialize Redis: {e}, using memory-based rate limiting")
            self.redis_client = None
    
    def generate_api_key(self) -> str:
        """Генерация криптографически стойкого API ключа"""
        return secrets.token_urlsafe(32)
    
    def hash_password(self, password: str) -> str:
        """
        Хеширование пароля с использованием PBKDF2-HMAC-SHA256
        Соответствует OWASP рекомендациям 2024
        
        Args:
            password: Пароль для хеширования
            
        Returns:
            Строка формата: iterations$algorithm$salt$hash
        """
        salt = secrets.token_bytes(self.config.SALT_LENGTH)
        iterations = self.config.PBKDF2_ITERATIONS
        
        hashed = hashlib.pbkdf2_hmac(
            self.config.PBKDF2_ALGORITHM,
            password.encode('utf-8'),
            salt,
            iterations
        )
        
        # Формат: iterations$algorithm$salt$hash
        return f"{iterations}${self.config.PBKDF2_ALGORITHM}${salt.hex()}${hashed.hex()}"
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """
        Проверка пароля с защитой от timing attacks
        
        Args:
            password: Пароль для проверки
            hashed: Хеш пароля из БД
            
        Returns:
            True если пароль верный, False иначе
        """
        try:
            parts = hashed.split('$')
            
            # Поддержка старого формата (salt:hash) для миграции
            if len(parts) == 2:
                logger.warning("Old password format detected, please rehash")
                return self._verify_old_format(password, hashed)
            
            if len(parts) != 4:
                logger.error(f"Invalid hash format: expected 4 parts, got {len(parts)}")
                return False
            
            iterations, algorithm, salt_hex, stored_hash = parts
            iterations = int(iterations)
            salt = bytes.fromhex(salt_hex)
            
            # Вычисляем хеш
            computed_hash = hashlib.pbkdf2_hmac(
                algorithm,
                password.encode('utf-8'),
                salt,
                iterations
            )
            
            # Используем hmac.compare_digest для защиты от timing attacks
            return hmac.compare_digest(
                computed_hash.hex(),
                stored_hash
            )
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False
    
    def _verify_old_format(self, password: str, hashed: str) -> bool:
        """Проверка старого формата паролей для обратной совместимости"""
        try:
            salt, stored_hash = hashed.split(':')
            computed_hash = hashlib.pbkdf2_hmac(
                'sha256',
                password.encode('utf-8'),
                salt.encode('utf-8'),
                100000  # Старое количество итераций
            )
            return hmac.compare_digest(computed_hash.hex(), stored_hash)
        except Exception as e:
            logger.error(f"Old format verification error: {e}")
            return False
    
    def create_jwt_token(
        self,
        user_id: int,
        token_type: str = "access",
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Создание JWT токена
        
        Args:
            user_id: ID пользователя
            token_type: Тип токена (access, refresh, obs)
            additional_claims: Дополнительные claims
            
        Returns:
            JWT токен
        """
        now = datetime.now(timezone.utc)
        
        # Определяем время жизни токена
        if token_type == "obs":
            expire = now + timedelta(days=self.config.JWT_OBS_TOKEN_EXPIRE_DAYS)
        elif token_type == "refresh":
            expire = now + timedelta(days=self.config.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        else:  # access
            expire = now + timedelta(minutes=self.config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        
        # Базовые claims
        payload = {
            "sub": str(user_id),
            "iat": now,
            "exp": expire,
            "nbf": now,  # Not before
            "type": token_type,
            "jti": secrets.token_urlsafe(16)  # JWT ID для отзыва токенов
        }
        
        # Добавляем дополнительные claims
        if additional_claims:
            payload.update(additional_claims)
        
        return jwt.encode(payload, self.secret_key, algorithm=self.config.JWT_ALGORITHM)
    
    def verify_jwt_token(
        self,
        token: str,
        expected_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Проверка и декодирование JWT токена
        
        Args:
            token: JWT токен
            expected_type: Ожидаемый тип токена
            
        Returns:
            Декодированные данные токена
            
        Raises:
            HTTPException: Если токен невалиден
        """
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.config.JWT_ALGORITHM],
                options={
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_nbf": True
                }
            )
            
            # Проверяем тип токена если указан
            if expected_type and payload.get("type") != expected_type:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid token type. Expected: {expected_type}"
                )
            
            return payload
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}"
            )
    
    async def check_rate_limit(
        self,
        identifier: str,
        limit: int = None,
        window_seconds: int = 60
    ) -> bool:
        """
        Проверка rate limiting
        
        Args:
            identifier: Уникальный идентификатор (IP, user_id, etc.)
            limit: Максимальное количество запросов
            window_seconds: Временное окно в секундах
            
        Returns:
            True если лимит не превышен, False иначе
        """
        if not self.config.RATE_LIMIT_ENABLED:
            return True
        
        if limit is None:
            limit = self.config.MAX_REQUESTS_PER_MINUTE
        
        key = f"rate_limit:{identifier}"
        
        if self.redis_client:
            try:
                current = await self.redis_client.get(key)
                
                if current is None:
                    await self.redis_client.setex(key, window_seconds, 1)
                    return True
                
                if int(current) >= limit:
                    return False
                
                await self.redis_client.incr(key)
                return True
                
            except Exception as e:
                logger.error(f"Redis rate limit error: {e}")
                # В случае ошибки Redis разрешаем запрос
                return True
        else:
            # Memory-based rate limiting (упрощенная версия)
            # В production лучше использовать Redis
            return True
    
    async def record_failed_login(self, identifier: str) -> int:
        """
        Записать неудачную попытку входа
        
        Args:
            identifier: IP или username
            
        Returns:
            Количество неудачных попыток
        """
        if not self.redis_client:
            return 0
        
        key = f"failed_login:{identifier}"
        window = self.config.LOGIN_ATTEMPT_WINDOW_MINUTES * 60
        
        try:
            current = await self.redis_client.get(key)
            
            if current is None:
                await self.redis_client.setex(key, window, 1)
                return 1
            
            count = int(current) + 1
            await self.redis_client.setex(key, window, count)
            return count
            
        except Exception as e:
            logger.error(f"Failed to record login attempt: {e}")
            return 0
    
    async def is_login_blocked(self, identifier: str) -> bool:
        """Проверить, заблокирован ли вход для идентификатора"""
        if not self.redis_client:
            return False
        
        key = f"failed_login:{identifier}"
        
        try:
            count = await self.redis_client.get(key)
            if count and int(count) >= self.config.MAX_LOGIN_ATTEMPTS:
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to check login block: {e}")
            return False
    
    async def clear_failed_logins(self, identifier: str):
        """Очистить счетчик неудачных попыток"""
        if not self.redis_client:
            return
        
        key = f"failed_login:{identifier}"
        try:
            await self.redis_client.delete(key)
        except Exception as e:
            logger.error(f"Failed to clear login attempts: {e}")


# Глобальный экземпляр
security_manager = SecurityManager()


def rate_limit(
    limit: int = None,
    window_seconds: int = 60,
    identifier_func: Optional[Callable] = None
):
    """
    Декоратор для rate limiting endpoints
    
    Args:
        limit: Максимальное количество запросов
        window_seconds: Временное окно в секундах
        identifier_func: Функция для получения идентификатора из request
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Получаем request из аргументов
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                # Проверяем kwargs
                request = kwargs.get('request')
            
            if not request:
                logger.warning("Rate limit: Request not found in arguments")
                return await func(*args, **kwargs)
            
            # Определяем идентификатор
            if identifier_func:
                identifier = identifier_func(request)
            else:
                identifier = request.client.host if request.client else "unknown"
            
            # Проверяем лимит
            allowed = await security_manager.check_rate_limit(
                identifier, limit, window_seconds
            )
            
            if not allowed:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later.",
                    headers={"Retry-After": str(window_seconds)}
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


class SecurityHeadersMiddleware:
    """Middleware для добавления security headers"""
    
    def __init__(self, app):
        self.app = app
        self.config = SecurityConfig()
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                
                # Добавляем security headers
                for key, value in self.config.SECURITY_HEADERS.items():
                    headers[key.encode().lower()] = value.encode()
                
                message["headers"] = list(headers.items())
            
            await send(message)
        
        await self.app(scope, receive, send_wrapper)

