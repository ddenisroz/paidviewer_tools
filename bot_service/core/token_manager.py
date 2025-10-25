# bot_service/core/token_manager.py
"""
УНИВЕРСАЛЬНЫЙ МЕНЕДЖЕР ТОКЕНОВ
Единая точка входа для получения токенов пользователей
"""
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from core.token_utils import get_user_token_from_db

logger = logging.getLogger(__name__)


class TokenManager:
    """
    Универсальный менеджер для работы с токенами пользователей.
    
    Проверяет только is_active флаг токена.
    Безопасность через деактивацию токенов при новом логине.
    """
    
    @staticmethod
    def get_user_token(
        user_id: int,
        platform: str,
        session_id: Optional[str] = None,
        require_session_check: bool = False,
        db: Session = None
    ) -> Optional[str]:
        """
        Получить access token пользователя для указанной платформы.
        
        Args:
            user_id: ID пользователя
            platform: Платформа ('twitch', 'vk', 'donationalerts')
            session_id: НЕ используется (для обратной совместимости)
            require_session_check: НЕ используется (для обратной совместимости)
            db: Database session (опционально, для предотвращения race conditions)
        
        Returns:
            str: Access token или None (если токен не найден или is_active=False)
        """
        try:
            logger.debug(f"📦 [TOKEN MANAGER] Getting token for user {user_id}, platform {platform}")
            tokens = get_user_token_from_db(user_id, platform, db)
            
            if not tokens:
                logger.warning(f"❌ [TOKEN MANAGER] No token found for user {user_id}, platform {platform}")
                return None
            
            if not tokens.get("access_token"):
                logger.warning(f"❌ [TOKEN MANAGER] Token exists but access_token is empty for user {user_id}, platform {platform}")
                return None
            
            logger.debug(f"✅ [TOKEN MANAGER] Token retrieved for user {user_id}, platform {platform}")
            return tokens["access_token"]
            
        except Exception as e:
            logger.error(f"❌ [TOKEN MANAGER] Error getting token for user {user_id}, platform {platform}: {e}")
            return None
    
    @staticmethod
    def get_user_token_data(
        user_id: int,
        platform: str,
        session_id: Optional[str] = None,
        require_session_check: bool = False,
        db: Session = None
    ) -> Optional[Dict[str, Any]]:
        """
        Получить полные данные токена (не только access_token).
        
        Args:
            user_id: ID пользователя
            platform: Платформа
            session_id: НЕ используется
            require_session_check: НЕ используется
            db: Database session (опционально, для предотвращения race conditions)
        
        Returns:
            dict: Данные токена (platform_user_id, access_token, refresh_token, expires_at, etc.)
        """
        try:
            logger.debug(f"📦 [TOKEN MANAGER] Getting token DATA for user {user_id}, platform {platform}")
            return get_user_token_from_db(user_id, platform, db)
            
        except Exception as e:
            logger.error(f"❌ [TOKEN MANAGER] Error getting token data for user {user_id}, platform {platform}: {e}")
            return None


# Singleton instance
token_manager = TokenManager()

