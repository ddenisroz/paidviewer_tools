"""
Модель для хранения токенов ботов с поддержкой refresh.
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean
from models.base import Base
from core.datetime_utils import utcnow_naive


class BotToken(Base):
    """
    Модель для токенов ботов (Twitch, VK).
    
    В отличие от UserToken, хранит токены самих ботов,
    которые используются для подключения к чатам.
    
    Поддерживает OAuth2 с refresh_token для автоматического обновления.
    """
    __tablename__ = 'bot_tokens'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Платформа (twitch, vk)
    platform = Column(String, nullable=False, unique=True, index=True)
    
    # Токены (зашифрованы)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=True)
    
    # Информация о токене
    expires_at = Column(DateTime, nullable=True)
    scopes = Column(JSON, nullable=True)
    
    # Информация о боте
    bot_user_id = Column(String, nullable=True)  # ID бота на платформе
    bot_login = Column(String, nullable=True)     # Login/username бота
    
    # Метаданные
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
    
    def __repr__(self):
        return f"<BotToken(platform='{self.platform}', bot_login='{self.bot_login}')>"
