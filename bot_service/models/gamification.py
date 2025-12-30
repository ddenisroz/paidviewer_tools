# models/gamification.py
"""
Модели геймификации: достижения, донаты.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
)
from models.base import Base


class Achievement(Base):
    """Достижения, которые можно получить"""
    __tablename__ = "achievements"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    channel_name = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    type = Column(String, nullable=False)
    requirement_value = Column(Integer, nullable=False)
    reward_type = Column(String, nullable=False)
    reward_value = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserAchievement(Base):
    """Полученные пользователями достижения"""
    __tablename__ = "user_achievements"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    achievement_id = Column(Integer, ForeignKey("achievements.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    earned_at = Column(DateTime, default=datetime.utcnow)
    is_claimed = Column(Boolean, default=False)


class DonationAlert(Base):
    """Донаты через DonationAlerts"""
    __tablename__ = "donation_alerts"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="RUB")
    message = Column(Text)
    alert_id = Column(String, unique=True, index=True)
    processed_at = Column(DateTime, default=datetime.utcnow)
    is_processed = Column(Boolean, default=False)
