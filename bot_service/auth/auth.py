# bot_service/auth.py
import logging
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Depends, status
from core.session_manager import session_manager
from core.security_modern import modern_security_manager as security_manager

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
    Использует кэширование в request.state для избежания повторных запросов.
    """
    # Кэшируем результат в request.state для одного запроса
    if hasattr(request.state, 'current_user'):
        return request.state.current_user
    
    session_data = get_session_data(request)
    if session_data:
        # Проверяем, не заблокирован ли пользователь
        if session_data.get('is_blocked', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account blocked: {session_data.get('blocked_reason', 'No reason provided')}",
            )
        
        logger.info(f"User authenticated via session: ID {session_data.get('id')}")
        # Кэшируем в request.state
        request.state.current_user = session_data
        return session_data
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """
    Получает данные текущего пользователя, если сессия валидна, иначе возвращает None.
    Использует кэширование в request.state для избежания повторных запросов.
    """
    # Кэшируем результат в request.state для одного запроса
    if hasattr(request.state, 'current_user_optional'):
        return request.state.current_user_optional
    
    session_data = get_session_data(request)
    # Кэшируем результат (может быть None)
    request.state.current_user_optional = session_data
    return session_data

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

