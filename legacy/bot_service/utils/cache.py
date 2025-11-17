# utils/cache.py
"""In-memory кеш для оптимизации частых запросов"""
import time
import logging
from functools import wraps
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# Простой in-memory кеш (для продакшена лучше использовать Redis)
_cache: dict[str, tuple[Any, float]] = {}
CACHE_TTL = 300  # 5 минут по умолчанию

# Специальные TTL для разных типов данных
TTL_WHITELIST = 300  # 5 минут для whitelist проверок
TTL_USER_SETTINGS = 180  # 3 минуты для user settings
TTL_USER_DATA = 120  # 2 минуты для user данных


def get_cached(key: str, func: Callable, *args, ttl: Optional[float] = None, **kwargs) -> Any:
    """
    Получить значение из кеша или выполнить функцию и закешировать результат
    
    Args:
        key: Ключ кеша
        func: Функция для выполнения если нет в кеше
        *args, **kwargs: Аргументы для функции
        ttl: Время жизни кеша в секундах (по умолчанию CACHE_TTL)
    
    Returns:
        Результат выполнения функции
    """
    ttl = ttl or CACHE_TTL
    
    # Проверяем кеш
    if key in _cache:
        value, timestamp = _cache[key]
        if time.time() - timestamp < ttl:
            logger.debug(f"Cache HIT: {key}")
            return value
        else:
            # Удаляем устаревший кеш
            del _cache[key]
            logger.debug(f"Cache EXPIRED: {key}")
    
    # Выполняем функцию и кешируем результат
    logger.debug(f"Cache MISS: {key}")
    value = func(*args, **kwargs)
    _cache[key] = (value, time.time())
    
    return value


def invalidate_cache(pattern: Optional[str] = None):
    """
    Инвалидировать кеш по паттерну или полностью
    
    Args:
        pattern: Паттерн для удаления ключей (если None - очистить весь кеш)
    """
    if pattern is None:
        _cache.clear()
        logger.info("Cache cleared")
    else:
        keys_to_delete = [key for key in _cache.keys() if pattern in key]
        for key in keys_to_delete:
            del _cache[key]
        logger.info(f"Cache invalidated for pattern: {pattern}, deleted {len(keys_to_delete)} keys")


def cache_decorator(ttl: Optional[float] = None, key_prefix: str = ""):
    """
    Декоратор для кеширования результатов функции
    
    Args:
        ttl: Время жизни кеша
        key_prefix: Префикс для ключа кеша
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Генерируем ключ кеша из аргументов
            cache_key = f"{key_prefix}:{func.__name__}:{str(args)}:{str(sorted(kwargs.items()))}"
            return get_cached(cache_key, func, *args, ttl=ttl, **kwargs)
        return wrapper
    return decorator


def get_cache_stats() -> dict:
    """Получить статистику кеша"""
    now = time.time()
    active_entries = 0
    expired_entries = 0
    
    for key, (value, timestamp) in _cache.items():
        if now - timestamp < CACHE_TTL:
            active_entries += 1
        else:
            expired_entries += 1
    
    return {
        "total_entries": len(_cache),
        "active_entries": active_entries,
        "expired_entries": expired_entries,
        "cache_size_mb": sum(len(str(v[0])) for v in _cache.values()) / 1024 / 1024
    }

