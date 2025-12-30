# models/analytics.py
"""
Модели для аналитики: сообщения чата, прогрессия пользователей, психологический анализ.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text, Float
)
from models.base import Base


class ChatMessage(Base):
    """Сообщения из чата для отслеживания активности"""
    __tablename__ = "chat_messages"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    author_username = Column(String, nullable=True, index=True)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    is_deleted = Column(Boolean, default=False)

    # Роли и значки пользователя
    role = Column(String, nullable=True)
    badges = Column(JSON, nullable=True)


class UserProgression(Base):
    """Прогрессия пользователей в системе достижений"""
    __tablename__ = "user_progression"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)

    # Статистика активности
    total_days_active = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity_date = Column(DateTime)
    total_messages = Column(Integer, default=0)

    # Донаты
    total_donated = Column(Float, default=0.0)
    total_donations_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PsychologyAnalysis(Base):
    """Модель результатов психологического анализа"""
    __tablename__ = 'psychology_analysis'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    target_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    target_username = Column(String, nullable=False)
    platform = Column(String, nullable=False)
    analyzed_by_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    analyzed_by_username = Column(String, nullable=False)
    analysis_text = Column(Text, nullable=False)
    messages_count = Column(Integer, nullable=False)
    analysis_date = Column(DateTime, default=datetime.utcnow, index=True)
    ai_model_used = Column(String, nullable=True)
