"""
Система аутентификации для TTS сервиса
"""
import jwt
import os
import logging
from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла
load_dotenv()

logger = logging.getLogger(__name__)

# Схема безопасности
security = HTTPBearer()

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
                detail=f"Invalid token: {str(e)}"
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
    return auth_manager.get_current_user(credentials)

# Зависимость для проверки админских прав
def get_admin_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Зависимость для получения админа"""
    if not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
