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


@router.post("/clear-legacy")
async def clear_legacy_sessions(db: Session = Depends(get_db)):
    """Очистить legacy сессии (test_channel, старые VK ID)"""
    try:
        service = SessionService(db)
        cleared = service.clear_legacy_sessions()
        return {"success": True, "cleared": cleared}
    except Exception as e:
        logger.error(f"Error clearing legacy sessions: {e}")
        return {"success": False, "error": str(e)}


@router.get("/active-channels")
async def get_active_channels(db: Session = Depends(get_db)):
    """Получить список активных каналов"""
    try:
        service = SessionService(db)
        channels = service.get_active_channels()
        
        return {
            "success": True,
            "channels": channels,
            "total": len(channels)
        }
    except Exception as e:
        logger.error(f"Error getting active channels: {e}")
        return {"success": False, "error": str(e)}


@router.get("/active-sessions")
async def get_active_sessions(db: Session = Depends(get_db)):
    """Получить детальную информацию об активных сессиях"""
    try:
        service = SessionService(db)
        sessions = service.get_active_sessions_details()

        return {
            "success": True,
            "sessions": sessions,
            "total_channels": len(sessions)
        }
    except Exception as e:
        logger.error(f"Error getting active sessions: {e}")
        return {"success": False, "error": str(e)}


@router.post("/disconnect/{channel_name}")
async def disconnect_channel(
    channel_name: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Принудительно отключить канал"""
    try:
        # Проверяем права пользователя (только админы)
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")

        service = SessionService(db)
        success = service.disconnect_channel(channel_name, user['id'])

        if success:
            return {"success": True, "message": f"Channel {channel_name} disconnected"}
        else:
            return {"success": False, "message": f"Channel {channel_name} not found"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting channel {channel_name}: {e}")
        return {"success": False, "error": str(e)}


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
        if not user.get('is_admin', False) and user['id'] != user_id:
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
    except Exception as e:
        logger.error(f"Error getting user tokens: {e}")
        return {"success": False, "error": str(e)}


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
             
        if not user.get('is_admin', False) and user['id'] != token_owner_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Выполняем обновление
        # (передаем user_id для доп. проверки внутри сервиса, хотя мы уже проверили)
        success = service.refresh_token(token_id, token_owner_id)

        return {"success": True, "message": "Token refreshed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing token {token_id}: {e}")
        return {"success": False, "error": str(e)}
