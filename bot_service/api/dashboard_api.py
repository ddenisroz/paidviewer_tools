# bot_service/api/dashboard_api.py
"""
Dashboard API - Batch endpoint для инициализации дашборда.
Объединяет несколько запросов в один для оптимизации производительности.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from core.database import get_db, User, UserToken, ChatMessage, TTSUserSettings, AudioSettings
from auth.auth import get_current_user, get_current_user_optional
from core.token_utils import validate_platform_token
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/init")
async def get_dashboard_init(
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
) -> JSONResponse:
    """
    Batch endpoint для инициализации дашборда.
    
    Возвращает все необходимые данные одним запросом:
    - user: информация о пользователе
    - integrations: статус интеграций (Twitch, VK, DonationAlerts)
    - tts: настройки TTS
    - chat_history: последние сообщения чата (50)
    
    Это заменяет 4-6 отдельных запросов при загрузке главной страницы.
    """
    try:
        # Если пользователь не авторизован
        if not current_user:
            return JSONResponse(content={
                "success": True,
                "user": None,
                "integrations": {},
                "tts": None,
                "chat_history": []
            })
        
        user_id = current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        # Получаем пользователя из БД
        db_user = db.query(User).filter(User.id == user_id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # 1. User data
        user_data = {
            "id": db_user.id,
            "twitch_username": db_user.twitch_username,
            "vk_username": db_user.vk_username,
            "vk_channel_name": db_user.vk_channel_name,
            "is_admin": db_user.is_admin,
            "created_at": db_user.created_at.isoformat() if db_user.created_at else None
        }
        
        # 2. Integrations
        integrations = await _get_integrations(user_id, db_user, db)
        
        # 3. TTS settings
        tts_data = _get_tts_settings(user_id, db)
        
        # 4. Chat history (последние 50 сообщений)
        chat_history = _get_chat_history(user_id, db_user, db, limit=50)
        
        logger.info(f"[OK] [DASHBOARD] Init data loaded for user {user_id}")
        
        return JSONResponse(content={
            "success": True,
            "user": user_data,
            "integrations": integrations,
            "tts": tts_data,
            "chat_history": chat_history
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ERROR] [DASHBOARD] Error loading init data: {e}", exc_info=True)
        return JSONResponse(
            content={"success": False, "error": str(e)},
            status_code=500
        )


async def _get_integrations(user_id: int, db_user: User, db: Session) -> Dict[str, Any]:
    """Получить статус интеграций пользователя."""
    integrations = {}
    
    try:
        user_tokens = db.query(UserToken).filter(UserToken.user_id == user_id).all()
        
        for token in user_tokens:
            if token.access_token:
                # Валидация токена
                is_valid = await validate_platform_token(token)
                
                if is_valid:
                    platform = token.platform
                    username = None
                    
                    if platform == "twitch":
                        username = db_user.twitch_username
                    elif platform == "vk":
                        username = db_user.vk_username
                    elif platform == "donationalerts":
                        username = getattr(db_user, 'donationalerts_username', None)
                    
                    integrations[platform] = {
                        "connected": True,
                        "enabled": True,
                        "username": username,
                        "platform_user_id": token.platform_user_id,
                        "avatar_url": token.avatar_url
                    }
    except Exception as e:
        logger.error(f"[ERROR] [DASHBOARD] Error getting integrations: {e}")
    
    return integrations


def _get_tts_settings(user_id: int, db: Session) -> Optional[Dict[str, Any]]:
    """Получить настройки TTS пользователя."""
    try:
        tts_settings = db.query(TTSUserSettings).filter(
            TTSUserSettings.user_id == user_id
        ).first()
        
        if not tts_settings:
            return {
                "enabled": False,
                "enabled_platforms": [],
                "global_enabled": False
            }
        
        # Получаем audio settings
        audio_settings = db.query(AudioSettings).filter(
            AudioSettings.user_id == user_id
        ).first()
        
        return {
            "enabled": tts_settings.enabled if hasattr(tts_settings, 'enabled') else False,
            "enabled_platforms": tts_settings.enabled_platforms if hasattr(tts_settings, 'enabled_platforms') else [],
            "global_enabled": tts_settings.global_enabled if hasattr(tts_settings, 'global_enabled') else False,
            "volume": audio_settings.volume if audio_settings and hasattr(audio_settings, 'volume') else 50,
            "voice_id": tts_settings.voice_id if hasattr(tts_settings, 'voice_id') else None
        }
    except Exception as e:
        logger.error(f"[ERROR] [DASHBOARD] Error getting TTS settings: {e}")
        return None


def _get_chat_history(user_id: int, db_user: User, db: Session, limit: int = 50) -> List[Dict[str, Any]]:
    """Получить историю чата пользователя."""
    try:
        # Определяем канал
        channel = db_user.twitch_username or db_user.vk_username
        if not channel:
            return []
        
        # Получаем сообщения
        messages = db.query(ChatMessage).filter(
            ChatMessage.user_id == user_id,
            func.lower(ChatMessage.channel_name) == channel.lower(),
            ChatMessage.is_deleted.is_(False)
        ).order_by(ChatMessage.timestamp.desc()).limit(limit).all()
        
        # Преобразуем в формат для фронтенда
        import json
        messages_data = []
        for msg in reversed(messages):
            badges_list = getattr(msg, 'badges', None)
            if isinstance(badges_list, str):
                try:
                    badges_list = json.loads(badges_list)
                except:
                    badges_list = None
            
            messages_data.append({
                "id": msg.id,
                "author": getattr(msg, 'author_username', None) or 'unknown',
                "author_name": getattr(msg, 'author_username', None) or 'unknown',
                "content": msg.message,
                "message": msg.message,
                "platform": msg.platform,
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                "channel": msg.channel_name,
                "role": getattr(msg, 'role', None),
                "badges": badges_list
            })
        
        return messages_data
    except Exception as e:
        logger.error(f"[ERROR] [DASHBOARD] Error getting chat history: {e}")
        return []
