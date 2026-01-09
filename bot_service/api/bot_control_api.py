# bot_service/api/bot_control_api.py
"""
API endpoints для управления ботами.

Refactored to use BotControlService and UserRepository.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging

from auth.auth import get_current_user
from core.database import get_db
from services.bot_control_service import BotControlService
from repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["bot-control"])

def get_bot_control_service():
    return BotControlService()

@router.get("/bot/status")
async def get_bot_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    bot_service: BotControlService = Depends(get_bot_control_service)
):
    """Получить статус бота"""
    try:
        user_id = user.get("id")
        user_repo = UserRepository(db)
        user_record = user_repo.get_by_id(user_id)
        
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")

        return bot_service.get_bot_status(user_id, user_record)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting bot status: {e}")
        return {"connected": False, "error": str(e)}

@router.post("/chat/connect")
async def connect_chat(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    bot_service: BotControlService = Depends(get_bot_control_service)
):
    """Подключить чат-бота"""
    try:
        user_id = user.get("id")
        logger.info(f"Chat connect requested by user {user_id}")
        
        user_repo = UserRepository(db)
        user_record = user_repo.get_by_id(user_id)

        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")

        return bot_service.connect_chat(user_id, user_record)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting chat: {e}")
        return {"success": False, "error": str(e)}

@router.post("/chat/disconnect")
async def disconnect_chat(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    bot_service: BotControlService = Depends(get_bot_control_service)
):
    """Отключить чат-бота"""
    try:
        user_id = user.get("id")
        logger.info(f"Chat disconnect requested by user {user_id}")

        user_repo = UserRepository(db)
        user_record = user_repo.get_by_id(user_id)
        
        if not user_record:
             raise HTTPException(status_code=404, detail="User not found")

        return bot_service.disconnect_chat(user_id, user_record)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting chat: {e}")
        return {"success": False, "error": str(e)}

@router.get("/chat/status")
async def get_chat_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    bot_service: BotControlService = Depends(get_bot_control_service)
):
    """Получить статус чата"""
    try:
        user_id = user.get("id")
        
        user_repo = UserRepository(db)
        user_record = user_repo.get_by_id(user_id)
        
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")

        return bot_service.get_chat_status(user_id, user_record)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat status: {e}")
        return {"connected": False, "error": str(e)}

@router.post("/chat/reconnect")
async def reconnect_chat(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    bot_service: BotControlService = Depends(get_bot_control_service)
):
    """Переподключить чат-бота"""
    try:
        user_id = user.get("id")
        logger.info(f"Chat reconnect requested by user {user_id}")
        
        user_repo = UserRepository(db)
        user_record = user_repo.get_by_id(user_id)
        
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")

        return bot_service.reconnect_chat(user_id, user_record)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reconnecting chat: {e}")
        return {"success": False, "error": str(e)}

