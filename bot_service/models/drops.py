# models/drops.py
"""
Модели системы Drops (лутбоксы).
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float,
    UniqueConstraint, CheckConstraint
)
from core.datetime_utils import utcnow_naive
from models.base import Base


class DropsType(Base):
    """Типы Drops"""
    __tablename__ = 'drops_types'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow_naive)


class DropsQuality(Base):
    """Качества Drops"""
    __tablename__ = 'drops_qualities'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False)
    weight = Column(Integer, default=100)
    created_at = Column(DateTime, default=utcnow_naive)


class DropsConfig(Base):
    """Конфигурация Drops для канала"""
    __tablename__ = 'drops_configs'
    __table_args__ = (
        CheckConstraint(
            '(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)',
            name='check_user_or_session_drops_config'
        ),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=True, default="global")

    # Стрик настройки
    streak_days_common = Column(Integer, default=1)
    streak_days_rare = Column(Integer, default=3)
    streak_days_epic = Column(Integer, default=7)
    streak_days_legendary = Column(Integer, default=14)
    streak_messages_required = Column(Integer, default=5)
    streak_reset_on_skip = Column(Boolean, default=True)
    streak_enabled_twitch = Column(Boolean, nullable=False, server_default='false')
    streak_enabled_vk = Column(Boolean, nullable=False, server_default='false')
    streak_enabled = Column(Boolean, default=False)  # DEPRECATED

    # Донат настройки
    donation_enabled = Column(Boolean, default=True)
    donation_amount_common = Column(Float, default=50.0)
    donation_amount_rare = Column(Float, default=100.0)
    donation_amount_epic = Column(Float, default=500.0)
    donation_amount_legendary = Column(Float, default=1000.0)

    # Мифический лутбокс
    mythical_enabled = Column(Boolean, default=True)
    mythical_min_interval_hours = Column(Integer, default=2)
    mythical_max_interval_hours = Column(Integer, default=8)
    mythical_window_duration_minutes = Column(Integer, default=5)
    mythical_donation_amount = Column(Float, default=2000.0)
    mythical_last_appeared = Column(DateTime, nullable=True)

    # Настройки виджета (OBS анимация)
    widget_spinning_duration_ms = Column(Integer, default=1500)
    widget_opening_duration_ms = Column(Integer, default=1000)
    widget_result_duration_ms = Column(Integer, default=5500)
    widget_closing_duration_ms = Column(Integer, default=500)
    widget_token = Column(String, nullable=True, unique=True, index=True)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)


class DropsReward(Base):
    """Награды в Drops"""
    __tablename__ = 'drops_rewards'
    __table_args__ = (
        CheckConstraint(
            '(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)',
            name='check_user_or_session_drops_reward'
        ),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)

    name = Column(String, nullable=False)
    description = Column(Text)
    quality_id = Column(Integer, ForeignKey('drops_qualities.id'), nullable=False)
    weight = Column(Integer, default=100)

    # Тип награды
    reward_type = Column(String, nullable=False)
    reward_value = Column(String, nullable=False)

    # Изображение для карточки в гача крутке
    image_url = Column(String, nullable=True)

    # Звук награды
    sound_file = Column(String, nullable=True)
    sound_volume = Column(Float, default=1.0)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)


class UserStreak(Base):
    """Стрики пользователей"""
    __tablename__ = 'user_streaks'
    __table_args__ = (
        UniqueConstraint('user_id', 'viewer_id', 'platform', name='uq_user_streak'),
        UniqueConstraint('session_id', 'viewer_id', 'platform', name='uq_session_streak'),
        CheckConstraint(
            '(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)',
            name='check_user_or_session_user_streak'
        ),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    viewer_id = Column(String, nullable=False, index=True)
    viewer_name = Column(String, nullable=False)

    current_streak = Column(Integer, default=0)
    max_streak = Column(Integer, default=0)
    last_activity = Column(DateTime, default=utcnow_naive)
    messages_this_stream = Column(Integer, default=0)

    # Информация о последней трансляции
    last_stream_session_id = Column(Integer, ForeignKey('stream_sessions.id'), nullable=True, index=True)
    last_stream_attended_at = Column(DateTime, nullable=True, index=True)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)


class DropsHistory(Base):
    """История получения Drops"""
    __tablename__ = 'drops_history'
    __table_args__ = (
        CheckConstraint(
            '(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)',
            name='check_user_or_session_drops_history'
        ),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    viewer_id = Column(String, nullable=False, index=True)
    viewer_name = Column(String, nullable=False)

    # Тип лутбокса
    lootbox_type = Column(String, nullable=False)
    quality_id = Column(Integer, ForeignKey('drops_qualities.id'), nullable=False)

    # Полученная награда
    reward_id = Column(Integer, ForeignKey('drops_rewards.id'), nullable=True)
    reward_name = Column(String, nullable=False)
    reward_type = Column(String, nullable=False)
    reward_value = Column(String, nullable=False)

    # Дополнительная информация
    donation_amount = Column(Float, nullable=True)
    streak_days = Column(Integer, nullable=True)
    messages_count = Column(Integer, nullable=True)

    # Внешние данные
    donation_alert_id = Column(String, nullable=True)
    chat_message_id = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=utcnow_naive, index=True)


class MythicalDropsSession(Base):
    """Сессии мифических Drops"""
    __tablename__ = 'mythical_drops_sessions'
    __table_args__ = (
        CheckConstraint(
            '(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)',
            name='check_user_or_session_mythical_drops'
        ),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)

    # Параметры сессии
    donation_amount = Column(Float, nullable=False)
    window_duration_minutes = Column(Integer, nullable=False)

    # Статус
    is_active = Column(Boolean, default=True)

    started_at = Column(DateTime, default=utcnow_naive)
    expires_at = Column(DateTime, nullable=False)
    winner_viewer_id = Column(String, nullable=True)
    winner_viewer_name = Column(String, nullable=True)
    winner_donation_amount = Column(Float, nullable=True)

    created_at = Column(DateTime, default=utcnow_naive)


class StreamSession(Base):
    """Сессии трансляций для отслеживания начала и конца стримов"""
    __tablename__ = 'stream_sessions'
    __table_args__ = (
        CheckConstraint(
            '(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)',
            name='check_user_or_session_stream_session'
        ),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)

    # Время начала и конца трансляции
    started_at = Column(DateTime, nullable=False, default=utcnow_naive, index=True)
    ended_at = Column(DateTime, nullable=True, index=True)

    # Статус трансляции
    is_active = Column(Boolean, default=True, index=True)

    # Дополнительная информация
    viewer_count_peak = Column(Integer, default=0)
    title = Column(String, nullable=True)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
