# bot_service/services/admin/__init__.py
"""
Модуль административных сервисов.

Разделение AdminAPI на отдельные сервисы по принципу единственной ответственности:
- whitelist_service: управление белым списком каналов
- blocked_bots_service: управление заблокированными ботами
- user_management_service: управление пользователями
- bot_control_service: управление ботами (restart, status)
- logs_service: работа с логами
"""

from .whitelist_service import WhitelistService
from .blocked_bots_service import BlockedBotsService
from .user_management_service import UserManagementService
from .bot_control_service import BotControlService
from .logs_service import LogsService

__all__ = [
    "WhitelistService",
    "BlockedBotsService",
    "UserManagementService",
    "BotControlService",
    "LogsService",
]
