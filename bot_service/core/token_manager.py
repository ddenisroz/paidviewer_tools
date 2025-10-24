# bot_service/core/token_manager.py
"""
УНИВЕРСАЛЬНЫЙ МЕНЕДЖЕР ТОКЕНОВ
Единая точка входа для получения токенов пользователей
"""
import logging
from typing import Optional, Dict, Any
from core.token_utils import get_user_token_from_db
from utils.token_security import get_user_token_safe

logger = logging.getLogger(__name__)


class TokenManager:
    """
    Универсальный менеджер для работы с токенами пользователей.
    
    Обеспечивает:
    1. Безопасное получение токенов с проверкой linked_platforms
    2. Совместимость с ботами (без session_id)
    3. Единый интерфейс для всех платформ
    """
    
    @staticmethod
    def get_user_token(
        user_id: int,
        platform: str,
        session_id: Optional[str] = None,
        require_session_check: bool = True
    ) -> Optional[str]:
        """
        Получить токен пользователя с опциональной проверкой linked_platforms.
        
        Args:
            user_id: ID пользователя
            platform: Платформа ('twitch', 'vk', 'donationalerts')
            session_id: ID сессии для проверки linked_platforms
            require_session_check: Требовать ли проверку session (для API endpoints = True, для ботов = False)
        
        Returns:
            str: Access token или None
        
        Raises:
            HTTPException 403: Если платформа не в linked_platforms
        """
        try:
            # Если есть session_id И требуется проверка безопасности - используем безопасный метод
            if session_id and require_session_check:
                logger.debug(f"🔐 [TOKEN MANAGER] Using safe token retrieval for user {user_id}, platform {platform}, session {session_id[:8]}...")
                return get_user_token_safe(user_id, platform, session_id)
            
            # Иначе - прямое получение из БД (для ботов и фоновых задач)
            logger.debug(f"📦 [TOKEN MANAGER] Using direct DB retrieval for user {user_id}, platform {platform}")
            tokens = get_user_token_from_db(user_id, platform)
            if tokens and tokens.get("access_token"):
                return tokens["access_token"]
            
            logger.warning(f"❌ [TOKEN MANAGER] No token found for user {user_id}, platform {platform}")
            return None
            
        except Exception as e:
            logger.error(f"❌ [TOKEN MANAGER] Error getting token for user {user_id}, platform {platform}: {e}")
            raise
    
    @staticmethod
    def get_user_token_data(
        user_id: int,
        platform: str,
        session_id: Optional[str] = None,
        require_session_check: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Получить полные данные токена (не только access_token).
        
        Returns:
            dict: Данные токена (platform_user_id, access_token, refresh_token, expires_at, etc.)
        """
        try:
            if session_id and require_session_check:
                # Сначала проверяем безопасность
                access_token = get_user_token_safe(user_id, platform, session_id)
                if not access_token:
                    return None
            
            # Получаем полные данные
            return get_user_token_from_db(user_id, platform)
            
        except Exception as e:
            logger.error(f"❌ [TOKEN MANAGER] Error getting token data for user {user_id}, platform {platform}: {e}")
            raise


# Singleton instance
token_manager = TokenManager()

