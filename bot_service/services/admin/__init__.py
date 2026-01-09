# bot_service/services/admin/__init__.py
"""
Модуль административных сервисов.

Разделение AdminAPI на отдельные сервисы по принципу единственной ответственности:
- whitelist_service: управление белым списком каналов
- blocked_bots_service: управление заблокированными ботами
- user_management_service: управление пользователями
- bot_control_service: управление ботами (restart, status)
- logs_service: работа с логами
- stats_service: статистика для dashboard
"""

from .whitelist_service import WhitelistService
from .blocked_bots_service import BlockedBotsService
from .user_management_service import UserManagementService
from .bot_control_service import BotControlService
from .logs_service import LogsService
from .stats_service import AdminStatsService, get_admin_stats_service

# Singleton instances
whitelist_service = WhitelistService()
blocked_bots_service = BlockedBotsService()
user_management_service = UserManagementService()
bot_control_service = BotControlService()
logs_service = LogsService()

__all__ = [
    "WhitelistService",
    "BlockedBotsService",
    "UserManagementService",
    "BotControlService",
    "LogsService",
    "AdminStatsService",
    "get_admin_stats_service",
    "whitelist_service",
    "blocked_bots_service",
    "user_management_service",
    "bot_control_service",
    "logs_service",
]
