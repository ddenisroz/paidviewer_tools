# bot_service/services/admin/blocked_bots_service.py
"""
Сервис управления заблокированными ботами.
"""

import logging
from typing import List

from sqlalchemy.orm import Session

from core.database import BlockedBot
from models.pydantic_models import BlockedBotPublic, AddBlockedBotRequest

logger = logging.getLogger(__name__)


class BlockedBotsService:
    """Сервис для управления списком заблокированных ботов."""

    async def get_blocked_bots(self, db: Session) -> List[BlockedBotPublic]:
        """Получить список заблокированных ботов."""
        bots = db.query(BlockedBot).all()
        return [BlockedBotPublic.model_validate(bot) for bot in bots]

    async def add_blocked_bot(
        self, request: AddBlockedBotRequest, db: Session
    ) -> dict:
        """Добавить бота в список заблокированных."""
        bot_name = request.bot_name.lower()

        existing = db.query(BlockedBot).filter(
            BlockedBot.bot_name == bot_name
        ).first()

        if existing:
            return {"message": f"Bot {bot_name} is already blocked"}

        bot = BlockedBot(bot_name=bot_name)
        db.add(bot)
        db.commit()

        logger.info(f"[OK] Bot {bot_name} added to blocked list")
        return {"message": f"Bot {bot_name} added to blocked list"}

    async def remove_blocked_bot(self, bot_name: str, db: Session) -> dict:
        """Удалить бота из списка заблокированных."""
        bot_name = bot_name.lower()

        bot = db.query(BlockedBot).filter(
            BlockedBot.bot_name == bot_name
        ).first()

        if not bot:
            return {"message": f"Bot {bot_name} not found in blocked list"}

        db.delete(bot)
        db.commit()

        logger.info(f"[DELETE] Bot {bot_name} removed from blocked list")
        return {"message": f"Bot {bot_name} removed from blocked list"}


# Singleton instance
blocked_bots_service = BlockedBotsService()
