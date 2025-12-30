# models/youtube.py
"""
Модель очереди YouTube видео.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, CheckConstraint
)
from models.base import Base


class YouTubeQueue(Base):
    """Модель очереди YouTube видео"""
    __tablename__ = 'youtube_queue'
    __table_args__ = (
        CheckConstraint(
            '(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)',
            name='check_user_or_session_youtube_queue'
        ),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    video_url = Column(String, nullable=False)
    video_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    duration = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    channel_name = Column(String, nullable=False)
    platform = Column(String, nullable=False, default='twitch')
    requester_name = Column(String, nullable=False)
    requester_id = Column(String, nullable=False)
    position = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False, default='pending')
    is_paid = Column(Boolean, default=False)
    points_cost = Column(Integer, nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow, index=True)
    played_at = Column(DateTime, nullable=True)
