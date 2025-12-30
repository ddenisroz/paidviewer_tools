# bot_service/startup/__init__.py
"""
Модуль инициализации приложения.

Содержит:
- bot_registry: Singleton для управления ботами
- bot_initializer: Инициализация Twitch/VK ботов
- lifespan: Lifecycle events (startup/shutdown)
- services_init: Инициализация сервисов
"""

from .bot_registry import BotRegistry, get_bot_registry
from .bot_initializer import initialize_twitch_bot, initialize_vk_bot, initialize_all_bots
from .lifespan import lifespan

__all__ = [
    "BotRegistry",
    "get_bot_registry",
    "initialize_twitch_bot",
    "initialize_vk_bot",
    "initialize_all_bots",
    "lifespan",
]
