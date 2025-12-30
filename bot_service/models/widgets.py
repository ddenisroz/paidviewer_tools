# models/widgets.py
"""
Модели виджетов для OBS.
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Float, UniqueConstraint
)
from core.datetime_utils import utcnow_naive
from models.base import Base


class ChatBoxSettings(Base):
    """Настройки кастомизации ChatBox для OBS виджета"""
    __tablename__ = 'chatbox_settings'
    __table_args__ = (
        UniqueConstraint('user_id', name='uq_chatbox_user'),
        UniqueConstraint('widget_token', name='uq_chatbox_token'),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    widget_token = Column(String, nullable=False, unique=True, index=True)

    # Настройки шрифта
    font_family = Column(String, default='Inter')
    font_size = Column(Integer, default=16)
    font_weight = Column(String, default='normal')
    text_stroke_width = Column(Integer, default=0)
    text_stroke_color = Column(String, default='#000000')

    # Настройки фона
    background_color = Column(String, default='#000000')
    background_opacity = Column(Float, default=0.5)

    # Настройки отображения
    max_messages = Column(Integer, default=20)
    chat_direction = Column(String, default='vertical')
    chat_width = Column(Integer, default=100)
    show_platform_icons = Column(Boolean, default=True)
    show_roles = Column(Boolean, default=False)
    show_badges = Column(Boolean, default=True)
    show_avatars = Column(Boolean, default=False)

    # Настройки цветов текста
    text_color = Column(String, default='#FFFFFF')
    username_color = Column(String, default='#9147FF')

    # Дополнительные настройки
    message_spacing = Column(Integer, default=4)
    border_radius = Column(Integer, default=8)
    animation_duration = Column(Integer, default=300)
    animation_type = Column(String, default='fade')
    message_fade_seconds = Column(Integer, default=60)

    # Поддержка 7TV смайликов, цуков и картинок
    show_7tv_emotes = Column(Boolean, default=True)
    show_links = Column(Boolean, default=True)
    auto_load_images = Column(Boolean, default=True)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
