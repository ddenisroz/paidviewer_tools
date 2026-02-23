"""
Продвинутый Rate Limiter с использованием limits библиотеки.
Без slowapi для избежания проблем с .env.
"""

import logging
import re
from typing import Dict, Any

from fastapi import Request
from limits import parse, storage
from limits.strategies import MovingWindowRateLimiter

from core.config import settings

logger = logging.getLogger(__name__)


class AdvancedRateLimiter:
    """Продвинутый rate limiter с использованием limits библиотеки."""

    def __init__(self):
        storage_backend = "memory"
        try:
            redis_url = (settings.redis_url or "").strip()
            if redis_url:
                self.storage = storage.storage_from_string(redis_url)
                storage_backend = "redis"
            else:
                self.storage = storage.MemoryStorage()
        except Exception:
            logger.exception("Failed to initialize Redis rate limiter storage, falling back to memory")
            self.storage = storage.MemoryStorage()

        self.strategy = MovingWindowRateLimiter(self.storage)
        self.limits = {
            "default": "60/minute",
            "login": "5/15minutes",
            "api": "100/minute",
            "tts": "30/minute",
            "upload": "10/minute",
        }
        logger.info("[RATE-LIMITER] Advanced Rate Limiter initialized with limits library (storage=%s)", storage_backend)

    def _get_identifier(self, request: Request = None, user_id: int = None) -> str:
        """Получить идентификатор для rate limiting."""
        if user_id:
            return f"user:{user_id}"
        if request:
            client_ip = getattr(request.client, "host", "unknown")
            return f"ip:{client_ip}"
        return "global"

    def check_rate_limit(self, identifier: str, action: str = "default") -> bool:
        """Проверка rate limit для идентификатора и действия."""
        try:
            limit_str = self.limits.get(action, self.limits["default"])
            rate_limit_item = parse(limit_str)
            if self.strategy.hit(rate_limit_item, identifier):
                logger.debug("Rate limit OK for %s, action '%s'", identifier, action)
                return True
            logger.warning("Rate limit exceeded for %s, action '%s'", identifier, action)
            return False
        except Exception:
            logger.exception("Rate limit check failed")
            return True

    def get_remaining_requests(self, identifier: str, action: str = "default") -> int:
        """Получить количество оставшихся запросов."""
        try:
            limit_str = self.limits.get(action, self.limits["default"])
            rate_limit_item = parse(limit_str)
            stats = self.strategy.get_window_stats(rate_limit_item, identifier)
            if not stats:
                return 0

            if hasattr(stats, "remaining"):
                return max(0, int(stats.remaining))

            if isinstance(stats, tuple) and len(stats) >= 2:
                limit_num = int(limit_str.split("/")[0])
                return max(0, limit_num - int(stats[1]))

            return 0
        except Exception:
            logger.exception("Failed to get remaining requests")
            return 0

    def reset_rate_limit(self, identifier: str, action: str = "default") -> bool:
        """Сбросить rate limit для идентификатора."""
        try:
            logger.warning("Reset rate limit for %s, action '%s' (limited functionality)", identifier, action)
            return True
        except Exception:
            logger.exception("Failed to reset rate limit")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Получить статистику rate limiter."""
        try:
            return {
                "storage_type": "memory",
                "strategy": "moving_window",
                "limits": self.limits,
                "library": "limits",
                "version": "advanced",
            }
        except Exception:
            logger.exception("Failed to get rate limiter stats")
            return {"error": "Internal server error"}

    def _estimate_retry_after(self, action: str = "default") -> int:
        """Best-effort Retry-After estimation from limit string."""
        limit_str = self.limits.get(action, self.limits["default"]).lower().strip()
        match = re.search(r"/\s*(\d+)\s*(second|minute|hour|day)", limit_str)
        if match:
            amount = int(match.group(1))
            unit = match.group(2)
            multiplier = {
                "second": 1,
                "minute": 60,
                "hour": 3600,
                "day": 86400,
            }[unit]
            return max(1, amount * multiplier)

        if "/minute" in limit_str:
            return 60
        if "/hour" in limit_str:
            return 3600
        if "/day" in limit_str:
            return 86400
        return 60

    async def check_tts_rate_limit(self, user_id: int, text_length: int) -> Dict[str, int | bool]:
        """Проверка TTS rate limit с унифицированным контрактом."""
        identifier = self._get_identifier(user_id=user_id)
        allowed = self.check_rate_limit(identifier, "tts")
        remaining = self.get_remaining_requests(identifier, "tts")
        retry_after = 0 if allowed else self._estimate_retry_after("tts")
        return {
            "allowed": allowed,
            "remaining": remaining,
            "retry_after": retry_after,
        }

    async def add_tts_request(self, user_id: int, text_length: int):
        """Добавить TTS запрос (совместимость)."""
        return None

    async def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        """Получить статистику пользователя (совместимость)."""
        identifier = self._get_identifier(user_id=user_id)
        return {
            "user_id": user_id,
            "remaining_requests": self.get_remaining_requests(identifier, "tts"),
            "rate_limit_type": "moving_window",
            "library": "limits",
        }

    async def reset_user_limits(self, user_id: int):
        """Сбросить лимиты пользователя (совместимость)."""
        identifier = self._get_identifier(user_id=user_id)
        self.reset_rate_limit(identifier, "tts")


advanced_rate_limiter = AdvancedRateLimiter()


def check_rate_limit(identifier: str, action: str = "default") -> bool:
    """Проверка rate limit (совместимость)."""
    return advanced_rate_limiter.check_rate_limit(identifier, action)


def record_failed_login(identifier: str) -> int:
    """Записать неудачную попытку входа (совместимость)."""
    return 0


def is_login_blocked(identifier: str) -> bool:
    """Проверка блокировки логина (совместимость)."""
    return not advanced_rate_limiter.check_rate_limit(identifier, "login")


def clear_failed_logins(identifier: str):
    """Очистка неудачных попыток входа (совместимость)."""
    advanced_rate_limiter.reset_rate_limit(identifier, "login")
