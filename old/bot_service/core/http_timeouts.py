# bot_service/core/http_timeouts.py
"""
HTTP timeout константы для внешних API запросов.
Централизованное управление таймаутами предотвращает magic numbers в коде.
"""

# OAuth endpoints
OAUTH_REQUEST_TIMEOUT = 30.0  # секунд
"""Timeout для OAuth запросов (token exchange, user info)"""

# Token validation
TOKEN_VALIDATION_TIMEOUT = 10.0  # секунд
"""Timeout для проверки валидности токенов через API платформ"""

# VK Live API
VK_API_TIMEOUT = 15.0  # секунд
"""Timeout для VK Live API запросов"""

# Twitch API
TWITCH_API_TIMEOUT = 15.0  # секунд
"""Timeout для Twitch API запросов"""

# DonationAlerts API
DONATIONALERTS_API_TIMEOUT = 15.0  # секунд
"""Timeout для DonationAlerts API запросов"""

# General API
DEFAULT_API_TIMEOUT = 15.0  # секунд
"""Дефолтный timeout для API запросов"""

