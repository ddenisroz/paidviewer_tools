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

# Современные библиотеки безопасности
from cryptography.fernet import Fernet
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import HTTPException, Request, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse

from core.config import settings

logger = logging.getLogger(__name__)


# Настройка rate limiting
limiter = Limiter(key_func=get_remote_address)

# Настройка JWT
security = HTTPBearer()

class ModernSecurityManager:
    """Современный менеджер безопасности с профессиональными библиотеками"""

    def __init__(self):
        self.secret_key = settings.secret_key
        self.algorithm = settings.algorithm
        self.access_token_expire_minutes = 30  # Default 30 minutes

        logger.info("[AUTH] Modern Security Manager initialized with professional libraries")


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

    def verify_jwt_token(self, token: str, expected_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Verify JWT token and optionally enforce token type.

        `expected_type` matches payload field `type` or legacy `token_type`.
        """
        if not token or not isinstance(token, str):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            payload: Dict[str, Any] = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            if expected_type:
                token_type = payload.get("type") or payload.get("token_type")
                if token_type != expected_type:
                    logger.warning(
                        "JWT token type mismatch: expected=%s got=%s",
                        expected_type,
                        token_type,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token type",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            return payload
        except JWTError as e:
            logger.error(f"JWT verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def verify_token(self, token: str, expected_type: Optional[str] = None) -> Dict[str, Any]:
        """Backward-compatible JWT verification API."""
        return self.verify_jwt_token(token, expected_type=expected_type)

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
    return limiter.limit(settings.rate_limit_login)

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

logger.info("[AUTH] Modern Security Manager initialized with JWT")

