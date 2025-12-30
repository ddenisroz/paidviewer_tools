# bot_service/auth.py
import logging
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Depends, status
from sqlalchemy.orm import Session
from core.session_manager import session_manager
from core.security_modern import modern_security_manager as security_manager
from core.user_cache import user_cache
from core.database import get_db

logger = logging.getLogger(__name__)

def get_session_data(request: Request) -> Optional[Dict[str, Any]]:
    """Извлекает и валидирует данные сессии из cookie."""
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    return session_manager.validate_session(session_id)

async def get_current_user(request: Request, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Получает данные текущего пользователя из БД (с кешированием).
    
    ВАЖНО: Данные ВСЕГДА берутся из БД (Single Source of Truth).
    Сессия используется только для проверки валидности и получения user_id.
    
    Кеширование:
    - request.state - кеш на время одного запроса
    - user_cache - кеш на 5 минут с инвалидацией
    
    Вызывает HTTPException 401, если сессия не найдена или невалидна.
    Вызывает HTTPException 403, если пользователь заблокирован.
    """
    # Кэшируем результат в request.state для одного запроса
    if hasattr(request.state, 'current_user'):
        return request.state.current_user

    # Проверяем валидность сессии
    session_data = get_session_data(request)
    if not session_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = session_data.get('id') or session_data.get('user_id')
    if not user_id or user_id == -1:
        # Гостевая сессия
        logger.info("Guest session detected")
        guest_user = {
            'id': -1,
            'role': 'guest',
            'is_admin': False,
            'is_guest': True,
            'is_active': True,
            'is_blocked': False,
            'username': session_data.get('device_info', {}).get('monitored_channel', 'guest'),
            'platform': session_data.get('device_info', {}).get('platform', 'unknown')
        }
        request.state.current_user = guest_user
        return guest_user

    # Получаем СВЕЖИЕ данные из БД (через кеш)
    user_data = user_cache.get(user_id, db)
    if not user_data:
        logger.warning(f"User {user_id} not found in DB")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Проверяем активность
    if not user_data.get('is_active', True):
        logger.warning(f"User {user_id} is not active")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is not active",
        )

    # Проверяем блокировку
    if user_data.get('is_blocked', False):
        logger.warning(f"User {user_id} is blocked")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account blocked: {user_data.get('blocked_reason', 'No reason provided')}",
        )

    logger.debug(f"User authenticated: ID {user_id}, role={user_data.get('role')}")

    # Кэшируем в request.state
    request.state.current_user = user_data
    return user_data

async def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[Dict[str, Any]]:
    """
    Получает данные текущего пользователя из БД, если сессия валидна, иначе возвращает None.
    
    ВАЖНО: Данные ВСЕГДА берутся из БД (Single Source of Truth).
    Использует кэширование в request.state для избежания повторных запросов.
    """
    # Кэшируем результат в request.state для одного запроса
    if hasattr(request.state, 'current_user_optional'):
        return request.state.current_user_optional

    # Проверяем валидность сессии
    session_data = get_session_data(request)
    if not session_data:
        request.state.current_user_optional = None
        return None

    user_id = session_data.get('id') or session_data.get('user_id')
    if not user_id or user_id == -1:
        # Гостевая сессия
        guest_user = {
            'id': -1,
            'role': 'guest',
            'is_admin': False,
            'is_guest': True,
            'is_active': True,
            'is_blocked': False,
        }
        request.state.current_user_optional = guest_user
        return guest_user

    # Получаем СВЕЖИЕ данные из БД (через кеш)
    user_data = user_cache.get(user_id, db)

    # Кэшируем результат (может быть None)
    request.state.current_user_optional = user_data
    return user_data

async def get_admin_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Проверяет, обладает ли текущий пользователь правами администратора.
    Вызывает HTTPException 403, если права отсутствуют.
    """
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

def create_jwt_token(user_id: int, token_type: str = "obs") -> str:
    """
    Создать JWT токен для пользователя
    
    Args:
        user_id: ID пользователя
        token_type: Тип токена (obs, access, refresh)
        
    Returns:
        str: JWT токен
    """
    from datetime import timedelta
    data = {"user_id": user_id, "type": token_type}
    expires_delta = timedelta(days=365)  # Долгоживущий токен для OBS/виджетов
    return security_manager.create_access_token(data, expires_delta)


def verify_jwt_token(token: str, expected_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Проверить и декодировать JWT токен
    
    Args:
        token: JWT токен
        expected_type: Ожидаемый тип токена
        
    Returns:
        Dict: Декодированные данные токена
    """
    return security_manager.verify_jwt_token(token, expected_type)

