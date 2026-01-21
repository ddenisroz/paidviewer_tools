# bot_service/core/token_utils.py
"""
Утилиты для работы с токенами пользователей
"""
from sqlalchemy.orm import Session
from core.database import get_db, UserToken
from core.http_timeouts import TOKEN_VALIDATION_TIMEOUT
from typing import Optional, Dict, Any
from core.datetime_utils import utcnow_naive
import logging

logger = logging.getLogger(__name__)

def get_user_token_from_db(user_id: int, platform: str, db: Session = None) -> Optional[Dict[str, Any]]:
    """
    Получить токен пользователя из базы данных
    
    Args:
        user_id: ID пользователя
        platform: Платформа ('twitch', 'vk', 'donationalerts')
        db: Database session (опционально, для предотвращения race conditions)
        
    Returns:
        dict: Информация о токене или None если не найден
    """
    from core.token_encryption import decrypt_token

    # Используем переданную сессию или создаем новую (legacy behavior)
    should_close_db = False
    if db is None:
        db = next(get_db())
        should_close_db = True

    try:
        token = db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.platform == platform,
            UserToken.is_active.is_(True)
        ).first()

        if token and token.access_token:
            # Расшифровываем токены перед возвратом
            decrypted_access_token = decrypt_token(token.access_token) if token.access_token else None
            decrypted_refresh_token = decrypt_token(token.refresh_token) if token.refresh_token else None

            return {
                "platform_user_id": token.platform_user_id,
                "access_token": decrypted_access_token,
                "refresh_token": decrypted_refresh_token,
                "expires_at": token.expires_at,
                "avatar_url": token.avatar_url,
                "scopes": token.scopes if token.scopes else []
            }
        return None
    finally:
        if should_close_db:
            db.close()

async def validate_platform_token(token) -> bool:
    """
    Валидация токена через API платформы с кешированием.
    
    Args:
        token: UserToken объект
        
    Returns:
        bool: True если токен валиден, False если нет
    """
    from core.token_validation_cache import token_validation_cache

    logger.debug(f"[DEBUG] VALIDATE_TOKEN START: platform={token.platform}, user_id={token.user_id}")

    # Проверяем кеш
    cached_result = token_validation_cache.get(token.user_id, token.platform)
    if cached_result is not None:
        return cached_result

    try:
        import httpx
        from core.token_encryption import decrypt_token
        # Use TokenRefreshService for auto-refresh logic
        from services.token_refresh_service import TokenRefreshService
        from core.database import SessionLocal # Need a session for refresh if needed

        # Расшифровываем токен если он зашифрован
        access_token = decrypt_token(token.access_token) if token.access_token else None

        if not access_token:
            logger.warning(f"No access token for {token.platform}")
            token_validation_cache.set(token.user_id, token.platform, False)
            return False

        # Проверяем истек ли токен по времени (если expires_at существует)
        if token.expires_at and token.expires_at < utcnow_naive():
            logger.warning(f"Token for {token.platform} expired at {token.expires_at}, attempting auto-refresh...")
            
            refreshed = await TokenRefreshService.refresh_if_needed(token.user_id, token.platform)
            if refreshed:
                logger.info(f"[OK] {token.platform.upper()} token auto-refreshed (expired state)")
                token_validation_cache.invalidate(token.user_id, token.platform)
                return True
            else:
                logger.error(f"[ERROR] Failed to auto-refresh expired {token.platform} token")
                token_validation_cache.set(token.user_id, token.platform, False)
                return False

        # Валидация через API платформы
        is_valid = False

        if token.platform == 'twitch':
            async with httpx.AsyncClient(timeout=TOKEN_VALIDATION_TIMEOUT) as client:
                try:
                    response = await client.get(
                        "https://id.twitch.tv/oauth2/validate",
                        headers={"Authorization": f"OAuth {access_token}"}
                    )
                    if response.status_code == 200:
                        is_valid = True
                    elif response.status_code == 401:
                        logger.warning("[WARN] Twitch token expired (401), attempting refresh...")
                        is_valid = await TokenRefreshService.refresh_on_401(token.user_id, 'twitch')
                    else:
                        logger.warning(f"[WARN] Twitch token validation failed: {response.status_code}")
                        is_valid = False
                except Exception as e:
                    logger.warning(f"[WARN] Twitch validation network error: {e}")
                    is_valid = True # Fail open on network error

        elif token.platform == 'vk':
            # VK Validation (using dev endpoint as in original code)
            from core.config import settings
            ssl_verify = settings.is_production
            async with httpx.AsyncClient(timeout=TOKEN_VALIDATION_TIMEOUT, verify=ssl_verify) as client:
                try:
                    response = await client.get(
                        "https://apidev.live.vkvideo.ru/v1/current_user",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    if response.status_code == 200:
                        is_valid = True
                    elif response.status_code == 401:
                         logger.warning("[WARN] VK token expired (401), attempting refresh...")
                         is_valid = await TokenRefreshService.refresh_on_401(token.user_id, 'vk')
                    else:
                         is_valid = False
                except Exception as e:
                    logger.warning(f"[WARN] VK validation error: {e}")
                    is_valid = False

        elif token.platform == 'donationalerts':
            async with httpx.AsyncClient(timeout=TOKEN_VALIDATION_TIMEOUT) as client:
                try:
                    response = await client.get(
                        "https://www.donationalerts.com/api/v1/user/oauth",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    if response.status_code == 200:
                        is_valid = True
                    elif response.status_code == 401:
                         logger.warning("[WARN] DA token expired (401), attempting refresh...")
                         is_valid = await TokenRefreshService.refresh_on_401(token.user_id, 'donationalerts')
                    else:
                        is_valid = False
                except Exception as e:
                     logger.warning(f"[WARN] DA validation error: {e}")
                     is_valid = False
        else:
            # Unknown platform
            is_valid = False

        # Кешируем и возвращаем
        if is_valid:
             # Если рефреш произошел, то токен изменился в БД, но наш current 'access_token' variable устарел.
             # Однако мы просто возвращаем True. Caller должен заново запросить токен из БД если ему нужен access_token.
             token_validation_cache.invalidate(token.user_id, token.platform)
        else:
             token_validation_cache.set(token.user_id, token.platform, False)
             
        return is_valid

    except Exception as e:
        logger.error(f"Error validating token for {token.platform}: {e}", exc_info=True)
        token_validation_cache.set(token.user_id, token.platform, False)
        return False
