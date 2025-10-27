# api/user_settings_api.py
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from core.database import get_db, User, UserSettings
from auth.auth import get_current_user
from services.user_identity_service import UserIdentityService
from core.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user-settings", tags=["user-settings"])

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

@router.get("/")
async def get_user_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все настройки пользователя"""
    try:
        # Валидируем данные пользователя
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        # Получаем фильтры для БД
        user_filters = UserIdentityService.get_database_filters(current_user)
        
        # Логируем операцию
        UserIdentityService.log_user_operation("get_user_settings", current_user)
        
        # Ищем настройки пользователя
        settings = db.query(UserSettings).filter_by(**user_filters).first()
        
        if not settings:
            # Создаем настройки по умолчанию
            settings_data = UserIdentityService.create_settings_record_data(current_user)
            settings = UserSettings(**settings_data)
            db.add(settings)
            db.commit()
            db.refresh(settings)
        
        return {
            "success": True,
            "settings": {
                # Настройки чата
                "chat_enabled": settings.chat_enabled,
                "chat_max_messages": settings.chat_max_messages,
                "chat_show_timestamps": settings.chat_show_timestamps,
                "chat_show_platform": settings.chat_show_platform,
                "chat_show_user_roles": settings.chat_show_user_roles,
                "chat_animation_duration": settings.chat_animation_duration,
                "chat_animation_type": settings.chat_animation_type,
                
                # Настройки OBS чата
                "obs_width": settings.obs_width,
                "obs_height": settings.obs_height,
                "obs_font_size": settings.obs_font_size,
                "obs_font_family": settings.obs_font_family,
                "obs_font_weight": settings.obs_font_weight,
                "obs_background_color": settings.obs_background_color,
                "obs_background_image": settings.obs_background_image,
                "obs_text_color": settings.obs_text_color,
                "obs_border_radius": settings.obs_border_radius,
                "obs_border_color": settings.obs_border_color,
                "obs_border_width": settings.obs_border_width,
                "obs_message_bg": settings.obs_message_bg,
                "obs_message_border_radius": settings.obs_message_border_radius,
                "obs_message_margin": settings.obs_message_margin,
                "obs_message_padding": settings.obs_message_padding,
                
                # Цвета ролей для OBS
                "obs_moderator_color": settings.obs_moderator_color,
                "obs_vip_color": settings.obs_vip_color,
                "obs_subscriber_color": settings.obs_subscriber_color,
                "obs_normal_color": settings.obs_normal_color,
                
                # Настройки объединения полей
                "combine_titles": settings.combine_titles,
                "combine_categories": settings.combine_categories,
            }
        }
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
        # Валидируем данные пользователя
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        # Получаем фильтры для БД
        user_filters = UserIdentityService.get_database_filters(current_user)
        
        # Логируем операцию
        UserIdentityService.log_user_operation("update_user_settings", current_user)
        
        # Ищем настройки пользователя
        settings = db.query(UserSettings).filter_by(**user_filters).first()
        
        if not settings:
            # Создаем новые настройки
            settings_data = UserIdentityService.create_settings_record_data(current_user)
            settings = UserSettings(**settings_data)
            db.add(settings)
        
        # Обновляем только переданные поля
        update_data = settings_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(settings, field):
                setattr(settings, field, value)
        
        settings.updated_at = utcnow_naive()
        db.commit()
        db.refresh(settings)
        
        # Логируем обновление настроек
        user_identifier = UserIdentityService.get_user_identifier(current_user)
        logger.info(f"User {user_identifier} updated settings: {list(update_data.keys())}")
        
        # 🔄 Отправляем WebSocket событие для инвалидации кэша на фронтенде
        from services.memory_websocket_manager import memory_websocket_manager
        
        cache_invalidation_event = {
            "type": "cache_invalidate",
            "cache_key": "cache_user_settings",
            "reason": "settings_updated"
        }
        
        await memory_websocket_manager.send_to_user(current_user["id"], cache_invalidation_event)
        logger.debug(f"🔄 [USER_SETTINGS] Sent cache invalidation to user {current_user['id']}")
        
        return {
            "success": True,
            "message": "Настройки успешно сохранены",
            "updated_fields": list(update_data.keys())
        }
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
        # Валидируем данные пользователя
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        # Получаем фильтры для БД
        user_filters = UserIdentityService.get_database_filters(current_user)
        settings = db.query(UserSettings).filter_by(**user_filters).first()
        
        if not settings:
            # Возвращаем настройки по умолчанию
            return {
                "success": True,
                "chat_settings": {
                    "enabled": True,
                    "max_messages": 50,
                    "show_timestamps": True,
                    "show_platform": True,
                    "show_user_roles": True,
                    "animation_duration": 500,
                    "animation_type": "slide"
                }
            }
        
        return {
            "success": True,
            "chat_settings": {
                "enabled": settings.chat_enabled,
                "max_messages": settings.chat_max_messages,
                "show_timestamps": settings.chat_show_timestamps,
                "show_platform": settings.chat_show_platform,
                "show_user_roles": settings.chat_show_user_roles,
                "animation_duration": settings.chat_animation_duration,
                "animation_type": settings.chat_animation_type
            }
        }
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
        # Валидируем данные пользователя
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        # Получаем фильтры для БД
        user_filters = UserIdentityService.get_database_filters(current_user)
        settings = db.query(UserSettings).filter_by(**user_filters).first()
        
        if not settings:
            # Возвращаем настройки по умолчанию
            return {
                "success": True,
                "obs_settings": {
                    "width": 400,
                    "height": 300,
                    "font_size": 14,
                    "font_family": "Arial",
                    "font_weight": "normal",
                    "background_color": "#000000",
                    "background_image": None,
                    "text_color": "#ffffff",
                    "border_radius": 8,
                    "border_color": "#333333",
                    "border_width": 1,
                    "message_bg": "#1a1a1a",
                    "message_border_radius": 4,
                    "message_margin": 2,
                    "message_padding": 8,
                    "moderator_color": "#00ff00",
                    "vip_color": "#ffd700",
                    "subscriber_color": "#ff6b6b",
                    "normal_color": "#ffffff"
                }
            }
        
        return {
            "success": True,
            "obs_settings": {
                "width": settings.obs_width,
                "height": settings.obs_height,
                "font_size": settings.obs_font_size,
                "font_family": settings.obs_font_family,
                "font_weight": settings.obs_font_weight,
                "background_color": settings.obs_background_color,
                "background_image": settings.obs_background_image,
                "text_color": settings.obs_text_color,
                "border_radius": settings.obs_border_radius,
                "border_color": settings.obs_border_color,
                "border_width": settings.obs_border_width,
                "message_bg": settings.obs_message_bg,
                "message_border_radius": settings.obs_message_border_radius,
                "message_margin": settings.obs_message_margin,
                "message_padding": settings.obs_message_padding,
                "moderator_color": settings.obs_moderator_color,
                "vip_color": settings.obs_vip_color,
                "subscriber_color": settings.obs_subscriber_color,
                "normal_color": settings.obs_normal_color
            }
        }
    except Exception as e:
        logger.error(f"Error getting OBS settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения настроек OBS")
