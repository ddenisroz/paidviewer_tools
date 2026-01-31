"""
User Cache with TTL and Invalidation

Кеширует данные пользователей из БД для производительности,
но с коротким TTL и возможностью инвалидации.
"""
import logging
from datetime import datetime, timedelta
from core.datetime_utils import utcnow_naive
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from threading import Lock

logger = logging.getLogger(__name__)


class UserCache:
    """
    Кеш данных пользователей с TTL и инвалидацией.
    
    Принципы:
    - Single Source of Truth = БД
    - Кеш = оптимизация производительности
    - TTL = 5 минут (баланс между производительностью и актуальностью)
    - Инвалидация = мгновенное применение изменений
    """

    def __init__(self, ttl_minutes: int = 5):
        self.cache: Dict[int, tuple[Dict[str, Any], datetime]] = {}
        self.ttl = timedelta(minutes=ttl_minutes)
        self.lock = Lock()
        logger.info(f"UserCache initialized with TTL={ttl_minutes} minutes")

    def get(self, user_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """
        Получить данные пользователя (из кеша или БД).
        
        Args:
            user_id: ID пользователя
            db: Database session
            
        Returns:
            Dict с данными пользователя или None если не найден
        """
        # Проверяем кеш
        with self.lock:
            if user_id in self.cache:
                data, expires_at = self.cache[user_id]
                if utcnow_naive() < expires_at:
                    logger.debug(f"Cache HIT for user {user_id}")
                    return data
                else:
                    logger.debug(f"Cache EXPIRED for user {user_id}")
                    del self.cache[user_id]

        # Загружаем из БД
        logger.debug(f"Cache MISS for user {user_id}, loading from DB")
        return self._load_from_db(user_id, db)

    def _load_from_db(self, user_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """Загрузить данные пользователя из БД и закешировать"""
        from core.database import User

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"User {user_id} not found in DB")
            return None

        # Формируем данные для кеша
        data = {
            'id': user.id,
            'role': user.role,
            'is_admin': user.role == 'admin',  # Вычисляемое поле
            'is_active': user.is_active,
            'is_blocked': user.is_blocked,
            'blocked_reason': user.blocked_reason,
            'twitch_username': user.twitch_username,
            'vk_username': user.vk_username,
            'vk_channel_name': user.vk_channel_name,
            'donationalerts_user_id': user.donationalerts_user_id,
            'tts_enabled': user.tts_enabled,
            # Platform roles
            'twitch_is_broadcaster': user.twitch_is_broadcaster,
            'twitch_is_moderator': user.twitch_is_moderator,
            'twitch_is_vip': user.twitch_is_vip,
            'twitch_is_subscriber': user.twitch_is_subscriber,
            'vk_is_owner': user.vk_is_owner,
            'vk_is_moderator': user.vk_is_moderator,
        }

        # Сохраняем в кеш
        with self.lock:
            expires_at = utcnow_naive() + self.ttl
            self.cache[user_id] = (data, expires_at)
            logger.debug(f"Cached user {user_id} until {expires_at}")

        return data

    def invalidate(self, user_id: int):
        """
        Инвалидировать кеш для пользователя.
        
        Вызывать при:
        - Изменении роли
        - Блокировке/разблокировке
        - Изменении username
        - Любых других изменениях данных пользователя
        
        Args:
            user_id: ID пользователя
        """
        with self.lock:
            if user_id in self.cache:
                del self.cache[user_id]
                logger.info(f"[OK] Cache invalidated for user {user_id}")
            else:
                logger.debug(f"Cache invalidation skipped for user {user_id} (not in cache)")

    def invalidate_all(self):
        """Инвалидировать весь кеш (для экстренных случаев)"""
        with self.lock:
            count = len(self.cache)
            self.cache.clear()
            logger.warning(f"[WARN] Invalidated ALL cache ({count} users)")

    def get_stats(self) -> Dict[str, Any]:
        """Получить статистику кеша"""
        with self.lock:
            return {
                'cached_users': len(self.cache),
                'ttl_minutes': self.ttl.total_seconds() / 60
            }


# Глобальный экземпляр кеша
user_cache = UserCache(ttl_minutes=5)
