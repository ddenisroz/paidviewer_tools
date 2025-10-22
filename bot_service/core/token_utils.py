# bot_service/core/token_utils.py
"""
Утилиты для работы с токенами пользователей
"""
from core.database import get_db, UserToken
from typing import Optional, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def get_user_token_from_db(user_id: int, platform: str) -> Optional[Dict[str, Any]]:
    """
    Получить токен пользователя из базы данных
    
    Args:
        user_id: ID пользователя
        platform: Платформа ('twitch', 'vk', 'donationalerts')
        
    Returns:
        dict: Информация о токене или None если не найден
    """
    from core.token_encryption import decrypt_token
    
    db = next(get_db())
    try:
        token = db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.platform == platform
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
        db.close()

async def validate_platform_token(token) -> bool:
    """
    Валидация токена через API платформы
    
    Args:
        token: UserToken объект
        
    Returns:
        bool: True если токен валиден, False если нет
    """
    logger.info(f"🔍 VALIDATE_TOKEN START: platform={token.platform}, user_id={token.user_id}")
    
    try:
        import httpx
        from core.token_encryption import decrypt_token
        
        # Расшифровываем токен если он зашифрован
        access_token = decrypt_token(token.access_token) if token.access_token else None
        
        if not access_token:
            logger.warning(f"No access token for {token.platform}")
            return False
        
        # Проверяем истек ли токен по времени
        if token.expires_at and token.expires_at < datetime.utcnow():
            logger.warning(f"Token for {token.platform} expired at {token.expires_at}")
            return False
        
        # Валидация через API платформы
        if token.platform == 'twitch':
            async with httpx.AsyncClient(timeout=10.0) as client:
                try:
                    logger.debug(f"🔍 Validating Twitch token for user {token.user_id}, token length: {len(access_token) if access_token else 0}")
                    response = await client.get(
                        "https://id.twitch.tv/oauth2/validate",
                        headers={"Authorization": f"OAuth {access_token}"}
                    )
                    if response.status_code == 200:
                        logger.info(f"✅ Twitch token valid for user {token.user_id}")
                        return True
                    else:
                        response_text = await response.text()
                        logger.warning(f"⚠️ Twitch token validation failed: status={response.status_code}, response={response_text}")
                        # Не удаляем токен сразу, возможно это временная проблема
                        return False
                except Exception as e:
                    logger.warning(f"⚠️ Twitch token validation network error: {type(e).__name__}: {str(e)}")
                    # При сетевых ошибках считаем токен валидным (не можем проверить)
                    return True
                
        elif token.platform == 'vk':
            logger.info(f"🔍 Validating VK Live token via API...")
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                try:
                    response = await client.get(
                        "https://apidev.live.vkvideo.ru/v1/current_user",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    
                    if response.status_code == 200:
                        logger.info(f"✅ VK Live token is valid")
                        return True
                    elif response.status_code == 401:
                        logger.warning(f"⚠️ VK Live token expired or invalid, attempting refresh...")
                        
                        # Пытаемся обновить токен через refresh_token
                        from api.vk_api import VKLiveAPI
                        vk_api = VKLiveAPI()
                        new_access_token = await vk_api._refresh_user_token(token.user_id)
                        
                        if new_access_token:
                            logger.info("✅ VK token successfully auto-refreshed!")
                            return True
                        else:
                            logger.error("❌ Failed to refresh VK token")
                            return False
                    else:
                        logger.warning(f"❌ VK Live token validation failed: status={response.status_code}")
                        return False
                        
                except Exception as e:
                    logger.error(f"❌ Error validating VK token: {e}")
                    return False
                
        elif token.platform == 'donationalerts':
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://www.donationalerts.com/api/v1/user/oauth",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                return response.status_code == 200
                
        else:
            logger.warning(f"Unknown platform for token validation: {token.platform}")
            return False
            
    except Exception as e:
        logger.error(f"Error validating token for {token.platform}: {e}", exc_info=True)
        return False
