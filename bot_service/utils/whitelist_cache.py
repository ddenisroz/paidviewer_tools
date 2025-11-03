# utils/whitelist_cache.py
"""Кешированные проверки whitelist для оптимизации"""
import logging
from typing import Optional
from sqlalchemy.orm import Session
from core.database import WhitelistedChannel, User
from utils.cache import get_cached, invalidate_cache, TTL_WHITELIST

logger = logging.getLogger(__name__)


def is_user_whitelisted_cached(user: User, db: Session) -> bool:
    """
    Проверяет, находится ли пользователь в whitelist (с кешированием)
    
    Args:
        user: Объект пользователя из БД
        db: Сессия БД
    
    Returns:
        True если пользователь в whitelist, False иначе
    """
    def _check_whitelist():
        """Внутренняя функция для проверки whitelist"""
        # Проверяем по Twitch username
        if user.twitch_username:
            twitch_whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == user.twitch_username.lower(),
                WhitelistedChannel.platform == 'twitch'
            ).first()
            if twitch_whitelisted:
                return True
        
        # Проверяем по VK username
        if user.vk_username:
            vk_whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == user.vk_username.lower(),
                WhitelistedChannel.platform == 'vk'
            ).first()
            if vk_whitelisted:
                return True
        
        return False
    
    # Генерируем ключ кеша на основе username'ов
    cache_key = f"whitelist:{user.id}:{user.twitch_username or ''}:{user.vk_username or ''}"
    
    return get_cached(cache_key, _check_whitelist, ttl=TTL_WHITELIST)


def is_channel_whitelisted_cached(channel_name: str, platform: str, db: Session) -> bool:
    """
    Проверяет, находится ли канал в whitelist (с кешированием)
    
    Args:
        channel_name: Имя канала
        platform: Платформа ('twitch' или 'vk')
        db: Сессия БД
    
    Returns:
        True если канал в whitelist, False иначе
    """
    def _check_channel():
        """Внутренняя функция для проверки канала"""
        whitelisted = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == channel_name.lower(),
            WhitelistedChannel.platform == platform
        ).first()
        return whitelisted is not None
    
    cache_key = f"whitelist_channel:{channel_name.lower()}:{platform}"
    return get_cached(cache_key, _check_channel, ttl=TTL_WHITELIST)


def invalidate_whitelist_cache(channel_name: Optional[str] = None, platform: Optional[str] = None):
    """
    Инвалидировать кеш whitelist
    
    Args:
        channel_name: Имя канала (опционально, если None - инвалидирует весь whitelist кеш)
        platform: Платформа (опционально)
    """
    if channel_name:
        pattern = f"whitelist_channel:{channel_name.lower()}:{platform or ''}"
        invalidate_cache(pattern)
    else:
        # Инвалидируем весь whitelist кеш
        invalidate_cache("whitelist")

