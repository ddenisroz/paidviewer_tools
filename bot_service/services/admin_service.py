# bot_service/services/admin_service.py
"""
Административный API - фасад для админ-сервисов.

Рефакторинг: логика разделена на отдельные сервисы:
- WhitelistService
- BlockedBotsService
- UserManagementService
- BotControlService
- LogsService

Этот класс сохранен для обратной совместимости.
"""

import logging
from typing import List

from sqlalchemy.orm import Session

from models.pydantic_models import (
    WhitelistedChannelPublic,
    AddToWhitelistRequest,
    WhitelistResponse,
    BlockedBotPublic,
    AddBlockedBotRequest,
    UserPublic
)
from .admin import (
    whitelist_service,
    blocked_bots_service,
    user_management_service,
    bot_control_service,
    logs_service,
)

logger = logging.getLogger(__name__)


class AdminAPI:
    """
    Фасад для административных операций.
    
    Делегирует вызовы специализированным сервисам.
    Сохранен для обратной совместимости с существующим кодом.
    """

    def __init__(self):
        pass

    # === Whitelist ===

    async def get_whitelist(self, db: Session) -> WhitelistResponse:
        """Получить список пользователей в whitelist."""
        return await whitelist_service.get_whitelist(db)

    async def add_to_whitelist(self, request: AddToWhitelistRequest, db: Session) -> dict:
        """Добавить пользователя в whitelist."""
        return await whitelist_service.add_to_whitelist(request, db)

    async def remove_from_whitelist(self, request: AddToWhitelistRequest, db: Session) -> dict:
        """Удалить пользователя из whitelist."""
        return await whitelist_service.remove_from_whitelist(request, db)

    # === Blocked Bots ===

    async def get_blocked_bots(self, db: Session) -> List[BlockedBotPublic]:
        """Получить список заблокированных ботов."""
        return await blocked_bots_service.get_blocked_bots(db)

    async def add_blocked_bot(self, request: AddBlockedBotRequest, db: Session) -> dict:
        """Добавить бота в список заблокированных."""
        return await blocked_bots_service.add_blocked_bot(request, db)

    async def remove_blocked_bot(self, bot_name: str, db: Session) -> dict:
        """Удалить бота из списка заблокированных."""
        return await blocked_bots_service.remove_blocked_bot(bot_name, db)

    # === Users ===

    async def get_users(self, db: Session) -> List[UserPublic]:
        """Получить список всех пользователей."""
        return await user_management_service.get_users(db)

    async def update_user(self, user_id: int, request: dict, db: Session) -> dict:
        """Обновить пользователя."""
        return await user_management_service.update_user(user_id, request, db)

    async def delete_user(self, user_id: int, db: Session) -> dict:
        """Удалить пользователя."""
        return await user_management_service.delete_user(user_id, db)

    async def block_user(self, user_id: int, request: dict, db: Session) -> dict:
        """Заблокировать пользователя."""
        return await user_management_service.block_user(user_id, request, db)

    async def unblock_user(self, user_id: int, db: Session) -> dict:
        """Разблокировать пользователя."""
        return await user_management_service.unblock_user(user_id, db)

    # === Bot Control ===

    async def get_bots_status(self, connection_manager=None) -> dict:
        """Получить статус всех ботов."""
        return await bot_control_service.get_bots_status()

    async def restart_bot(self, bot_name: str) -> dict:
        """Перезапустить бота."""
        return await bot_control_service.restart_bot(bot_name)

    async def restart_tts_engine(self) -> dict:
        """Перезагрузить TTS движок."""
        return await bot_control_service.restart_tts_engine()

    async def restart_bot_service(self) -> dict:
        """Перезагрузить весь Bot Service."""
        # Перезапускаем всех ботов
        await bot_control_service.restart_bot("twitch_bot")
        await bot_control_service.restart_bot("vk_live_bot")
        return {"message": "Bot Service restarted successfully"}

    # === Logs ===

    async def get_bots_logs(self) -> dict:
        """Получить логи ботов."""
        return await logs_service.get_bots_logs()

    async def get_system_logs(
        self, level: str = None, search: str = None, limit: int = 100
    ) -> dict:
        """Получить системные логи с фильтрацией."""
        return await logs_service.get_system_logs(level, search, limit)

    async def export_system_logs(self, level: str = None, search: str = None) -> dict:
        """Экспортировать системные логи."""
        return await logs_service.export_system_logs(level, search)
