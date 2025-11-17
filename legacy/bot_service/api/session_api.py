# bot_service/api/session_api.py
"""API для управления сессиями"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from core.database import get_db, User, UserToken
from core.connection_manager import get_connection_manager
from auth.auth import get_current_user
from datetime import datetime, timedelta
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

@router.post("/clear-legacy")
async def clear_legacy_sessions():
    """Очистить legacy сессии (test_channel, старые VK ID)"""
    try:
        connection_manager = get_connection_manager()
        
        # Удаляем известные legacy сессии из переменных окружения
        legacy_channels_str = os.getenv("LEGACY_CHANNELS", "test_channel,75969278")
        legacy_channels = [channel.strip() for channel in legacy_channels_str.split(",") if channel.strip()]
        for channel in legacy_channels:
            connection_manager.remove_active_session(channel, 'legacy_cleanup')
        
        logger.info(f"Cleared legacy sessions: {legacy_channels}")
        return {"success": True, "cleared": legacy_channels}
    except Exception as e:
        logger.error(f"Error clearing legacy sessions: {e}")
        return {"success": False, "error": str(e)}

@router.get("/active-channels")
async def get_active_channels(db: Session = Depends(get_db)):
    """Получить список активных каналов"""
    try:
        # Получаем список активных каналов из ConnectionManager
        connection_manager = get_connection_manager()
        active_channel_names = connection_manager.get_active_channels()
        channels = []
        
        for channel_name in active_channel_names:
            # Определяем платформу по имени канала (можно улучшить)
            platform = 'twitch'  # По умолчанию Twitch
            if channel_name.isdigit():  # VK ID обычно числовые
                platform = 'vk'
            
            channels.append({
                'channel_name': channel_name,
                'platform': platform,
                'connected_at': None,  # Можно добавить время подключения если нужно
            })
        
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
        active_sessions = connection_manager.get_active_sessions()
        sessions = []
        
        for channel_name, session_ids in active_sessions.items():
            platform = 'twitch'
            if channel_name.isdigit():
                platform = 'vk'
            
            sessions.append({
                'channel_name': channel_name,
                'platform': platform,
                'session_count': len(session_ids),
                'session_ids': list(session_ids)
            })
        
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
        
        # Отключаем канал
        success = connection_manager.remove_active_session(channel_name, 'admin_disconnect')
        
        if success:
            logger.info(f"Admin {user['id']} disconnected channel {channel_name}")
            return {"success": True, "message": f"Channel {channel_name} disconnected"}
        else:
            return {"success": False, "message": f"Channel {channel_name} not found"}
            
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
        
        # Получаем токены из БД
        tokens = db.query(UserToken).filter(UserToken.user_id == user_id).all()
        
        token_data = []
        for token in tokens:
            token_data.append({
                'id': token.id,
                'platform': token.platform,
                'token_type': token.token_type,
                'created_at': token.created_at.isoformat() if token.created_at else None,
                'expires_at': token.expires_at.isoformat() if token.expires_at else None,
                'is_active': getattr(token, 'is_active', True)
            })
        
        return {
            "success": True,
            "user_id": user_id,
            "tokens": token_data,
            "total": len(token_data)
        }
    except Exception as e:
        logger.error(f"Error getting user tokens: {e}")
        return {"success": False, "error": str(e)}

@router.post("/refresh-token/{token_id}")
async def refresh_token(
    token_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить токен пользователя"""
    try:
        # Получаем токен
        token = db.query(UserToken).filter(UserToken.id == token_id).first()
        if not token:
            raise HTTPException(status_code=404, detail="Token not found")
        
        # Проверяем права доступа
        if not user.get('is_admin', False) and user['id'] != token.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Обновляем время создания токена
        token.created_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Token {token_id} refreshed by user {user['id']}")
        return {"success": True, "message": "Token refreshed successfully"}
        
    except Exception as e:
        logger.error(f"Error refreshing token {token_id}: {e}")
        db.rollback()
        return {"success": False, "error": str(e)}
