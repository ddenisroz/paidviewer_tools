"""
Система аутентификации для TTS сервиса
"""
import jwt
import os
import logging
import secrets
from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Depends, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла
load_dotenv()

logger = logging.getLogger(__name__)

# Схема безопасности
security = HTTPBearer(auto_error=False)

class TTSAuthManager:
    """Менеджер аутентификации для TTS сервиса"""
    
    def __init__(self):
        self.secret_key = os.getenv("SECRET_KEY")
        if not self.secret_key:
            raise ValueError("SECRET_KEY environment variable is required")
        self.algorithm = os.getenv("ALGORITHM", "HS256")
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Проверяет JWT токен и возвращает данные пользователя"""
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                options={
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_nbf": True
                }
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
                detail="Invalid token"
            )
    
    def get_current_user(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
        """Получает текущего пользователя из токена"""
        token = credentials.credentials
        payload = self.verify_token(token)
        
        # Проверяем, что токен содержит необходимые данные
        if "user_id" not in payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user_id"
            )
        
        return payload

# Глобальный экземпляр менеджера аутентификации
auth_manager = TTSAuthManager()

# Зависимость для получения текущего пользователя
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Зависимость для получения текущего пользователя"""
    if credentials is not None:
        return auth_manager.get_current_user(credentials)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authorization required"
    )


def get_current_user_or_internal(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_internal_service_key: Optional[str] = Header(None, alias="X-Internal-Service-Key"),
) -> Dict[str, Any]:
    """Разрешает JWT пользователя или внутренний сервисный ключ."""
    if credentials is not None:
        return auth_manager.get_current_user(credentials)

    expected_key = os.getenv("TTS_INTERNAL_API_KEY")
    if expected_key and x_internal_service_key and secrets.compare_digest(x_internal_service_key, expected_key):
        return {"user_id": 0, "is_admin": True, "service": "bot_service"}

    environment = (os.getenv("ENVIRONMENT") or os.getenv("ENV") or "development").lower()
    is_dev_env = environment in {"development", "dev", "testing", "test", "local"}
    if (
        not expected_key
        and is_dev_env
        and request.client
        and request.client.host in {"127.0.0.1", "::1", "localhost"}
    ):
        logger.warning("Using loopback internal auth fallback in %s because TTS_INTERNAL_API_KEY is not configured", environment)
        return {"user_id": 0, "is_admin": True, "service": "loopback"}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authorization required"
    )

# Зависимость для проверки админских прав
def get_admin_user(current_user: Dict[str, Any] = Depends(get_current_user_or_internal)) -> Dict[str, Any]:
    """Зависимость для получения админа"""
    if not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
