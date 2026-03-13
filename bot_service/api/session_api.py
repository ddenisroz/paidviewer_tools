# bot_service/api/session_api.py
"""
API для управления сессиями.
Refactored to use SessionService (Clean Architecture).
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from auth.auth import get_current_user
from services.session_service import SessionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _is_admin(user: dict) -> bool:
    """Role-based admin check with legacy compatibility."""
    return user.get("role") == "admin" or bool(user.get("is_admin", False))


@router.get("/active-channels")
async def get_active_channels(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Получить список активных каналов"""
    try:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin access required")
        service = SessionService(db)
        channels = service.get_active_channels()
        
        return {
            "success": True,
            "channels": channels,
            "total": len(channels)
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting active channels")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/active-sessions")
async def get_active_sessions(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Получить детальную информацию об активных сессиях"""
    try:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin access required")
        service = SessionService(db)
        sessions = service.get_active_sessions_details()

        return {
            "success": True,
            "sessions": sessions,
            "total_channels": len(sessions)
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting active sessions")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/disconnect/{channel_name}")
async def disconnect_channel(
    channel_name: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Принудительно отключить канал"""
    try:
        # Проверяем права пользователя (только админы)
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin access required")

        service = SessionService(db)
        success = service.disconnect_channel(channel_name, user['id'])

        if success:
            return {"success": True, "message": f"Channel {channel_name} disconnected"}
        else:
            raise HTTPException(status_code=404, detail=f"Channel {channel_name} not found")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error disconnecting channel %s", channel_name)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user-tokens")
async def get_user_tokens(
    user_id: int = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить токены пользователя"""
    try:
        # Если user_id не указан, используем текущего пользователя
        if user_id is None:
            user_id = user['id']

        # Проверяем права доступа
        if not _is_admin(user) and user['id'] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        service = SessionService(db)
        token_data = service.get_user_tokens(user_id)

        return {
            "success": True,
            "user_id": user_id,
            "tokens": token_data,
            "total": len(token_data)
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting user tokens")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/refresh-token/{token_id}")
async def refresh_token(
    token_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить токен пользователя (обновить timestamp)"""
    try:
        service = SessionService(db)
        
        # Проверка прав доступа
        token_owner_id = service.get_token_owner(token_id)
        if not token_owner_id:
             raise HTTPException(status_code=404, detail="Token not found")
             
        if not _is_admin(user) and user['id'] != token_owner_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Выполняем обновление
        # (передаем user_id для доп. проверки внутри сервиса, хотя мы уже проверили)
        service.refresh_token(token_id, token_owner_id)

        return {"success": True, "message": "Token refreshed successfully"}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error refreshing token %s", token_id)
        raise HTTPException(status_code=500, detail="Internal server error")
