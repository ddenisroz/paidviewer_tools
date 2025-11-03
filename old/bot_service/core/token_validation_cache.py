# bot_service/core/token_validation_cache.py
"""
In-memory кеш для валидации токенов.
Предотвращает избыточные HTTP запросы к API платформ.
"""
import time
import logging
from typing import Dict, Tuple, Optional
from threading import Lock

logger = logging.getLogger(__name__)

class TokenValidationCache:
    """
    Простой thread-safe кеш для результатов валидации токенов.
    
    Использует (user_id, platform) как ключ.
    Хранит (is_valid, timestamp) как значение.
    """
    
    # TTL для кеша в секундах (5 минут)
    DEFAULT_TTL = 300
    
    def __init__(self, ttl: int = DEFAULT_TTL):
        self._cache: Dict[Tuple[int, str], Tuple[bool, float]] = {}
        self._lock = Lock()
        self.ttl = ttl
        logger.info(f"✅ TokenValidationCache initialized with TTL={ttl}s")
    
    def get(self, user_id: int, platform: str) -> Optional[bool]:
        """
        Получить закешированный результат валидации.
        
        Returns:
            bool: Результат валидации или None если нет в кеше/истек
        """
        key = (user_id, platform)
        
        with self._lock:
            if key not in self._cache:
                return None
            
            is_valid, cached_at = self._cache[key]
            age = time.time() - cached_at
            
            # Проверяем TTL
            if age > self.ttl:
                logger.debug(f"🕐 [CACHE] Expired for user {user_id}, platform {platform} (age: {age:.1f}s)")
                del self._cache[key]
                return None
            
            logger.debug(f"✅ [CACHE HIT] user {user_id}, platform {platform}, valid={is_valid}, age={age:.1f}s")
            return is_valid
    
    def set(self, user_id: int, platform: str, is_valid: bool):
        """
        Сохранить результат валидации в кеш.
        """
        key = (user_id, platform)
        
        with self._lock:
            self._cache[key] = (is_valid, time.time())
            logger.debug(f"💾 [CACHE SET] user {user_id}, platform {platform}, valid={is_valid}")
    
    def invalidate(self, user_id: int, platform: str = None):
        """
        Инвалидировать кеш для пользователя.
        
        Args:
            user_id: ID пользователя
            platform: Конкретная платформа или None (все платформы)
        """
        with self._lock:
            if platform:
                # Инвалидировать конкретную платформу
                key = (user_id, platform)
                if key in self._cache:
                    del self._cache[key]
                    logger.debug(f"🗑️ [CACHE INVALIDATE] user {user_id}, platform {platform}")
            else:
                # Инвалидировать все платформы пользователя
                keys_to_delete = [k for k in self._cache.keys() if k[0] == user_id]
                for key in keys_to_delete:
                    del self._cache[key]
                logger.debug(f"🗑️ [CACHE INVALIDATE] user {user_id}, all platforms ({len(keys_to_delete)} entries)")
    
    def clear(self):
        """Очистить весь кеш."""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            logger.info(f"🗑️ [CACHE CLEAR] Cleared {count} entries")
    
    def cleanup_expired(self):
        """
        Удалить истекшие записи из кеша.
        Рекомендуется вызывать периодически в background task.
        """
        now = time.time()
        
        with self._lock:
            expired_keys = [
                key for key, (_, cached_at) in self._cache.items()
                if now - cached_at > self.ttl
            ]
            
            for key in expired_keys:
                del self._cache[key]
            
            if expired_keys:
                logger.info(f"🧹 [CACHE CLEANUP] Removed {len(expired_keys)} expired entries")
    
    def get_stats(self) -> Dict[str, int]:
        """Получить статистику кеша."""
        with self._lock:
            return {
                "total_entries": len(self._cache),
                "ttl_seconds": self.ttl
            }


# Singleton instance
token_validation_cache = TokenValidationCache()

