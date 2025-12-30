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

    logger.info(f"[DEBUG] VALIDATE_TOKEN START: platform={token.platform}, user_id={token.user_id}")

    # Проверяем кеш
    cached_result = token_validation_cache.get(token.user_id, token.platform)
    if cached_result is not None:
        logger.info(f"[START] [CACHE HIT] Token validation for user {token.user_id}, platform {token.platform}: {cached_result}")
        return cached_result

    try:
        import httpx
        from core.token_encryption import decrypt_token

        # Расшифровываем токен если он зашифрован
        access_token = decrypt_token(token.access_token) if token.access_token else None

        if not access_token:
            logger.warning(f"No access token for {token.platform}")
            is_valid = False
            token_validation_cache.set(token.user_id, token.platform, is_valid)
            return is_valid

        # Проверяем истек ли токен по времени
        if token.expires_at and token.expires_at < utcnow_naive():
            logger.warning(f"Token for {token.platform} expired at {token.expires_at}, attempting auto-refresh...")

            # Пытаемся автоматически обновить токен
            if token.platform == 'twitch':
                from api.twitch_api import TwitchAPI
                from services.memory_websocket_manager import memory_websocket_manager
                twitch_api = TwitchAPI(memory_websocket_manager)
                refresh_success = await twitch_api._refresh_user_token(token.user_id)

                if refresh_success:
                    logger.info(f"[OK] {token.platform.upper()} token auto-refreshed (expired)")
                    # Инвалидируем кеш и возвращаем True
                    token_validation_cache.invalidate(token.user_id, token.platform)
                    return True
                else:
                    logger.error(f"[ERROR] Failed to auto-refresh expired {token.platform} token")
                    is_valid = False
                    token_validation_cache.set(token.user_id, token.platform, is_valid)
                    return is_valid

            elif token.platform == 'vk':
                from api.vk_api import VKLiveAPI
                vk_api = VKLiveAPI()
                new_access_token = await vk_api._refresh_user_token(token.user_id)

                if new_access_token:
                    logger.info(f"[OK] {token.platform.upper()} token auto-refreshed (expired)")
                    token_validation_cache.invalidate(token.user_id, token.platform)
                    return True
                else:
                    logger.error(f"[ERROR] Failed to auto-refresh expired {token.platform} token")
                    is_valid = False
                    token_validation_cache.set(token.user_id, token.platform, is_valid)
                    return is_valid
            else:
                # Для других платформ без refresh - возвращаем False
                is_valid = False
                token_validation_cache.set(token.user_id, token.platform, is_valid)
                return is_valid

        # Валидация через API платформы
        is_valid = False

        if token.platform == 'twitch':
            async with httpx.AsyncClient(timeout=TOKEN_VALIDATION_TIMEOUT) as client:
                try:
                    logger.debug(f"[DEBUG] Validating Twitch token for user {token.user_id}, token length: {len(access_token) if access_token else 0}")
                    response = await client.get(
                        "https://id.twitch.tv/oauth2/validate",
                        headers={"Authorization": f"OAuth {access_token}"}
                    )
                    if response.status_code == 200:
                        logger.info(f"[OK] Twitch token valid for user {token.user_id}")
                        is_valid = True
                    elif response.status_code == 401:
                        logger.warning("[WARN] Twitch token expired or invalid, attempting refresh...")

                        # Пытаемся обновить токен через refresh_token
                        from api.twitch_api import TwitchAPI
                        from services.memory_websocket_manager import memory_websocket_manager
                        twitch_api = TwitchAPI(memory_websocket_manager)
                        refresh_success = await twitch_api._refresh_user_token(token.user_id)

                        if refresh_success:
                            logger.info("[OK] Twitch token successfully auto-refreshed!")
                            is_valid = True
                            # Инвалидируем кеш чтобы при следующей проверке взять свежий токен
                            token_validation_cache.invalidate(token.user_id, 'twitch')
                        else:
                            logger.error("[ERROR] Failed to refresh Twitch token")
                            is_valid = False
                    else:
                        response_text = await response.text()
                        logger.warning(f"[WARN] Twitch token validation failed: status={response.status_code}, response={response_text}")
                        is_valid = False
                except Exception as e:
                    logger.warning(f"[WARN] Twitch token validation network error: {type(e).__name__}: {str(e)}")
                    # При сетевых ошибках считаем токен валидным (не можем проверить)
                    is_valid = True

        elif token.platform == 'vk':
            logger.info("[DEBUG] Validating VK Live token via API...")

            async with httpx.AsyncClient(timeout=TOKEN_VALIDATION_TIMEOUT, verify=False) as client:
                try:
                    # Используем dev API (только он доступен, SSL verification отключена)
                    response = await client.get(
                        "https://apidev.live.vkvideo.ru/v1/current_user",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )

                    if response.status_code == 200:
                        logger.info("[OK] VK Live token is valid")
                        is_valid = True
                    elif response.status_code == 401:
                        logger.warning("[WARN] VK Live token expired or invalid, attempting refresh...")

                        # Пытаемся обновить токен через refresh_token
                        from api.vk_api import VKLiveAPI
                        vk_api = VKLiveAPI()
                        new_access_token = await vk_api._refresh_user_token(token.user_id)

                        if new_access_token:
                            logger.info("[OK] VK token successfully auto-refreshed!")
                            is_valid = True
                        else:
                            logger.error("[ERROR] Failed to refresh VK token")
                            is_valid = False
                    else:
                        logger.warning(f"[ERROR] VK Live token validation failed: status={response.status_code}")
                        is_valid = False

                except Exception as e:
                    logger.error(f"[ERROR] Error validating VK token: {e}")
                    is_valid = False

        elif token.platform == 'donationalerts':
            async with httpx.AsyncClient(timeout=TOKEN_VALIDATION_TIMEOUT) as client:
                response = await client.get(
                    "https://www.donationalerts.com/api/v1/user/oauth",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                is_valid = response.status_code == 200

        else:
            logger.warning(f"Unknown platform for token validation: {token.platform}")
            is_valid = False

        # Кешируем результат
        token_validation_cache.set(token.user_id, token.platform, is_valid)
        logger.info(f"[OK] VALIDATE_TOKEN END: platform={token.platform}, user_id={token.user_id}, valid={is_valid}")
        return is_valid

    except Exception as e:
        logger.error(f"Error validating token for {token.platform}: {e}", exc_info=True)
        # Кешируем ошибку как невалидный токен
        is_valid = False
        token_validation_cache.set(token.user_id, token.platform, is_valid)
        return is_valid
