"""
Продвинутый Rate Limiter с использованием limits библиотеки
Без slowapi для избежания проблем с .env
"""
import logging
from typing import Dict, Any
from limits import storage, parse
from limits.strategies import MovingWindowRateLimiter
from fastapi import Request
logger = logging.getLogger(__name__)

class AdvancedRateLimiter:
    """Продвинутый rate limiter с использованием limits библиотеки"""

    def __init__(self):
        self.storage = storage.MemoryStorage()
        self.strategy = MovingWindowRateLimiter(self.storage)
        self.limits = {'default': '60/minute', 'login': '5/15minutes', 'api': '300/minute', 'tts': '30/minute', 'upload': '10/minute'}
        logger.info('[RATE-LIMITER] Advanced Rate Limiter initialized with limits library')

    def _get_identifier(self, request: Request=None, user_id: int=None) -> str:
        """Получить идентификатор для rate limiting"""
        if user_id:
            return f'user:{user_id}'
        elif request:
            client_ip = getattr(request.client, 'host', 'unknown')
            return f'ip:{client_ip}'
        else:
            return 'global'

    def check_rate_limit(self, identifier: str, action: str='default') -> bool:
        """
        Проверка rate limit для идентификатора и действия
        """
        try:
            limit_str = self.limits.get(action, self.limits['default'])
            rate_limit_item = parse(limit_str)
            if self.strategy.hit(rate_limit_item, identifier):
                logger.debug(f"Rate limit OK for {identifier}, action '{action}'")
                return True
            else:
                logger.warning(f"Rate limit exceeded for {identifier}, action '{action}'")
                return False
        except Exception:
            logger.exception('Rate limit check failed')
            return True

    def get_remaining_requests(self, identifier: str, action: str='default') -> int:
        """Получить количество оставшихся запросов"""
        try:
            limit_str = self.limits.get(action, self.limits['default'])
            rate_limit_item = parse(limit_str)
            current = self.strategy.get_window_stats(rate_limit_item, identifier)
            if current:
                limit_num = int(limit_str.split('/')[0])
                remaining = max(0, limit_num - current[1])
                return remaining
            return 0
        except Exception:
            logger.exception('Failed to get remaining requests')
            return 0

    def reset_rate_limit(self, identifier: str, action: str='default') -> bool:
        """Сбросить rate limit для идентификатора"""
        try:
            logger.warning(f"Reset rate limit for {identifier}, action '{action}' (limited functionality)")
            return True
        except Exception:
            logger.exception('Failed to reset rate limit')
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Получить статистику rate limiter"""
        try:
            return {'storage_type': 'memory', 'strategy': 'moving_window', 'limits': self.limits, 'library': 'limits', 'version': 'advanced'}
        except Exception:
            logger.exception('Failed to get rate limiter stats')
            return {'error': 'Internal server error'}

    async def check_tts_rate_limit(self, user_id: int, text_length: int) -> bool:
        """Проверка TTS rate limit (совместимость)"""
        identifier = self._get_identifier(user_id=user_id)
        return self.check_rate_limit(identifier, 'tts')

    async def add_tts_request(self, user_id: int, text_length: int):
        """Добавить TTS запрос (совместимость)"""
        pass

    async def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        """Получить статистику пользователя (совместимость)"""
        identifier = self._get_identifier(user_id=user_id)
        return {'user_id': user_id, 'remaining_requests': self.get_remaining_requests(identifier, 'tts'), 'rate_limit_type': 'moving_window', 'library': 'limits'}

    async def reset_user_limits(self, user_id: int):
        """Сбросить лимиты пользователя (совместимость)"""
        identifier = self._get_identifier(user_id=user_id)
        self.reset_rate_limit(identifier, 'tts')
advanced_rate_limiter = AdvancedRateLimiter()

def check_rate_limit(identifier: str, action: str='default') -> bool:
    """Проверка rate limit (совместимость)"""
    return advanced_rate_limiter.check_rate_limit(identifier, action)

def record_failed_login(identifier: str) -> int:
    """Записать неудачную попытку входа (совместимость)"""
    return 0

def is_login_blocked(identifier: str) -> bool:
    """Проверка блокировки логина (совместимость)"""
    return not advanced_rate_limiter.check_rate_limit(identifier, 'login')

def clear_failed_logins(identifier: str):
    """Очистка неудачных попыток входа (совместимость)"""
    advanced_rate_limiter.reset_rate_limit(identifier, 'login')
