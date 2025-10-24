"""
Утилиты для безопасной работы с токенами пользователей
"""
import logging
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from core.database import UserSession, get_db
from core.token_utils import get_user_token_from_db

logger = logging.getLogger(__name__)


def get_user_token_safe(
    user_id: int,
    platform: str,
    session_id: str,
    db: Session = None
) -> Optional[str]:
    """
    Безопасное получение токена с проверкой linked_platforms.
    
    Проверяет, что платформа привязана к текущей сессии пользователя.
    Это защищает от ситуации, когда злоумышленник получил доступ к одной платформе,
    но не должен иметь доступ к токенам других платформ того же user_id.
    
    Args:
        user_id: ID пользователя
        platform: Название платформы ('twitch', 'vk', 'donationalerts')
        session_id: ID текущей сессии
        db: Database session (опционально)
    
    Returns:
        str: Access token для платформы или None
    
    Raises:
        HTTPException 403: Если платформа не привязана к сессии
    """
    should_close_db = False
    if db is None:
        db = next(get_db())
        should_close_db = True
    
    try:
        # 1. Получаем текущую сессию
        session = db.query(UserSession).filter(
            UserSession.session_id == session_id,
            UserSession.is_active == True
        ).first()
        
        if not session:
            logger.warning(f"🚫 [SECURITY] Session {session_id[:8]}... not found or inactive")
            raise HTTPException(status_code=401, detail="Session not found or expired")
        
        # 2. Извлекаем linked_platforms
        device_info = session.device_info or {}
        linked_platforms = device_info.get('linked_platforms', [])
        
        logger.info(f"🔐 [SECURITY] User {user_id} session {session_id[:8]}... has linked_platforms: {linked_platforms}")
        
        # 3. Проверяем, что платформа в списке
        if linked_platforms and platform not in linked_platforms:
            logger.warning(
                f"🚫 [SECURITY] User {user_id} tried to access '{platform}' "
                f"but session only has: {linked_platforms}"
            )
            raise HTTPException(
                status_code=403,
                detail=f"Platform '{platform}' is not linked to current session. "
                       f"Please reconnect via {platform.capitalize()} OAuth."
            )
        
        # 4. Если проверка прошла - получаем токен
        tokens = get_user_token_from_db(user_id, platform)
        if tokens and tokens.get("access_token"):
            logger.info(f"✅ [SECURITY] Token for '{platform}' retrieved for user {user_id}")
            return tokens["access_token"]
        
        logger.warning(f"⚠️ [SECURITY] No token found for user {user_id} on platform '{platform}'")
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [SECURITY] Error in get_user_token_safe: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if should_close_db:
            db.close()


def get_user_token_safe_from_current_user(
    user: dict,
    platform: str,
    db: Session = None
) -> Optional[str]:
    """
    Удобная обёртка для get_user_token_safe, принимающая объект current_user.
    
    Args:
        user: Объект пользователя из Depends(get_current_user)
        platform: Название платформы
        db: Database session (опционально)
    
    Returns:
        str: Access token или None
    """
    user_id = user.get("id")
    session_id = user.get("session_id")
    
    if not user_id or not session_id:
        logger.error(f"❌ [SECURITY] Missing user_id or session_id in current_user object")
        raise HTTPException(status_code=401, detail="Invalid authentication data")
    
    return get_user_token_safe(user_id, platform, session_id, db)

