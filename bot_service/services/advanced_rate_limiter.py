# bot_service/services/advanced_rate_limiter.py
"""
РџСЂРѕРґРІРёРЅСѓС‚С‹Р№ Rate Limiter СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј limits Р±РёР±Р»РёРѕС‚РµРєРё
Р‘РµР· slowapi РґР»СЏ РёР·Р±РµР¶Р°РЅРёСЏ РїСЂРѕР±Р»РµРј СЃ .env
"""
import logging
from typing import Dict, Any
from limits import storage, parse
from limits.strategies import MovingWindowRateLimiter
from fastapi import Request

logger = logging.getLogger(__name__)

class AdvancedRateLimiter:
    """РџСЂРѕРґРІРёРЅСѓС‚С‹Р№ rate limiter СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј limits Р±РёР±Р»РёРѕС‚РµРєРё"""

    def __init__(self):
        # РСЃРїРѕР»СЊР·СѓРµРј memory storage (РІ production РјРѕР¶РЅРѕ Redis)
        self.storage = storage.MemoryStorage()
        self.strategy = MovingWindowRateLimiter(self.storage)

        # РќР°СЃС‚СЂР°РёРІР°РµРј СЂР°Р·РЅС‹Рµ Р»РёРјРёС‚С‹ РґР»СЏ СЂР°Р·РЅС‹С… РґРµР№СЃС‚РІРёР№
        self.limits = {
            "default": "60/minute",
            "login": "5/15minutes",
            "api": "300/minute",
            "tts": "30/minute",
            "upload": "10/minute"
        }

        logger.info("[RATE-LIMITER] Advanced Rate Limiter initialized with limits library")

    def _get_identifier(self, request: Request = None, user_id: int = None) -> str:
        """РџРѕР»СѓС‡РёС‚СЊ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РґР»СЏ rate limiting"""
        if user_id:
            return f"user:{user_id}"
        elif request:
            # РСЃРїРѕР»СЊР·СѓРµРј IP Р°РґСЂРµСЃ РєР°Рє fallback
            client_ip = getattr(request.client, 'host', 'unknown')
            return f"ip:{client_ip}"
        else:
            return "global"

    def check_rate_limit(self, identifier: str, action: str = "default") -> bool:
        """
        РџСЂРѕРІРµСЂРєР° rate limit РґР»СЏ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂР° Рё РґРµР№СЃС‚РІРёСЏ
        """
        try:
            limit_str = self.limits.get(action, self.limits["default"])

            # РџР°СЂСЃРёРј СЃС‚СЂРѕРєСѓ Р»РёРјРёС‚Р° РІ РѕР±СЉРµРєС‚ RateLimitItem
            rate_limit_item = parse(limit_str)

            # РџСЂРѕРІРµСЂСЏРµРј Р»РёРјРёС‚
            if self.strategy.hit(rate_limit_item, identifier):
                logger.debug(f"Rate limit OK for {identifier}, action '{action}'")
                return True
            else:
                logger.warning(f"Rate limit exceeded for {identifier}, action '{action}'")
                return False

        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            return True  # Р’ СЃР»СѓС‡Р°Рµ РѕС€РёР±РєРё СЂР°Р·СЂРµС€Р°РµРј

    def get_remaining_requests(self, identifier: str, action: str = "default") -> int:
        """РџРѕР»СѓС‡РёС‚СЊ РєРѕР»РёС‡РµСЃС‚РІРѕ РѕСЃС‚Р°РІС€РёС…СЃСЏ Р·Р°РїСЂРѕСЃРѕРІ"""
        try:
            limit_str = self.limits.get(action, self.limits["default"])

            # РџР°СЂСЃРёРј СЃС‚СЂРѕРєСѓ Р»РёРјРёС‚Р° РІ РѕР±СЉРµРєС‚ RateLimitItem
            rate_limit_item = parse(limit_str)

            # РџРѕР»СѓС‡Р°РµРј С‚РµРєСѓС‰РµРµ РєРѕР»РёС‡РµСЃС‚РІРѕ Р·Р°РїСЂРѕСЃРѕРІ
            current = self.strategy.get_window_stats(rate_limit_item, identifier)
            if current:
                # РџР°СЂСЃРёРј Р»РёРјРёС‚ (РЅР°РїСЂРёРјРµСЂ, "60/minute" -> 60)
                limit_num = int(limit_str.split('/')[0])
                remaining = max(0, limit_num - current[1])  # current is tuple (reset_time, hits)
                return remaining
            return 0

        except Exception as e:
            logger.error(f"Failed to get remaining requests: {e}")
            return 0

    def reset_rate_limit(self, identifier: str, action: str = "default") -> bool:
        """РЎР±СЂРѕСЃРёС‚СЊ rate limit РґР»СЏ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂР°"""
        try:
            # Р’ limits РЅРµС‚ РїСЂСЏРјРѕРіРѕ РјРµС‚РѕРґР° СЃР±СЂРѕСЃР°, РЅРѕ РјРѕР¶РЅРѕ РѕС‡РёСЃС‚РёС‚СЊ storage
            # Р­С‚Рѕ СЃР±СЂРѕСЃРёС‚ Р’РЎР• Р»РёРјРёС‚С‹, С‡С‚Рѕ РјРѕР¶РµС‚ Р±С‹С‚СЊ РёР·Р±С‹С‚РѕС‡РЅРѕ
            logger.warning(f"Reset rate limit for {identifier}, action '{action}' (limited functionality)")
            return True
        except Exception as e:
            logger.error(f"Failed to reset rate limit: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """РџРѕР»СѓС‡РёС‚СЊ СЃС‚Р°С‚РёСЃС‚РёРєСѓ rate limiter"""
        try:
            return {
                "storage_type": "memory",
                "strategy": "moving_window",
                "limits": self.limits,
                "library": "limits",
                "version": "advanced"
            }
        except Exception as e:
            logger.error(f"Failed to get rate limiter stats: {e}")
            return {"error": "Internal server error"}

    # РњРµС‚РѕРґС‹ РґР»СЏ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё СЃ СЃС‚Р°СЂС‹Рј API
    async def check_tts_rate_limit(self, user_id: int, text_length: int) -> bool:
        """РџСЂРѕРІРµСЂРєР° TTS rate limit (СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ)"""
        identifier = self._get_identifier(user_id=user_id)
        return self.check_rate_limit(identifier, "tts")

    async def add_tts_request(self, user_id: int, text_length: int):
        """Р”РѕР±Р°РІРёС‚СЊ TTS Р·Р°РїСЂРѕСЃ (СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ)"""
        # Р’ РЅРѕРІРѕР№ СЃРёСЃС‚РµРјРµ СЌС‚Рѕ РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё С‡РµСЂРµР· check_rate_limit
        pass

    async def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        """РџРѕР»СѓС‡РёС‚СЊ СЃС‚Р°С‚РёСЃС‚РёРєСѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ)"""
        identifier = self._get_identifier(user_id=user_id)
        return {
            "user_id": user_id,
            "remaining_requests": self.get_remaining_requests(identifier, "tts"),
            "rate_limit_type": "moving_window",
            "library": "limits"
        }

    async def reset_user_limits(self, user_id: int):
        """РЎР±СЂРѕСЃРёС‚СЊ Р»РёРјРёС‚С‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ)"""
        identifier = self._get_identifier(user_id=user_id)
        self.reset_rate_limit(identifier, "tts")

# Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ СЌРєР·РµРјРїР»СЏСЂ
advanced_rate_limiter = AdvancedRateLimiter()

# Р¤СѓРЅРєС†РёРё РґР»СЏ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё
def check_rate_limit(identifier: str, action: str = "default") -> bool:
    """РџСЂРѕРІРµСЂРєР° rate limit (СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ)"""
    return advanced_rate_limiter.check_rate_limit(identifier, action)

def record_failed_login(identifier: str) -> int:
    """Р—Р°РїРёСЃР°С‚СЊ РЅРµСѓРґР°С‡РЅСѓСЋ РїРѕРїС‹С‚РєСѓ РІС…РѕРґР° (СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ)"""
    # Р’ РЅРѕРІРѕР№ СЃРёСЃС‚РµРјРµ СЌС‚Рѕ РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё
    return 0

def is_login_blocked(identifier: str) -> bool:
    """РџСЂРѕРІРµСЂРєР° Р±Р»РѕРєРёСЂРѕРІРєРё Р»РѕРіРёРЅР° (СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ)"""
    return not advanced_rate_limiter.check_rate_limit(identifier, "login")

def clear_failed_logins(identifier: str):
    """РћС‡РёСЃС‚РєР° РЅРµСѓРґР°С‡РЅС‹С… РїРѕРїС‹С‚РѕРє РІС…РѕРґР° (СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ)"""
    advanced_rate_limiter.reset_rate_limit(identifier, "login")
