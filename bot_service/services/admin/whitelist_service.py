# bot_service/services/admin/whitelist_service.py
"""
Сервис управления белым списком каналов.
"""

import logging
from typing import List

from sqlalchemy.orm import Session

from core.database import WhitelistedChannel
from models.pydantic_models import (
    WhitelistedChannelPublic,
    AddToWhitelistRequest,
    WhitelistResponse,
)

logger = logging.getLogger(__name__)


class WhitelistService:
    """Сервис для управления белым списком каналов."""

    async def get_whitelist(self, db: Session) -> WhitelistResponse:
        """Получить список каналов в whitelist."""
        channels = db.query(WhitelistedChannel).all()
        return WhitelistResponse(
            whitelist_users=[
                WhitelistedChannelPublic.model_validate(ch) for ch in channels
            ]
        )

    async def add_to_whitelist(
        self, request: AddToWhitelistRequest, db: Session
    ) -> dict:
        """Добавить канал в whitelist."""
        username = request.username.lower()

        existing = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == username
        ).first()

        if existing:
            logger.warning(f"[WARN] WHITELIST: Channel '{username}' already exists")
            return {"message": f"User {username} is already in whitelist"}

        channel = WhitelistedChannel(channel_name=username)
        db.add(channel)
        db.commit()

        logger.info(f"[OK] WHITELIST: Channel '{username}' added")
        return {"message": f"User {username} added to whitelist"}

    async def remove_from_whitelist(
        self, request: AddToWhitelistRequest, db: Session
    ) -> dict:
        """Удалить канал из whitelist."""
        username = request.username.lower()

        channel = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == username
        ).first()

        if not channel:
            logger.warning(f"[WARN] WHITELIST: Channel '{username}' not found")
            return {"message": f"User {username} not found in whitelist"}

        db.delete(channel)
        db.commit()

        logger.info(f"[DELETE] WHITELIST: Channel '{username}' removed")
        return {"message": f"User {username} removed from whitelist"}


# Singleton instance
whitelist_service = WhitelistService()
