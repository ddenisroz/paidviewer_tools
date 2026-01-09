# bot_service/services/admin/whitelist_service.py
"""
Сервис управления белым списком каналов.
"""

import logging

from sqlalchemy.orm import Session

from models.pydantic_models import (
    WhitelistedChannelPublic,
    AddToWhitelistRequest,
    WhitelistResponse,
)


from repositories.whitelisted_channel_repository import WhitelistedChannelRepository

logger = logging.getLogger(__name__)


class WhitelistService:
    """Сервис для управления белым списком каналов."""

    async def get_whitelist(self, db: Session) -> WhitelistResponse:
        """Получить список каналов в whitelist."""
        repo = WhitelistedChannelRepository(db)
        channels = repo.get_all()
        return WhitelistResponse(
            whitelist_users=[
                WhitelistedChannelPublic.model_validate(ch) for ch in channels
            ]
        )

    async def add_to_whitelist(
        self, request: AddToWhitelistRequest, db: Session
    ) -> dict:
        """Добавить канал в whitelist."""
        repo = WhitelistedChannelRepository(db)
        username = request.username.lower()

        existing = repo.get_by_name(username)

        if existing:
            logger.warning(f"[WARN] WHITELIST: Channel '{username}' already exists")
            return {"message": f"User {username} is already in whitelist"}

        repo.add_channel(username)

        logger.info(f"[OK] WHITELIST: Channel '{username}' added")
        return {"message": f"User {username} added to whitelist"}

    async def remove_from_whitelist(
        self, request: AddToWhitelistRequest, db: Session
    ) -> dict:
        """Удалить канал из whitelist."""
        repo = WhitelistedChannelRepository(db)
        username = request.username.lower()

        channel = repo.get_by_name(username)

        if not channel:
            logger.warning(f"[WARN] WHITELIST: Channel '{username}' not found")
            return {"message": f"User {username} not found in whitelist"}

        repo.remove_channel(channel)

        logger.info(f"[DELETE] WHITELIST: Channel '{username}' removed")
        return {"message": f"User {username} removed from whitelist"}


# Singleton instance
whitelist_service = WhitelistService()
