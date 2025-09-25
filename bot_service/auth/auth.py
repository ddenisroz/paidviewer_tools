# bot_service/auth.py
import os
import jwt
import time
import logging
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Depends, status
from core.session_manager import session_manager

logger = logging.getLogger(__name__)

def get_session_data(request: Request) -> Optional[Dict[str, Any]]:
    """Извлекает и валидирует данные сессии из cookie."""
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    return session_manager.validate_session(session_id)

async def get_current_user(request: Request) -> Dict[str, Any]:
    """
    Получает данные текущего пользователя из валидной сессии.
    Вызывает HTTPException 401, если сессия не найдена или невалидна.
    """
    session_data = get_session_data(request)
    if session_data:
        logger.info(f"User authenticated via session: ID {session_data.get('id')}, Name: {session_data.get('display_name')}")
        return session_data
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """Получает данные текущего пользователя, если сессия валидна, иначе возвращает None."""
    return get_session_data(request)

async def get_admin_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Проверяет, обладает ли текущий пользователь правами администратора.
    Вызывает HTTPException 403, если права отсутствуют.
    """
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

def create_jwt_token(user_id: int) -> str:
    """Создать JWT токен для пользователя (используется для OBS)."""
    SECRET_KEY = os.getenv("SECRET_KEY")
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY not configured for JWT creation")
    
    payload = {
        "sub": str(user_id),  # sub должен быть строкой
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400 * 365 # 1 год
    }
    
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")
