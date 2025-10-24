# api/chatbox_api.py
"""API для настроек ChatBox виджета для OBS"""
import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from core.database import get_db, ChatBoxSettings
from auth.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chatbox", tags=["chatbox"])


# Pydantic модели для API
class ChatBoxSettingsCreate(BaseModel):
    """Модель для создания/обновления настроек ChatBox"""
    # Шрифт
    font_family: str = Field(default='Inter, system-ui, sans-serif')
    font_size: int = Field(default=16, ge=8, le=32)  # от 8 до 32px
    font_weight: str = Field(default='normal')
    
    # Фон
    background_color: str = Field(default='#000000')
    background_opacity: float = Field(default=0.5, ge=0.0, le=1.0)
    
    # Отображение
    max_messages: int = Field(default=20, ge=1, le=50)  # от 1 до 50 сообщений
    show_platform_icons: bool = Field(default=True)
    show_roles: bool = Field(default=False)
    show_badges: bool = Field(default=True)  # Включено по умолчанию для Twitch badges
    show_avatars: bool = Field(default=False)
    
    # Цвета текста
    text_color: str = Field(default='#FFFFFF')
    username_color: str = Field(default='#9147FF')
    
    # Дополнительно
    message_spacing: int = Field(default=8, ge=0, le=32)
    border_radius: int = Field(default=8, ge=0, le=32)
    animation_duration: int = Field(default=300, ge=0, le=2000)
    animation_type: str = Field(default='fade')  # fade, slide-right, slide-left, scale, bounce
    chat_direction: str = Field(default='vertical')  # vertical или horizontal


class ChatBoxSettingsResponse(ChatBoxSettingsCreate):
    """Модель ответа с настройками ChatBox"""
    id: int
    user_id: int
    widget_token: str
    widget_url: str  # Полная ссылка для OBS
    
    class Config:
        from_attributes = True


def generate_widget_token() -> str:
    """Генерирует уникальный токен для виджета (32 символа)"""
    return secrets.token_urlsafe(24)  # 24 bytes = ~32 chars in base64url


@router.get("/settings", response_model=ChatBoxSettingsResponse)
async def get_chatbox_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить текущие настройки ChatBox пользователя"""
    logger.info(f"📦 [CHATBOX] Getting settings for user {current_user['id']}")
    
    user_id = current_user["id"]
    settings = db.query(ChatBoxSettings).filter(ChatBoxSettings.user_id == user_id).first()
    
    if not settings:
        # Создаем настройки по умолчанию
        logger.info(f"📦 [CHATBOX] Creating default settings for user {user_id}")
        token = generate_widget_token()
        settings = ChatBoxSettings(
            user_id=user_id,
            widget_token=token
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    # Формируем полную ссылку для OBS
    widget_url = f"http://localhost:5173/chat-overlay?token={settings.widget_token}"
    
    response = ChatBoxSettingsResponse(
        id=settings.id,
        user_id=settings.user_id,
        widget_token=settings.widget_token,
        widget_url=widget_url,
        font_family=settings.font_family,
        font_size=settings.font_size,
        font_weight=settings.font_weight,
        background_color=settings.background_color,
        background_opacity=settings.background_opacity,
        max_messages=settings.max_messages,
        show_platform_icons=settings.show_platform_icons,
        show_roles=settings.show_roles,
        show_badges=settings.show_badges,
        show_avatars=settings.show_avatars,
        text_color=settings.text_color,
        username_color=settings.username_color,
        message_spacing=settings.message_spacing,
        border_radius=settings.border_radius,
        animation_duration=settings.animation_duration,
        animation_type=settings.animation_type,
        chat_direction=settings.chat_direction
    )
    
    logger.info(f"📦 [CHATBOX] Settings retrieved for user {user_id}")
    return response


@router.post("/settings", response_model=ChatBoxSettingsResponse)
async def save_chatbox_settings(
    settings_data: ChatBoxSettingsCreate,
    regenerate_token: bool = False,  # Параметр для перегенерации токена
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сохранить настройки ChatBox и опционально перегенерировать токен"""
    logger.info(f"📦 [CHATBOX] Saving settings for user {current_user['id']}, regenerate_token={regenerate_token}")
    
    user_id = current_user["id"]
    settings = db.query(ChatBoxSettings).filter(ChatBoxSettings.user_id == user_id).first()
    
    if not settings:
        # Создаем новые настройки
        logger.info(f"📦 [CHATBOX] Creating new settings for user {user_id}")
        token = generate_widget_token()
        settings = ChatBoxSettings(
            user_id=user_id,
            widget_token=token,
            **settings_data.dict()
        )
        db.add(settings)
    else:
        # Обновляем существующие настройки
        logger.info(f"📦 [CHATBOX] Updating settings for user {user_id}")
        for key, value in settings_data.dict().items():
            setattr(settings, key, value)
        
        # Перегенерация токена если запрошено
        if regenerate_token:
            old_token = settings.widget_token
            new_token = generate_widget_token()
            settings.widget_token = new_token
            logger.info(f"📦 [CHATBOX] Token regenerated for user {user_id}: {old_token[:8]}... -> {new_token[:8]}...")
    
    db.commit()
    db.refresh(settings)
    
    # Формируем ссылку для OBS
    widget_url = f"http://localhost:5173/chat-overlay?token={settings.widget_token}"
    
    response = ChatBoxSettingsResponse(
        id=settings.id,
        user_id=settings.user_id,
        widget_token=settings.widget_token,
        widget_url=widget_url,
        font_family=settings.font_family,
        font_size=settings.font_size,
        font_weight=settings.font_weight,
        background_color=settings.background_color,
        background_opacity=settings.background_opacity,
        max_messages=settings.max_messages,
        show_platform_icons=settings.show_platform_icons,
        show_roles=settings.show_roles,
        show_badges=settings.show_badges,
        show_avatars=settings.show_avatars,
        text_color=settings.text_color,
        username_color=settings.username_color,
        message_spacing=settings.message_spacing,
        border_radius=settings.border_radius,
        animation_duration=settings.animation_duration,
        animation_type=settings.animation_type,
        chat_direction=settings.chat_direction
    )
    
    logger.info(f"📦 [CHATBOX] Settings saved for user {user_id}")
    return response


@router.get("/settings/by-token/{token}")
async def get_settings_by_token(
    token: str,
    db: Session = Depends(get_db)
):
    """Получить настройки ChatBox по токену (для OBS виджета, без авторизации)"""
    logger.info(f"📦 [CHATBOX] Getting settings by token: {token[:8]}...")
    
    settings = db.query(ChatBoxSettings).filter(ChatBoxSettings.widget_token == token).first()
    
    if not settings:
        logger.warning(f"📦 [CHATBOX] Settings not found for token: {token[:8]}...")
        raise HTTPException(status_code=404, detail="ChatBox settings not found for this token")
    
    logger.info(f"📦 [CHATBOX] Settings found for user {settings.user_id}")
    
    return {
        "user_id": settings.user_id,
        "font_family": settings.font_family,
        "font_size": settings.font_size,
        "font_weight": settings.font_weight,
        "background_color": settings.background_color,
        "background_opacity": settings.background_opacity,
        "max_messages": settings.max_messages,
        "show_platform_icons": settings.show_platform_icons,
        "show_roles": settings.show_roles,
        "show_badges": settings.show_badges,
        "show_avatars": settings.show_avatars,
        "text_color": settings.text_color,
        "username_color": settings.username_color,
        "message_spacing": settings.message_spacing,
        "border_radius": settings.border_radius,
        "animation_duration": settings.animation_duration,
        "animation_type": settings.animation_type
    }

