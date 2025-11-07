# bot_service/core/http_timeouts.py
"""
HTTP timeout константы для внешних API запросов.
Централизованное управление таймаутами предотвращает magic numbers в коде.
"""
import aiohttp

# OAuth endpoints
OAUTH_REQUEST_TIMEOUT = 30.0  # секунд
"""Timeout для OAuth запросов (token exchange, user info)"""

OAUTH_REQUEST_TIMEOUT_OBJ = aiohttp.ClientTimeout(total=30, connect=10)
"""Timeout объект для aiohttp - OAuth запросы"""

# Token validation
TOKEN_VALIDATION_TIMEOUT = 10.0  # секунд
"""Timeout для проверки валидности токенов через API платформ"""

TOKEN_VALIDATION_TIMEOUT_OBJ = aiohttp.ClientTimeout(total=10, connect=5)
"""Timeout объект для aiohttp - валидация токенов"""

# VK Live API (уже определен как aiohttp.ClientTimeout в vk_api.py)
VK_API_TIMEOUT = 15.0  # секунд
"""Timeout для VK Live API запросов (legacy)"""

# Twitch API - уменьшен таймаут чтобы избежать долгих зависаний при сетевых проблемах
TWITCH_API_TIMEOUT = aiohttp.ClientTimeout(total=10, connect=5)
"""Timeout для Twitch API запросов - 10 секунд max (было 30)"""

# DonationAlerts API
DONATIONALERTS_API_TIMEOUT = 15.0  # секунд
"""Timeout для DonationAlerts API запросов"""

DONATIONALERTS_API_TIMEOUT_OBJ = aiohttp.ClientTimeout(total=15, connect=10)
"""Timeout объект для aiohttp - DonationAlerts API"""

# General API
DEFAULT_API_TIMEOUT = aiohttp.ClientTimeout(total=30, connect=10)
"""Дефолтный timeout для API запросов"""

