# bot_service/features/youtube/youtube_settings_api.py
"""
API endpoints для настроек YouTube интеграции
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, Literal
import logging

from core.database import get_db, TTSUserSettings, User
from auth.auth import get_current_user

logger = logging.getLogger('bot_service')

# Создаем роутер для YouTube settings
youtube_settings_router = APIRouter(prefix="/api/tts", tags=["youtube-settings"])


class YouTubeSettingsResponse(BaseModel):
    """Response model для настроек YouTube"""
    playback_mode: Literal['browser', 'obs'] = Field(default='browser', description="Режим воспроизведения")
    volume_level: int = Field(default=100, ge=0, le=100, description="Уровень громкости (0-100)")


class YouTubeSettingsUpdate(BaseModel):
    """Request model для обновления настроек YouTube"""
    playback_mode: Optional[Literal['browser', 'obs']] = Field(None, description="Режим воспроизведения")
    volume_level: Optional[int] = Field(None, ge=0, le=100, description="Уровень громкости (0-100)")


@youtube_settings_router.get("/youtube-settings", response_model=YouTubeSettingsResponse)
async def get_youtube_settings(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить настройки YouTube для текущего пользователя
    
    Возвращает:
    - playback_mode: 'browser' или 'obs'
    - volume_level: 0-100
    """
    try:
        user_id = user.get('id')
        
        # Получаем настройки TTS пользователя (там хранятся YouTube настройки)
        tts_settings = db.query(TTSUserSettings).filter(
            TTSUserSettings.user_id == user_id
        ).first()
        
        # Если настроек нет, создаем с дефолтными значениями
        if not tts_settings:
            tts_settings = TTSUserSettings(
                user_id=user_id,
                engine='gtts',
                voice='female_1',
                listening_mode='website'
            )
            db.add(tts_settings)
            db.commit()
            db.refresh(tts_settings)
        
        # Получаем YouTube настройки из JSON поля или используем defaults
        youtube_settings = getattr(tts_settings, 'youtube_settings', None) or {}
        
        return YouTubeSettingsResponse(
            playback_mode=youtube_settings.get('playback_mode', 'browser'),
            volume_level=youtube_settings.get('volume_level', 100)
        )
        
    except Exception as e:
        logger.error(f"Error getting YouTube settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка получения настроек YouTube")


@youtube_settings_router.post("/youtube-settings", response_model=YouTubeSettingsResponse)
async def save_youtube_settings(
    settings: YouTubeSettingsUpdate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Сохранить настройки YouTube для текущего пользователя
    
    Параметры:
    - playback_mode: 'browser' или 'obs' (опционально)
    - volume_level: 0-100 (опционально)
    """
    try:
        user_id = user.get('id')
        
        # Получаем или создаем настройки TTS
        tts_settings = db.query(TTSUserSettings).filter(
            TTSUserSettings.user_id == user_id
        ).first()
        
        if not tts_settings:
            tts_settings = TTSUserSettings(
                user_id=user_id,
                engine='gtts',
                voice='female_1',
                listening_mode='website'
            )
            db.add(tts_settings)
        
        # Получаем текущие YouTube настройки
        youtube_settings = getattr(tts_settings, 'youtube_settings', None) or {}
        
        # Обновляем только переданные поля
        if settings.playback_mode is not None:
            youtube_settings['playback_mode'] = settings.playback_mode
        if settings.volume_level is not None:
            youtube_settings['volume_level'] = settings.volume_level
        
        # Сохраняем обратно
        # Используем setattr для динамического добавления поля
        setattr(tts_settings, 'youtube_settings', youtube_settings)
        
        db.commit()
        db.refresh(tts_settings)
        
        logger.info(f"YouTube settings saved for user {user_id}: {youtube_settings}")
        
        return YouTubeSettingsResponse(
            playback_mode=youtube_settings.get('playback_mode', 'browser'),
            volume_level=youtube_settings.get('volume_level', 100)
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving YouTube settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка сохранения настроек YouTube")


@youtube_settings_router.get("/obs-url")
async def get_obs_url(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить существующий OBS URL для YouTube виджета
    
    Возвращает obs_token из таблицы users
    """
    try:
        user_id = user.get('id')
        
        # Получаем пользователя
        user_record = db.query(User).filter(User.id == user_id).first()
        
        if not user_record:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Возвращаем obs_token если есть
        return {
            "obs_token": user_record.obs_token,
            "has_token": user_record.obs_token is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting OBS URL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка получения OBS URL")
