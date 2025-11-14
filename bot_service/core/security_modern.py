# bot_service/core/security_modern.py
"""
Современная система безопасности с использованием профессиональных библиотек
Заменяет самописные костыли на проверенные решения
"""
import logging
import secrets
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from functools import wraps

# Современные библиотеки безопасности
from cryptography.fernet import Fernet
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import HTTPException, Request, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse

from core.config_modern import modern_config

logger = logging.getLogger(__name__)

# Настройка шифрования для OAuth токенов
def _get_encryption_key() -> bytes:
    """Получить ключ шифрования для OAuth токенов из конфигурации"""
    # Используем TOKEN_ENCRYPTION_KEY из .env файла
    encryption_key = getattr(modern_config, 'token_encryption_key', None)
    if not encryption_key:
        # Fallback на JWT ключ если TOKEN_ENCRYPTION_KEY не задан
        key = modern_config.jwt_secret_key.encode()[:32]
        encryption_key = base64.urlsafe_b64encode(key.ljust(32, b'0')[:32]).decode()
    
    return encryption_key.encode()

_fernet = Fernet(_get_encryption_key())

# Настройка rate limiting
limiter = Limiter(key_func=get_remote_address)

# Настройка JWT
security = HTTPBearer()

class ModernSecurityManager:
    """Современный менеджер безопасности с профессиональными библиотеками"""
    
    def __init__(self):
        self.secret_key = modern_config.jwt_secret_key
        self.algorithm = modern_config.jwt_algorithm
        self.access_token_expire_minutes = modern_config.jwt_access_token_expire_minutes
        
        logger.info("🔐 Modern Security Manager initialized with professional libraries")

    def encrypt_oauth_token(self, token: str) -> str:
        """
        Шифрование OAuth токена для безопасного хранения в БД
        """
        try:
            encrypted_token = _fernet.encrypt(token.encode())
            return base64.urlsafe_b64encode(encrypted_token).decode()
        except Exception as e:
            logger.error(f"Error encrypting OAuth token: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to encrypt OAuth token"
            )

    def decrypt_oauth_token(self, encrypted_token: str) -> str:
        """
        Расшифровка OAuth токена из БД.
        Поддерживает незашифрованные токены для обратной совместимости.
        """
        if not encrypted_token:
            return encrypted_token
            
        try:
            # Пытаемся расшифровать токен
            encrypted_data = base64.urlsafe_b64decode(encrypted_token.encode())
            decrypted_token = _fernet.decrypt(encrypted_data)
            return decrypted_token.decode()
        except Exception as e:
            # Если не получилось расшифровать - возможно токен не зашифрован (старый формат)
            logger.debug(f"Token appears to be unencrypted (legacy format), returning as-is")
            return encrypted_token

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        Создание JWT токена доступа
        """
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt

    def verify_token(self, token: str) -> dict:
        """
        Верификация JWT токена
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError as e:
            logger.error(f"JWT verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def generate_session_id(self) -> str:
        """
        Генерация безопасного ID сессии
        """
        return secrets.token_urlsafe(32)

    def generate_csrf_token(self) -> str:
        """
        Генерация CSRF токена
        """
        return secrets.token_urlsafe(32)

    def verify_csrf_token(self, token: str, session_token: str) -> bool:
        """
        Проверка CSRF токена
        """
        # Простая проверка - в реальном проекте можно использовать более сложную логику
        return token == session_token

# Глобальный экземпляр
modern_security_manager = ModernSecurityManager()

# Декораторы для rate limiting
def rate_limit(requests_per_minute: str):
    """Декоратор для rate limiting"""
    return limiter.limit(requests_per_minute)

def login_rate_limit():
    """Декоратор для rate limiting логина"""
    return limiter.limit(f"{modern_config.rate_limit_login_attempts}/{modern_config.rate_limit_login_window_minutes}minutes")

# Функции для FastAPI
def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    """
    Получение ID пользователя из JWT токена
    """
    token = credentials.credentials
    payload = modern_security_manager.verify_token(token)
    user_id: int = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    return user_id

def get_current_user_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> bool:
    """
    Проверка админских прав пользователя
    """
    token = credentials.credentials
    payload = modern_security_manager.verify_token(token)
    is_admin: bool = payload.get("is_admin", False)
    return is_admin

# Обработчик ошибок rate limiting
def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """
    Обработчик ошибок rate limiting
    """
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": f"Rate limit exceeded: {exc.detail}"}
    )

logger.info("🔐 Modern Security Manager initialized with OAuth encryption and JWT")