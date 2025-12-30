# models/moderation.py
"""
Модели для модерации: заблокированные боты, каналы, whitelist.
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, UniqueConstraint
)
from core.datetime_utils import utcnow_naive
from models.base import Base


class BlockedBot(Base):
    """Модель заблокированных ботов"""
    __tablename__ = 'blocked_bots'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    bot_name = Column(String, unique=True, index=True, nullable=False)
    added_at = Column(DateTime, default=utcnow_naive)


class BlockedChannel(Base):
    """Модель для заблокированных каналов"""
    __tablename__ = 'blocked_channels'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    channel_name = Column(String, unique=True, index=True, nullable=False)
    reason = Column(String, nullable=True)
    blocked_by = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow_naive)


class WhitelistedChannel(Base):
    """Модель для белого списка каналов"""
    __tablename__ = "whitelisted_channels"
    __table_args__ = (
        UniqueConstraint('channel_name', 'platform', name='uix_channel_platform'),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    channel_name = Column(String, index=True, nullable=False)
    platform = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow_naive)
