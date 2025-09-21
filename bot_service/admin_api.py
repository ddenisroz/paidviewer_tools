# bot_service/admin_api.py
import logging
from typing import List
from sqlalchemy.orm import Session
from bot_service.database import User, WhitelistedChannel, BlockedBot
from bot_service.models import (
    WhitelistedChannelPublic, 
    AddToWhitelistRequest, 
    WhitelistResponse,
    BlockedBotPublic,
    AddBlockedBotRequest,
    UserPublic
)

logger = logging.getLogger(__name__)

class AdminAPI:
    def __init__(self):
        pass

    async def get_whitelist(self, db: Session) -> WhitelistResponse:
        """Получить список пользователей в whitelist"""
        whitelist_users = db.query(WhitelistedChannel).all()
        return WhitelistResponse(
            whitelist_users=[WhitelistedChannelPublic.from_orm(user) for user in whitelist_users]
        )

    async def add_to_whitelist(self, request: AddToWhitelistRequest, db: Session) -> dict:
        """Добавить пользователя в whitelist"""
        username = request.username.lower()
        
        # Проверяем, не добавлен ли уже
        existing = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == username
        ).first()
        
        if existing:
            return {"message": f"User {username} is already in whitelist"}
        
        # Добавляем в whitelist
        whitelist_user = WhitelistedChannel(
            channel_name=username,
            platform="twitch"
        )
        db.add(whitelist_user)
        db.commit()
        
        logger.info(f"User {username} added to whitelist")
        return {"message": f"User {username} added to whitelist"}

    async def remove_from_whitelist(self, request: AddToWhitelistRequest, db: Session) -> dict:
        """Удалить пользователя из whitelist"""
        username = request.username.lower()
        
        whitelist_user = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == username
        ).first()
        
        if not whitelist_user:
            return {"message": f"User {username} not found in whitelist"}
        
        db.delete(whitelist_user)
        db.commit()
        
        logger.info(f"User {username} removed from whitelist")
        return {"message": f"User {username} removed from whitelist"}

    async def get_blocked_bots(self, db: Session) -> List[BlockedBotPublic]:
        """Получить список заблокированных ботов"""
        blocked_bots = db.query(BlockedBot).all()
        return [BlockedBotPublic.from_orm(bot) for bot in blocked_bots]

    async def add_blocked_bot(self, request: AddBlockedBotRequest, db: Session) -> dict:
        """Добавить бота в список заблокированных"""
        bot_name = request.bot_name.lower()
        
        # Проверяем, не заблокирован ли уже
        existing = db.query(BlockedBot).filter(
            BlockedBot.bot_name == bot_name
        ).first()
        
        if existing:
            return {"message": f"Bot {bot_name} is already blocked"}
        
        # Добавляем в список заблокированных
        blocked_bot = BlockedBot(bot_name=bot_name)
        db.add(blocked_bot)
        db.commit()
        
        logger.info(f"Bot {bot_name} added to blocked list")
        return {"message": f"Bot {bot_name} added to blocked list"}

    async def remove_blocked_bot(self, bot_name: str, db: Session) -> dict:
        """Удалить бота из списка заблокированных"""
        bot_name = bot_name.lower()
        
        blocked_bot = db.query(BlockedBot).filter(
            BlockedBot.bot_name == bot_name
        ).first()
        
        if not blocked_bot:
            return {"message": f"Bot {bot_name} not found in blocked list"}
        
        db.delete(blocked_bot)
        db.commit()
        
        logger.info(f"Bot {bot_name} removed from blocked list")
        return {"message": f"Bot {bot_name} removed from blocked list"}

    async def get_users(self, db: Session) -> List[UserPublic]:
        """Получить список всех пользователей"""
        users = db.query(User).all()
        return [UserPublic.from_orm(user) for user in users]
