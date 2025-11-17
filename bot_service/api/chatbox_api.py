# api/chatbox_api.py
"""API для настроек ChatBox виджета для OBS"""
import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, ConfigDict
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
    text_stroke_width: int = Field(default=0, ge=0, le=3)  # Толщина контура текста в px (0-3)
    text_stroke_color: str = Field(default='#000000')  # Цвет контура текста
    
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
    chat_width: int = Field(default=100, ge=20, le=100)  # Ширина чата в vw (20-100%)
    message_fade_seconds: int = Field(default=60, ge=10, le=60)  # 10-60 сек, 60 = не исчезают
    
    # v0.03 - Поддержка 7TV эмодзи, ссылок и загрузки изображений
    show_7tv_emotes: bool = Field(default=True)  # Показывать смайлики 7TV
    show_links: bool = Field(default=True)  # Показывать ссылки из чата
    auto_load_images: bool = Field(default=True)  # Загружать картинки/гифки сразу или как ссылки
    
    # Version для защиты от race conditions
    version: int = Field(default=1, ge=1)  # Инкрементируется при каждом обновлении


class ChatBoxSettingsResponse(ChatBoxSettingsCreate):
    """Модель ответа с настройками ChatBox"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    widget_token: str
    widget_url: str  # Полная ссылка для OBS


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
    from core.config import settings as app_settings
    widget_url = f"{app_settings.frontend_url}/chat-overlay?token={settings.widget_token}"
    
    response = ChatBoxSettingsResponse(
        id=settings.id,
        user_id=settings.user_id,
        widget_token=settings.widget_token,
        widget_url=widget_url,
        font_family=settings.font_family,
        font_size=settings.font_size,
        font_weight=settings.font_weight,
        text_stroke_width=settings.text_stroke_width or 0,
        text_stroke_color=settings.text_stroke_color or '#000000',
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
        chat_direction=settings.chat_direction,
        chat_width=settings.chat_width,
        message_fade_seconds=settings.message_fade_seconds,
        show_7tv_emotes=settings.show_7tv_emotes,
        show_links=settings.show_links,
        auto_load_images=settings.auto_load_images,
        version=settings.version if hasattr(settings, 'version') else 1
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
    
    logger.info(f"📦 [CHATBOX] 🔍 DEBUG: Existing settings found in DB: {settings is not None}")
    if settings:
        logger.info(f"📦 [CHATBOX] 🔍 DEBUG: Current token in DB: {settings.widget_token}")
    else:
        logger.info(f"📦 [CHATBOX] 🔍 DEBUG: No existing settings, will create new")
    
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
        # ✅ VERSION CHECK: Проверяем что версия совпадает (защита от race conditions)
        client_version = settings_data.version if hasattr(settings_data, 'version') else None
        if client_version is not None and hasattr(settings, 'version'):
            if settings.version != client_version:
                logger.warning(f"Version conflict for user {user_id}: DB version={settings.version}, client version={client_version}")
                raise HTTPException(
                    status_code=409,
                    detail=f"Data was updated. Current version: {settings.version}"
                )
        
        # Обновляем существующие настройки
        logger.info(f"📦 [CHATBOX] Updating settings for user {user_id}")
        # Исключаем версию из обновления (обновляем отдельно)
        update_dict = {k: v for k, v in settings_data.dict().items() if k != 'version'}
        for key, value in update_dict.items():
            setattr(settings, key, value)
        
        # ✅ INCREMENT VERSION: Инкрементируем версию после обновления
        if hasattr(settings, 'version'):
            settings.version += 1
        
        # Перегенерация токена если запрошено
        if regenerate_token:
            old_token = settings.widget_token
            new_token = generate_widget_token()
            settings.widget_token = new_token
            logger.info(f"📦 [CHATBOX] Token regenerated for user {user_id}: {old_token[:8]}... -> {new_token[:8]}...")
    
    db.commit()
    db.refresh(settings)
    
    # Формируем ссылку для OBS
    widget_url = f"{app_settings.frontend_url}/chat-overlay?token={settings.widget_token}"
    
    response = ChatBoxSettingsResponse(
        id=settings.id,
        user_id=settings.user_id,
        widget_token=settings.widget_token,
        widget_url=widget_url,
        font_family=settings.font_family,
        font_size=settings.font_size,
        font_weight=settings.font_weight,
        text_stroke_width=settings.text_stroke_width or 0,
        text_stroke_color=settings.text_stroke_color or '#000000',
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
        chat_direction=settings.chat_direction,
        chat_width=settings.chat_width,
        message_fade_seconds=settings.message_fade_seconds,
        show_7tv_emotes=settings.show_7tv_emotes,
        show_links=settings.show_links,
        auto_load_images=settings.auto_load_images,
        version=settings.version if hasattr(settings, 'version') else 1
    )
    
    logger.info(f"📦 [CHATBOX] Settings saved for user {user_id}")
    
    # 🔄 Отправляем WebSocket событие для обновления ChatOverlay в реальном времени
    from services.memory_websocket_manager import memory_websocket_manager
    
    settings_update_event = {
        "type": "chatbox_settings_updated",
        "data": {
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
            "text_stroke_width": settings.text_stroke_width,
            "text_stroke_color": settings.text_stroke_color,
            "username_color": settings.username_color,
            "message_spacing": settings.message_spacing,
            "border_radius": settings.border_radius,
            "animation_duration": settings.animation_duration,
            "animation_type": settings.animation_type,
            "chat_direction": settings.chat_direction,
            "chat_width": settings.chat_width,
            "message_fade_seconds": settings.message_fade_seconds,
            "show_7tv_emotes": settings.show_7tv_emotes,
            "show_links": settings.show_links,
            "auto_load_images": settings.auto_load_images
        }
    }
    
    await memory_websocket_manager.send_to_user(user_id, settings_update_event)
    logger.info(f"🔄 [CHATBOX] Sent settings update event to user {user_id} WebSocket connections")
    
    return response


@router.get("/settings/by-token/{token}")
async def get_settings_by_token(
    token: str,
    db: Session = Depends(get_db)
):
    """Получить настройки ChatBox по токену (для OBS виджета, без авторизации)"""
    logger.info(f"📦 [CHATBOX] 🔍 REQUEST: Getting settings by token: {token}")
    
    settings = db.query(ChatBoxSettings).filter(ChatBoxSettings.widget_token == token).first()
    
    if not settings:
        logger.warning(f"📦 [CHATBOX] Settings not found for token: {token[:8]}...")
        raise HTTPException(status_code=404, detail="ChatBox settings not found for this token")
    
    logger.info(f"📦 [CHATBOX] Settings found for user {settings.user_id}")
    
    # Получаем информацию о пользователе для channel name
    from core.database import User
    user = db.query(User).filter(User.id == settings.user_id).first()
    channel_name = user.twitch_username if user else None
    
    return {
        "user_id": settings.user_id,
        "channel_name": channel_name,  # Добавлено для загрузки channel-specific badges
        "font_family": settings.font_family,
        "font_size": settings.font_size,
        "font_weight": settings.font_weight,
        "text_stroke_width": settings.text_stroke_width or 0,
        "text_stroke_color": settings.text_stroke_color or '#000000',
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
        "animation_type": settings.animation_type,
        "chat_direction": settings.chat_direction,
        "chat_width": settings.chat_width,
        "message_fade_seconds": settings.message_fade_seconds,
        "show_7tv_emotes": settings.show_7tv_emotes,
        "show_links": settings.show_links,
        "auto_load_images": settings.auto_load_images,
        "version": settings.version if hasattr(settings, 'version') else 1
    }

