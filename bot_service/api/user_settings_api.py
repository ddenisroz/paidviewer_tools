# api/user_settings_api.py
"""
API для управления пользовательскими настройками интерфейса.
Following Clean Architecture - only routing, no business logic.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.database import get_db
from auth.auth import get_current_user
from services.user_settings_service import UserSettingsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user-settings", tags=["user-settings"])


# === Pydantic Models ===

class UserSettingsUpdate(BaseModel):
    """Модель для обновления пользовательских настроек интерфейса"""
    # Настройки чата
    chat_enabled: Optional[bool] = None
    chat_max_messages: Optional[int] = Field(None, ge=1, le=1000)
    chat_show_timestamps: Optional[bool] = None
    chat_show_platform: Optional[bool] = None
    chat_show_user_roles: Optional[bool] = None
    chat_animation_duration: Optional[int] = Field(None, ge=100, le=5000)
    chat_animation_type: Optional[str] = Field(None, pattern="^(slide|fade|none)$")

    # Настройки OBS чата
    obs_width: Optional[int] = Field(None, ge=100, le=2000)
    obs_height: Optional[int] = Field(None, ge=100, le=2000)
    obs_font_size: Optional[int] = Field(None, ge=8, le=72)
    obs_font_family: Optional[str] = None
    obs_font_weight: Optional[str] = Field(None, pattern="^(normal|bold|light)$")
    obs_background_color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    obs_background_image: Optional[str] = None
    obs_text_color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    obs_border_radius: Optional[int] = Field(None, ge=0, le=50)
    obs_border_color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    obs_border_width: Optional[int] = Field(None, ge=0, le=20)
    obs_message_bg: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    obs_message_border_radius: Optional[int] = Field(None, ge=0, le=50)
    obs_message_margin: Optional[int] = Field(None, ge=0, le=20)
    obs_message_padding: Optional[int] = Field(None, ge=0, le=50)

    # Цвета ролей для OBS
    obs_moderator_color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    obs_vip_color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    obs_subscriber_color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    obs_normal_color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")

    # Настройки объединения полей (только UI настройки)
    combine_titles: Optional[bool] = None
    combine_categories: Optional[bool] = None


# === Dependency ===

def get_settings_service() -> UserSettingsService:
    """Get UserSettingsService instance."""
    return UserSettingsService()


# === API Endpoints ===

@router.get("/")
async def get_user_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все настройки пользователя"""
    try:
        service = get_settings_service()
        settings_response = service.get_settings(current_user, db)
        logger.info(f"[API] get_user_settings returning: {settings_response}")
        return settings_response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting user settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения настроек пользователя")


@router.post("/")
async def update_user_settings(
    settings_update: UserSettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить настройки пользователя"""
    try:
        service = get_settings_service()
        return await service.update_settings(
            user=current_user,
            update_data=settings_update.model_dump(exclude_unset=True),
            db=db
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating user settings: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка сохранения настроек пользователя")


@router.get("/chat")
async def get_chat_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить настройки чата"""
    try:
        service = get_settings_service()
        return service.get_chat_settings(current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting chat settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения настроек чата")


@router.get("/obs")
async def get_obs_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить настройки OBS"""
    try:
        service = get_settings_service()
        return service.get_obs_settings(current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting OBS settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения настроек OBS")
