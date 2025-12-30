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
    
    Whitelist используется для доступа к:
    - F5-TTS (AI озвучка)
    - Кастомным голосам
    
    Базовая Google TTS доступна всем авторизованным пользователям без whitelist.
    
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
            twitch_username_lower = user.twitch_username.lower()
            twitch_whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == twitch_username_lower,
                WhitelistedChannel.platform == 'twitch'
            ).first()
            if twitch_whitelisted:
                logger.debug(f"[OK] User {user.id} whitelisted on Twitch: {twitch_username_lower}")
                return True

        # Проверяем по VK username
        if user.vk_username:
            vk_username_lower = user.vk_username.lower()
            vk_whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == vk_username_lower,
                WhitelistedChannel.platform == 'vk'
            ).first()
            if vk_whitelisted:
                logger.debug(f"[OK] User {user.id} whitelisted on VK (username): {vk_username_lower}")
                return True

        # Проверяем по vk_channel_name
        if user.vk_channel_name:
            vk_channel_lower = user.vk_channel_name.lower()
            vk_whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == vk_channel_lower,
                WhitelistedChannel.platform == 'vk'
            ).first()
            if vk_whitelisted:
                logger.debug(f"[OK] User {user.id} whitelisted on VK (channel_name): {vk_channel_lower}")
                return True

        logger.debug(f"[INFO] User {user.id} NOT in whitelist (twitch: {user.twitch_username}, vk: {user.vk_username})")
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


def invalidate_whitelist_cache(channel_name: Optional[str] = None, platform: Optional[str] = None, db: Optional[Session] = None):
    """
    Инвалидировать кеш whitelist
    
    Args:
        channel_name: Имя канала (опционально, если None - инвалидирует весь whitelist кеш)
        platform: Платформа (опционально)
        db: Сессия БД (опционально, для поиска пользователей с этим username)
    """
    if channel_name:
        channel_name_lower = channel_name.lower()
        # Инвалидируем кеш для канала (whitelist_channel:...)
        pattern = f"whitelist_channel:{channel_name_lower}:{platform or ''}"
        invalidate_cache(pattern)

        # ВАЖНО: Также инвалидируем кеш пользователей, которые могут иметь этот username
        # Ключ кеша пользователя: whitelist:{user.id}:{twitch_username}:{vk_username}
        if db:
            # Находим всех пользователей с этим username и инвалидируем их кеш точно
            try:
                from core.database import User
                users_with_username = db.query(User).filter(
                    (User.twitch_username.ilike(channel_name_lower)) |
                    (User.vk_username.ilike(channel_name_lower)) |
                    (User.vk_channel_name.ilike(channel_name_lower))
                ).all()

                for u in users_with_username:
                    # Инвалидируем точный ключ для каждого пользователя
                    cache_key = f"whitelist:{u.id}:{u.twitch_username or ''}:{u.vk_username or ''}"
                    invalidate_cache(cache_key)
                    logger.debug(f"Invalidated whitelist cache for user {u.id}")
            except Exception as e:
                logger.warning(f"Error invalidating user cache: {e}, falling back to pattern matching")
                # Fallback: инвалидируем по паттерну
                invalidate_cache(f":{channel_name_lower}:")
                invalidate_cache(f":{channel_name_lower}")
        else:
            # Fallback: инвалидируем все ключи содержащие этот username (менее точно, но работает)
            invalidate_cache(f":{channel_name_lower}:")  # Инвалидируем все ключи содержащие этот username
            invalidate_cache(f":{channel_name_lower}")  # На случай если username в конце
            invalidate_cache(channel_name_lower)  # Инвалидируем все ключи содержащие этот username
    else:
        # Инвалидируем весь whitelist кеш
        invalidate_cache("whitelist")

