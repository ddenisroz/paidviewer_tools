# utils/blocked_bot_cache.py
"""Кешированные проверки заблокированных ботов для оптимизации"""
import logging
from typing import Set
from sqlalchemy.orm import Session
from core.database import BlockedBot
from utils.cache import get_cached, invalidate_cache

logger = logging.getLogger(__name__)

# TTL для кеша заблокированных ботов (10 минут - боты редко меняются)
TTL_BLOCKED_BOTS = 600


def get_blocked_bots_set_cached(db: Session) -> Set[str]:
    """
    Получить множество имен заблокированных ботов (с кешированием)
    
    Args:
        db: Сессия БД
    
    Returns:
        Set[str]: Множество имен заблокированных ботов в нижнем регистре
    """
    def _load_blocked_bots():
        """Внутренняя функция для загрузки ботов из БД"""
        bots = db.query(BlockedBot.bot_name).all()
        return {bot.bot_name.lower() for bot in bots}
    
    cache_key = "blocked_bots:set"
    return get_cached(cache_key, _load_blocked_bots, db, ttl=TTL_BLOCKED_BOTS)


def is_bot_blocked_cached(bot_name: str, db: Session) -> bool:
    """
    Проверить, заблокирован ли бот (с кешированием)
    
    Args:
        bot_name: Имя бота
        db: Сессия БД
    
    Returns:
        True если бот заблокирован, False иначе
    """
    blocked_bots = get_blocked_bots_set_cached(db)
    return bot_name.lower() in blocked_bots


def invalidate_blocked_bots_cache():
    """Инвалидировать кеш заблокированных ботов"""
    invalidate_cache("blocked_bots:set")
    logger.debug("Blocked bots cache invalidated")

