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
        logger.info(f"🔐 [TOKEN SAFE] START - user: {user_id}, platform: {platform}, session: {session_id[:8]}...")
        
        # 1. Получаем текущую сессию
        logger.debug(f"🔐 [TOKEN SAFE] Step 1: Querying session from database...")
        session = db.query(UserSession).filter(
            UserSession.session_id == session_id,
            UserSession.is_active == True
        ).first()
        
        if not session:
            logger.warning(f"🚫 [TOKEN SAFE] Session {session_id[:8]}... NOT FOUND or inactive!")
            raise HTTPException(status_code=401, detail="Session not found or expired")
        
        logger.info(f"🔐 [TOKEN SAFE] Session found - user_id: {session.user_id}, created: {session.created_at}")
        
        # 2. Извлекаем linked_platforms
        logger.debug(f"🔐 [TOKEN SAFE] Step 2: Extracting linked_platforms...")
        device_info = session.device_info or {}
        logger.debug(f"🔐 [TOKEN SAFE] device_info keys: {list(device_info.keys())}")
        
        linked_platforms = device_info.get('linked_platforms', [])
        logger.info(f"🔐 [TOKEN SAFE] linked_platforms from DB: {linked_platforms} (type: {type(linked_platforms)})")
        
        # 3. Проверяем, что платформа в списке
        logger.debug(f"🔐 [TOKEN SAFE] Step 3: Checking if '{platform}' in linked_platforms...")
        logger.debug(f"🔐 [TOKEN SAFE] linked_platforms is empty: {not linked_platforms}")
        logger.debug(f"🔐 [TOKEN SAFE] platform '{platform}' in list: {platform in linked_platforms if linked_platforms else 'N/A (list empty)'}")
        
        if linked_platforms and platform not in linked_platforms:
            logger.warning(
                f"🚫 [TOKEN SAFE] SECURITY CHECK FAILED! "
                f"User {user_id} tried to access '{platform}' "
                f"but session only has: {linked_platforms}"
            )
            raise HTTPException(
                status_code=403,
                detail=f"Platform '{platform}' is not linked to current session. "
                       f"Please reconnect via {platform.capitalize()} OAuth."
            )
        
        logger.info(f"✅ [TOKEN SAFE] Security check PASSED for platform '{platform}'")
        
        # 4. Если проверка прошла - получаем токен
        logger.debug(f"🔐 [TOKEN SAFE] Step 4: Fetching token from database...")
        tokens = get_user_token_from_db(user_id, platform)
        
        if tokens and tokens.get("access_token"):
            logger.info(f"✅ [TOKEN SAFE] Token retrieved successfully for '{platform}', user {user_id}")
            return tokens["access_token"]
        
        logger.warning(f"⚠️ [TOKEN SAFE] No token found for user {user_id} on platform '{platform}'")
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

