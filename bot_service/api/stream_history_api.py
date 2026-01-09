# bot_service/api/stream_history_api.py
"""
API для истории стримов.
Clean Architecture: uses ChatMessageRepository for data access.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user
from repositories.chat_message_repository import ChatMessageRepository
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stream", tags=["stream"])


def _message_to_dict(msg) -> dict:
    """Convert message to dict for response."""
    return {
        'id': msg.id,
        'channel_name': msg.channel_name,
        'platform': msg.platform,
        'viewer_name': getattr(msg, 'viewer_name', 'unknown'),
        'message': msg.message,
        'timestamp': msg.timestamp.isoformat() if msg.timestamp else None,
        'is_tts_enabled': getattr(msg, 'is_tts_enabled', False),
        'tts_processed': getattr(msg, 'tts_processed', False)
    }


@router.get("/history")
async def get_stream_history(
    page: int = 1,
    limit: int = 100,
    channel_name: str = None,
    platform: str = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить историю стримов/сообщений"""
    try:
        repo = ChatMessageRepository(db)
        
        try:
            messages, total_messages = repo.get_paginated(
                channel_name=channel_name,
                platform=platform,
                page=page,
                limit=limit
            )
        except Exception as db_error:
            logger.warning(f"[WARN] Database error: {db_error}")
            return {"success": False, "error": "Database error"}

        return {
            "success": True,
            "messages": [_message_to_dict(msg) for msg in messages],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_messages,
                "pages": (total_messages + limit - 1) // limit
            }
        }
    except Exception as e:
        logger.error(f"Error getting stream history: {e}")
        return {"success": False, "error": str(e)}


@router.get("/stats")
async def get_stream_stats(
    channel_name: str = None,
    platform: str = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статистику стрима"""
    try:
        repo = ChatMessageRepository(db)
        stats = repo.get_stats(channel_name=channel_name, platform=platform)
        
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Error getting stream stats: {e}")
        return {"success": False, "error": str(e)}

