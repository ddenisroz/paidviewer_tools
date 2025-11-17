# core/database.py
import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text, Float, text, Index, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime
from typing import Optional

# ╨Ш╨╝╨┐╨╛╤А╤В╨╕╤А╤Г╨╡╨╝ ╤Г╤В╨╕╨╗╨╕╤В╤Г ╨┤╨╗╤П ╤А╨░╨▒╨╛╤В╤Л ╤Б ╨┤╨░╤В╨╛╨╣/╨▓╤А╨╡╨╝╨╡╨╜╨╡╨╝
from core.datetime_utils import utcnow_naive

# ╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨░ ╨╗╨╛╨│╨╕╤А╨╛╨▓╨░╨╜╨╕╤П
logger = logging.getLogger(__name__)

# ╨Ш╨╝╨┐╨╛╤А╤В╨╕╤А╤Г╨╡╨╝ ╤Ж╨╡╨╜╤В╤А╨░╨╗╨╕╨╖╨╛╨▓╨░╨╜╨╜╤Л╨╡ ╨┐╤Г╤В╨╕
from .project_paths import DATA_DIR

# ╨Ю╨┐╤А╨╡╨┤╨╡╨╗╤П╨╡╨╝ URL ╨▒╨░╨╖╤Л ╨┤╨░╨╜╨╜╤Л╤Е ╨╕╨╖ ╨┐╨╡╤А╨╡╨╝╨╡╨╜╨╜╨╛╨╣ ╨╛╨║╤А╤Г╨╢╨╡╨╜╨╕╤П
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required. Please set it in .env file.")

# ╨Ю╨┐╤А╨╡╨┤╨╡╨╗╤П╨╡╨╝, ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╤В╤Б╤П ╨╗╨╕ PostgreSQL
IS_POSTGRESQL = DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgresql+psycopg2://")
if not IS_POSTGRESQL:
    raise ValueError(f"Only PostgreSQL is supported. Current DATABASE_URL: {DATABASE_URL[:50]}...")

try:
    # ╨б╨╛╨╖╨┤╨░╨╡╨╝ ╨┤╨▓╨╕╨╢╨╛╨║ SQLAlchemy для PostgreSQL
    # ✅ TASK 7.4: Optimized connection pooling for better performance
    # PostgreSQL: connection pooling ╨┤╨╗╤П ╨╗╤Г╤З╤И╨╡╨╣ ╨┐╤А╨╛╨╕╨╖╨▓╨╛╨┤╨╕╤В╨╡╨╗╤М╨╜╨╛╤Б╤В╨╕
    engine = create_engine(
        DATABASE_URL,
        pool_size=20,          # ╨С╨░╨╖╨╛╨▓╤Л╨╣ ╤А╨░╨╖╨╝╨╡╤А ╨┐╤Г╨╗╨░ ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╨╣ (20 persistent connections)
        max_overflow=40,       # ╨Ф╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╤Л╨╡ ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╤П ╨┐╤А╨╕ ╨╜╨░╨│╤А╤Г╨╖╨║╨╡ (up to 60 total)
        pool_pre_ping=True,    # ╨Я╤А╨╛╨▓╨╡╤А╨║╨░ ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╨╣ ╨┐╨╡╤А╨╡╨┤ ╨╕╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╨╜╨╕╨╡╨╝ (detect stale connections)
        pool_recycle=3600,     # ╨Я╨╡╤А╨╡╨╕╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╨╜╨╕╨╡ ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╨╣ ╨║╨░╨╢╨┤╤Л╨╣ ╤З╨░╤Б (prevent connection timeouts)
        pool_reset_on_return='commit',  # ✅ ОПТИМИЗАЦИЯ: Сбрасывать транзакции при возврате в пул
        echo=False,
        # ✅ ОПТИМИЗАЦИЯ: Настройки для PostgreSQL
        connect_args={
            "connect_timeout": 10,  # Таймаут подключения (10 seconds)
            "application_name": "bot_service",  # Имя приложения для мониторинга
            "options": "-c statement_timeout=30000"  # Таймаут выполнения запросов (30 сек)
        }
    )

    # ╨б╨╛╨╖╨┤╨░╨╡╨╝ ╤Б╨╡╤Б╤Б╨╕╤О ╨┤╨╗╤П ╨▓╨╖╨░╨╕╨╝╨╛╨┤╨╡╨╣╤Б╤В╨▓╨╕╤П ╤Б ╨С╨Ф
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # ╨С╨░╨╖╨╛╨▓╤Л╨╣ ╨║╨╗╨░╤Б╤Б ╨┤╨╗╤П ╨╝╨╛╨┤╨╡╨╗╨╡╨╣
    Base = declarative_base()

    # ╨Ю╨┐╤А╨╡╨┤╨╡╨╗╤П╨╡╨╝ ╨╝╨╛╨┤╨╡╨╗╨╕ ╨┤╨░╨╜╨╜╤Л╤Е (╤В╨░╨▒╨╗╨╕╤Ж╤Л)

    class User(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨╡╨┤╨╕╨╜╨╛╨╣ ╤Г╤З╨╡╤В╨╜╨╛╨╣ ╨╖╨░╨┐╨╕╤Б╨╕ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨▓ ╨┐╤А╨╕╨╗╨╛╨╢╨╡╨╜╨╕╨╕."""
        __tablename__ = 'users'
        __table_args__ = (
            UniqueConstraint('twitch_username', name='uq_user_twitch_username'),
            UniqueConstraint('vk_username', name='uq_user_vk_username'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        is_admin = Column(Boolean, default=False)
        is_active = Column(Boolean, default=True)
        
        # Application role (admin, user, guest)
        role = Column(String, default='user', nullable=False, index=True)  # 'admin', 'user', 'guest'
        
        # Platform-specific roles (Twitch)
        twitch_is_broadcaster = Column(Boolean, default=False)  # Channel owner on Twitch
        twitch_is_moderator = Column(Boolean, default=False)    # Moderator on Twitch
        twitch_is_vip = Column(Boolean, default=False)          # VIP on Twitch
        twitch_is_subscriber = Column(Boolean, default=False)   # Subscriber on Twitch
        
        # Platform-specific roles (VK)
        vk_is_owner = Column(Boolean, default=False)            # Channel owner on VK
        vk_is_moderator = Column(Boolean, default=False)        # Moderator on VK

        obs_token = Column(String, nullable=True)  # OBS ╤В╨╛╨║╨╡╨╜ ╨┤╨╗╤П ╨┐╨╛╤Б╤В╨╛╤П╨╜╨╜╨╛╨╣ ╤Б╤Б╤Л╨╗╨║╨╕
        is_blocked = Column(Boolean, default=False)  # ╨Ч╨░╨▒╨╗╨╛╨║╨╕╤А╨╛╨▓╨░╨╜ ╨╗╨╕ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М
        blocked_reason = Column(String, nullable=True)  # ╨Я╤А╨╕╤З╨╕╨╜╨░ ╨▒╨╗╨╛╨║╨╕╤А╨╛╨▓╨║╨╕
        blocked_at = Column(DateTime, nullable=True)  # ╨Ф╨░╤В╨░ ╨▒╨╗╨╛╨║╨╕╤А╨╛╨▓╨║╨╕
        created_at = Column(DateTime, default=utcnow_naive)
        
        # Username'╤Л ╨┐╨╗╨░╤В╤Д╨╛╤А╨╝
        twitch_username = Column(String, nullable=True, unique=True)
        vk_username = Column(String, nullable=True, unique=True)  # ╨Э╨╕╨║ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П VK (╨┤╨╗╤П ╨╛╤В╨╛╨▒╤А╨░╨╢╨╡╨╜╨╕╤П)
        vk_channel_name = Column(String, nullable=True, unique=True)  # ╨Э╨╕╨║ ╨║╨░╨╜╨░╨╗╨░ VK Live (╨┤╨╗╤П ╨┐╨╛╨┤╨║╨╗╤О╤З╨╡╨╜╨╕╤П ╨▒╨╛╤В╨░)
        
        # DonationAlerts ╨╕╨╜╤В╨╡╨│╤А╨░╤Ж╨╕╤П
        donationalerts_user_id = Column(String, nullable=True)
        donationalerts_access_token = Column(String, nullable=True)
        donationalerts_refresh_token = Column(String, nullable=True)
        
        # ╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ TTS
        tts_listening_mode = Column(String, default='website')  # 'website' ╨╕╨╗╨╕ 'obs'
        tts_enabled = Column(Boolean, default=False)  # ╨Т╨║╨╗╤О╤З╨╡╨╜ ╨╗╨╕ TTS - ╨▓╤Л╨║╨╗╤О╤З╨╡╨╜ ╨┐╨╛ ╤Г╨╝╨╛╨╗╤З╨░╨╜╨╕╤О ╨┤╨╗╤П ╨╜╨╛╨▓╤Л╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
        donationalerts_token_expires = Column(DateTime, nullable=True)
        temp_oauth_state = Column(String, nullable=True)
        
        # ╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╨╛╨▒╤К╨╡╨┤╨╕╨╜╨╡╨╜╨╕╤П ╨┐╨╛╨╗╨╡╨╣
        combine_titles = Column(Boolean, default=False)  # ╨Ю╨▒╤К╨╡╨┤╨╕╨╜╤П╤В╤М ╨┐╨╛╨╗╤П ╨╜╨░╨╖╨▓╨░╨╜╨╕╨╣
        combine_categories = Column(Boolean, default=False)  # ╨Ю╨▒╤К╨╡╨┤╨╕╨╜╤П╤В╤М ╨┐╨╛╨╗╤П ╨║╨░╤В╨╡╨│╨╛╤А╨╕╨╣
        
    class UserSettings(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨┤╨╗╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М╤Б╨║╨╕╤Е ╨╜╨░╤Б╤В╤А╨╛╨╡╨║ ╨╕╨╜╤В╨╡╤А╤Д╨╡╨╣╤Б╨░"""
        __tablename__ = "user_settings"
        __table_args__ = {'extend_existing': True}
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, nullable=True, unique=True)  # ╨Ф╨╗╤П ╨╛╨▒╤Л╤З╨╜╤Л╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
        session_id = Column(String, nullable=True, unique=True)  # ╨Ф╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣
        
        # ╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╤З╨░╤В╨░
        chat_enabled = Column(Boolean, default=True)
        chat_max_messages = Column(Integer, default=50)
        chat_show_timestamps = Column(Boolean, default=True)
        chat_show_platform = Column(Boolean, default=True)
        chat_show_user_roles = Column(Boolean, default=True)
        chat_animation_duration = Column(Integer, default=500)
        chat_animation_type = Column(String, default="slide")
        chat_message_fade_seconds = Column(Integer, default=60)  # ╨Т╤А╨╡╨╝╤П ╨┤╨╛ ╨╕╤Б╤З╨╡╨╖╨░╨╜╨╕╤П ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╤П (10-60 ╤Б╨╡╨║, 60 = ╨╜╨╡ ╨╕╤Б╤З╨╡╨╖╨░╤О╤В)
        
        # ╨Ъ╨░╨╜╨░╨╗╤Л ╨┐╨╗╨░╤В╤Д╨╛╤А╨╝ ╨┤╨╗╤П ╨▒╨╛╤В╨░
        channel_name = Column(String, nullable=True)  # Twitch ╨║╨░╨╜╨░╨╗
        vk_channel_name = Column(String, nullable=True)  # VK Live ╨║╨░╨╜╨░╨╗
        
        # ╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ OBS ╤З╨░╤В╨░
        obs_width = Column(Integer, default=400)
        obs_height = Column(Integer, default=300)
        obs_font_size = Column(Integer, default=14)
        obs_font_family = Column(String, default="Arial")
        obs_font_weight = Column(String, default="normal")
        obs_background_color = Column(String, default="#000000")
        obs_background_image = Column(String, nullable=True)
        obs_text_color = Column(String, default="#ffffff")
        obs_border_radius = Column(Integer, default=8)
        obs_border_color = Column(String, default="#333333")
        obs_border_width = Column(Integer, default=1)
        obs_message_bg = Column(String, default="#1a1a1a")
        obs_message_border_radius = Column(Integer, default=4)
        obs_message_margin = Column(Integer, default=2)
        obs_message_padding = Column(Integer, default=8)
        
        # ╨ж╨▓╨╡╤В╨░ ╤А╨╛╨╗╨╡╨╣ ╨┤╨╗╤П OBS
        obs_moderator_color = Column(String, default="#00ff00")
        obs_vip_color = Column(String, default="#ffd700")
        obs_subscriber_color = Column(String, default="#ff6b6b")
        obs_normal_color = Column(String, default="#ffffff")
        
        # ╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╨╛╨▒╤К╨╡╨┤╨╕╨╜╨╡╨╜╨╕╤П ╨┐╨╛╨╗╨╡╨╣ (╤В╨╛╨╗╤М╨║╨╛ UI ╨╜╨░╤Б╤В╤А╨╛╨╣╨║╨╕)
        combine_titles = Column(Boolean, default=False)
        combine_categories = Column(Boolean, default=False)
        
        # ╨Ь╨╡╤В╨░╨┤╨░╨╜╨╜╤Л╨╡
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
        bot_last_welcome_at = Column(DateTime, nullable=True)  # ╨Я╨╛╤Б╨╗╨╡╨┤╨╜╨╡╨╡ ╨┐╤А╨╕╨▓╨╡╤В╤Б╤В╨▓╨╡╨╜╨╜╨╛╨╡ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╡ ╨▒╨╛╤В╨░
        
        # ╨Ю╨│╤А╨░╨╜╨╕╤З╨╡╨╜╨╕╨╡: ╨┤╨╛╨╗╨╢╨╡╨╜ ╨▒╤Л╤В╤М ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜ ╨╗╨╕╨▒╨╛ user_id, ╨╗╨╕╨▒╨╛ session_id
        __table_args__ = (
            CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_settings'),
            {'extend_existing': True}
        )

    class WhitelistedChannel(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨┤╨╗╤П ╨▒╨╡╨╗╨╛╨│╨╛ ╤Б╨┐╨╕╤Б╨║╨░ ╨║╨░╨╜╨░╨╗╨╛╨▓"""
        __tablename__ = "whitelisted_channels"
        __table_args__ = (
            UniqueConstraint('channel_name', 'platform', name='uix_channel_platform'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, index=True, nullable=False)
        platform = Column(String, index=True, nullable=False)  # 'twitch' ╨╕╨╗╨╕ 'vk'
        created_at = Column(DateTime, default=utcnow_naive)

    class TTSBlockedUser(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣, ╨╖╨░╨▒╨╗╨╛╨║╨╕╤А╨╛╨▓╨░╨╜╨╜╤Л╤Е ╨╛╤В TTS"""
        __tablename__ = "tts_blocked_users"
        __table_args__ = (
            CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_tts_blocked_user'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # ╨Т╨╗╨░╨┤╨╡╨╗╨╡╤Ж ╨║╨░╨╜╨░╨╗╨░ (╨┤╨╗╤П ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╨╜╤Л╤Е)
        session_id = Column(String, nullable=True, index=True)  # ╨Т╨╗╨░╨┤╨╡╨╗╨╡╤Ж ╨║╨░╨╜╨░╨╗╨░ (╨┤╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣)
        channel_name = Column(String, nullable=False, index=True)
        platform = Column(String, nullable=False)  # 'twitch' or 'vk'
        username = Column(String, nullable=False)
        blocked_at = Column(DateTime, default=utcnow_naive)
        blocked_by = Column(Integer, nullable=True)  # ID ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П, ╨║╨╛╤В╨╛╤А╤Л╨╣ ╨╖╨░╨▒╨╗╨╛╨║╨╕╤А╨╛╨▓╨░╨╗
        reason = Column(String, nullable=True)



    class BlockedBot(Base):
        __tablename__ = 'blocked_bots'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        bot_name = Column(String, unique=True, index=True, nullable=False)
        added_at = Column(DateTime, default=utcnow_naive)

    # ╨Т╨Р╨Ц╨Э╨Ю: ╨Ь╨╛╨┤╨╡╨╗╤М Voice ╤Г╨┤╨░╨╗╨╡╨╜╨░ ╨╕╨╖ bot_service!
    # ╨У╨╛╨╗╨╛╤Б╨░ ╤Е╤А╨░╨╜╤П╤В╤Б╤П ╨в╨Ю╨Ы╨м╨Ъ╨Ю ╨▓ tts_service/database.py (Voice ╤В╨░╨▒╨╗╨╕╤Ж╨░).
    # Bot service ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╤В UserVoiceSettings ╨┤╨╗╤П ╨┐╨╡╤А╤Б╨╛╨╜╨░╨╗╤М╨╜╤Л╤Е ╨╜╨░╤Б╤В╤А╨╛╨╡╨║ ╨│╨╛╨╗╨╛╤Б╨╛╨▓ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣.

    class BlockedChannel(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨┤╨╗╤П ╨╖╨░╨▒╨╗╨╛╨║╨╕╤А╨╛╨▓╨░╨╜╨╜╤Л╤Е ╨║╨░╨╜╨░╨╗╨╛╨▓"""
        __tablename__ = 'blocked_channels'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, unique=True, index=True, nullable=False)
        reason = Column(String, nullable=True)
        blocked_by = Column(String, nullable=True)  # ╨Ъ╤В╨╛ ╨╖╨░╨▒╨╗╨╛╨║╨╕╤А╨╛╨▓╨░╨╗
        is_active = Column(Boolean, default=True)

        created_at = Column(DateTime, default=utcnow_naive)

    class UserToken(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨┤╨╗╤П ╤В╨╛╨║╨╡╨╜╨╛╨▓ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣ ╤А╨░╨╖╨╜╤Л╤Е ╨┐╨╗╨░╤В╤Д╨╛╤А╨╝"""
        __tablename__ = 'user_tokens'
        __table_args__ = (
            CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_token'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # ╨Ф╨╗╤П ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╨╜╤Л╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
        session_id = Column(String, nullable=True, index=True)  # ╨Ф╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣
        platform = Column(String, nullable=False)  # 'twitch', 'vk', 'donationalerts', etc.
        platform_user_id = Column(String, nullable=False)  # ID ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╜╨░ ╨┐╨╗╨░╤В╤Д╨╛╤А╨╝╨╡
        avatar_url = Column(String, nullable=True)  # URL ╨░╨▓╨░╤В╨░╤А╨║╨╕
        access_token = Column(String, nullable=False)
        refresh_token = Column(String, nullable=True)
        expires_at = Column(DateTime, nullable=True)
        scopes = Column(JSON, nullable=True) # ╨Я╤А╨░╨▓╨░ ╨┤╨╛╤Б╤В╤Г╨┐╨░ (scopes)
        is_active = Column(Boolean, default=True)

  # ╨Р╨║╤В╨╕╨▓╨╡╨╜ ╨╗╨╕ ╤В╨╛╨║╨╡╨╜ (╨┤╨╗╤П ╨╗╨╛╨│╨░╤Г╤В╨░ ╨▒╨╡╨╖ ╤Г╨┤╨░╨╗╨╡╨╜╨╕╤П)
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
    class UserSession(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨░╨║╤В╨╕╨▓╨╜╤Л╤Е ╤Б╨╡╤Б╤Б╨╕╨╣, ╨┐╤А╨╕╨▓╤П╨╖╨░╨╜╨╜╨░╤П ╨║ ╨╡╨┤╨╕╨╜╨╛╨╝╤Г user_id."""
        __tablename__ = 'user_sessions'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        session_id = Column(String, unique=True, index=True, nullable=False)
        device_info = Column(JSON, nullable=True)
        created_at = Column(DateTime, default=utcnow_naive)
        last_activity = Column(DateTime, default=utcnow_naive)
        is_active = Column(Boolean, default=True)


    class GuestSession(Base):
        """Модель гостевых сессий (без привязки к user_id)
        
        Отдельная таблица для гостей решает проблему нарушения FK при использовании user_id=-1.
        Гостевые сессии создаются при входе через guest mode и удаляются при конвертации в
        полноценного пользователя или по таймауту неактивности.
        """
        __tablename__ = 'guest_sessions'
        __table_args__ = (
            Index('idx_guest_channel_platform', 'channel_name', 'platform'),
            Index('idx_guest_last_activity', 'last_activity'),
            Index('idx_guest_is_active', 'is_active'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        session_id = Column(String, unique=True, index=True, nullable=False)
        channel_name = Column(String, nullable=False, index=True)  # Канал, который мониторит гость
        platform = Column(String, nullable=False)  # 'twitch' или 'vk'
        device_info = Column(JSON, nullable=True)  # Дополнительная информация об устройстве
        created_at = Column(DateTime, default=utcnow_naive, index=True)
        last_activity = Column(DateTime, default=utcnow_naive, index=True)
        is_active = Column(Boolean, default=True, index=True)

    class VkGuestVerification(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨┤╨╗╤П ╨┤╨░╨╜╨╜╤Л╤Е ╨▓╨╡╤А╨╕╤Д╨╕╨║╨░╤Ж╨╕╨╕ VK Live ╨│╨╛╤Б╤В╨╡╨▓╤Л╤Е ╨┐╨╛╨┤╨║╨╗╤О╤З╨╡╨╜╨╕╨╣"""
        __tablename__ = 'vk_guest_verifications'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, unique=True, index=True, nullable=False)
        verification_code = Column(String, nullable=False)
        is_verified = Column(Boolean, default=False)
        created_at = Column(DateTime, default=utcnow_naive)
        verified_at = Column(DateTime, nullable=True)

    class PsychologyAnalysis(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╤А╨╡╨╖╤Г╨╗╤М╤В╨░╤В╨╛╨▓ ╨┐╤Б╨╕╤Е╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╛╨│╨╛ ╨░╨╜╨░╨╗╨╕╨╖╨░"""
        __tablename__ = 'psychology_analysis'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        target_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        target_username = Column(String, nullable=False)
        platform = Column(String, nullable=False)
        analyzed_by_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # ╨Ъ╤В╨╛ ╨╖╨░╨┐╤А╨╛╤Б╨╕╨╗ ╨░╨╜╨░╨╗╨╕╨╖
        analyzed_by_username = Column(String, nullable=False)
        analysis_text = Column(Text, nullable=False)  # ╨а╨╡╨╖╤Г╨╗╤М╤В╨░╤В ╨░╨╜╨░╨╗╨╕╨╖╨░
        messages_count = Column(Integer, nullable=False)  # ╨Ъ╨╛╨╗╨╕╤З╨╡╤Б╤В╨▓╨╛ ╨┐╤А╨╛╨░╨╜╨░╨╗╨╕╨╖╨╕╤А╨╛╨▓╨░╨╜╨╜╤Л╤Е ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╣
        analysis_date = Column(DateTime, default=utcnow_naive, index=True)
        ai_model_used = Column(String, nullable=True)  # ╨Ъ╨░╨║╨░╤П ╨╝╨╛╨┤╨╡╨╗╤М ╨╕╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╨╗╨░╤Б╤М

    class FilteredWord(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨╖╨░╨▒╨╗╨╛╨║╨╕╤А╨╛╨▓╨░╨╜╨╜╤Л╤Е ╤Б╨╗╨╛╨▓ ╨┤╨╗╤П TTS"""
        __tablename__ = 'filtered_words'
        __table_args__ = (
            Index('idx_user_word', 'user_id', 'word'),
            Index('idx_session_word', 'session_id', 'word'),
            Index('idx_platform', 'platform'),
            Index('idx_active', 'is_active'),
            UniqueConstraint('user_id', 'word', 'platform', name='uq_user_word_platform'),
            UniqueConstraint('session_id', 'word', 'platform', name='uq_session_word_platform'),
            CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_filtered_word'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # ╨Т╨╗╨░╨┤╨╡╨╗╨╡╤Ж ╤Д╨╕╨╗╤М╤В╤А╨░ (╨┤╨╗╤П ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╨╜╤Л╤Е)
        session_id = Column(String, nullable=True, index=True)  # ╨Т╨╗╨░╨┤╨╡╨╗╨╡╤Ж ╤Д╨╕╨╗╤М╤В╤А╨░ (╨┤╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣)
        word = Column(String, nullable=False, index=True)  # ╨Ч╨░╨▒╨╗╨╛╨║╨╕╤А╨╛╨▓╨░╨╜╨╜╨╛╨╡ ╤Б╨╗╨╛╨▓╨╛
        platform = Column(String, nullable=False, default='all')  # ╨Я╨╗╨░╤В╤Д╨╛╤А╨╝╨░: all, twitch, vk
        created_at = Column(DateTime, default=utcnow_naive, index=True)
        is_active = Column(Boolean, default=True)

  # ╨Р╨║╤В╨╕╨▓╨╡╨╜ ╨╗╨╕ ╤Д╨╕╨╗╤М╤В╤А
    class YouTubeQueue(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨╛╤З╨╡╤А╨╡╨┤╨╕ YouTube ╨▓╨╕╨┤╨╡╨╛"""
        __tablename__ = 'youtube_queue'
        __table_args__ = (
            CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_youtube_queue'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # ╨Ф╨╗╤П ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╨╜╤Л╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
        session_id = Column(String, nullable=True, index=True)  # ╨Ф╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣
        video_url = Column(String, nullable=False)
        video_id = Column(String, nullable=False, index=True)  # YouTube video ID
        title = Column(String, nullable=False)
        duration = Column(String, nullable=True)  # ╨Ф╨╗╨╕╤В╨╡╨╗╤М╨╜╨╛╤Б╤В╤М ╨▓╨╕╨┤╨╡╨╛
        thumbnail_url = Column(String, nullable=True)
        channel_name = Column(String, nullable=False)  # ╨Ъ╨░╨╜╨░╨╗, ╨│╨┤╨╡ ╨╖╨░╨║╨░╨╖╨░╨╗╨╕
        platform = Column(String, nullable=False, default='twitch')  # twitch ╨╕╨╗╨╕ vk
        requester_name = Column(String, nullable=False)  # ╨Э╨╕╨║ ╨╖╨░╨║╨░╨╖╤З╨╕╨║╨░
        requester_id = Column(String, nullable=False)  # ID ╨╖╨░╨║╨░╨╖╤З╨╕╨║╨░ ╨╜╨░ ╨┐╨╗╨░╤В╤Д╨╛╤А╨╝╨╡
        position = Column(Integer, nullable=False, default=0)  # ╨Я╨╛╨╖╨╕╤Ж╨╕╤П ╨▓ ╨╛╤З╨╡╤А╨╡╨┤╨╕
        status = Column(String, nullable=False, default='pending')  # pending, playing, completed, skipped
        is_paid = Column(Boolean, default=False)  # ╨Ч╨░╨║╨░╨╖╨░╨╜╨╛ ╨╖╨░ ╨▒╨░╨╗╨╗╤Л ╨╕╨╗╨╕ ╨╜╨╡╤В
        points_cost = Column(Integer, nullable=True)  # ╨б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М ╨▓ ╨▒╨░╨╗╨╗╨░╤Е
        added_at = Column(DateTime, default=datetime.utcnow, index=True)
        played_at = Column(DateTime, nullable=True)

    class ChannelPoints(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨▒╨░╨╗╨╗╨╛╨▓ ╨║╨░╨╜╨░╨╗╨░ ╨┤╨╗╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣"""
        __tablename__ = 'channel_points'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # ╨Т╨╗╨░╨┤╨╡╨╗╨╡╤Ж ╨║╨░╨╜╨░╨╗╨░
        viewer_id = Column(String, nullable=False, index=True)  # ID ╨╖╤А╨╕╤В╨╡╨╗╤П ╨╜╨░ ╨┐╨╗╨░╤В╤Д╨╛╤А╨╝╨╡
        viewer_name = Column(String, nullable=False)  # ╨Э╨╕╨║ ╨╖╤А╨╕╤В╨╡╨╗╤П
        platform = Column(String, nullable=False)  # twitch ╨╕╨╗╨╕ vk
        channel_name = Column(String, nullable=False, index=True)  # ╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨║╨░╨╜╨░╨╗╨░
        points = Column(Integer, nullable=False, default=0)  # ╨Ъ╨╛╨╗╨╕╤З╨╡╤Б╤В╨▓╨╛ ╨▒╨░╨╗╨╗╨╛╨▓
        total_earned = Column(Integer, nullable=False, default=0)  # ╨Т╤Б╨╡╨│╨╛ ╨╖╨░╤А╨░╨▒╨╛╤В╨░╨╜╨╛
        total_spent = Column(Integer, nullable=False, default=0)  # ╨Т╤Б╨╡╨│╨╛ ╨┐╨╛╤В╤А╨░╤З╨╡╨╜╨╛
        last_activity = Column(DateTime, default=utcnow_naive)
        created_at = Column(DateTime, default=utcnow_naive)

    class ChannelReward(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨╜╨░╨│╤А╨░╨┤ ╨║╨░╨╜╨░╨╗╨░ ╨╖╨░ ╨▒╨░╨╗╨╗╤Л"""
        __tablename__ = 'channel_rewards'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # ╨Т╨╗╨░╨┤╨╡╨╗╨╡╤Ж ╨║╨░╨╜╨░╨╗╨░
        platform = Column(String, nullable=False)  # twitch ╨╕╨╗╨╕ vk
        channel_name = Column(String, nullable=False, index=True)
        title = Column(String, nullable=False)  # ╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨╜╨░╨│╤А╨░╨┤╤Л
        description = Column(String, nullable=True)  # ╨Ю╨┐╨╕╤Б╨░╨╜╨╕╨╡
        cost = Column(Integer, nullable=False)  # ╨б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М ╨▓ ╨▒╨░╨╗╨╗╨░╤Е
        icon_url = Column(String, nullable=True)  # URL ╨╕╨║╨╛╨╜╨║╨╕
        background_color = Column(String, nullable=True)  # ╨ж╨▓╨╡╤В ╤Д╨╛╨╜╨░
        is_enabled = Column(Boolean, default=True)
        is_user_input_required = Column(Boolean, default=False)  # ╨в╤А╨╡╨▒╤Г╨╡╤В ╨╗╨╕ ╨▓╨▓╨╛╨┤╨░ ╨╛╤В ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П
        max_per_stream = Column(Integer, nullable=True)  # ╨Ь╨░╨║╤Б. ╨╕╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╨╜╨╕╨╣ ╨╖╨░ ╤Б╤В╤А╨╕╨╝
        max_per_user_per_stream = Column(Integer, nullable=True)  # ╨Ь╨░╨║╤Б. ╨┤╨╗╤П ╨╛╨┤╨╜╨╛╨│╨╛ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╖╨░ ╤Б╤В╤А╨╕╨╝
        cooldown_expires_at = Column(DateTime, nullable=True)  # ╨Ъ╤Г╨╗╨┤╨░╤Г╨╜
        prompt = Column(String, nullable=True)  # ╨Я╨╛╨┤╤Б╨║╨░╨╖╨║╨░ ╨┤╨╗╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М╤Б╨║╨╛╨│╨╛ ╨▓╨▓╨╛╨┤╨░
        reward_type = Column(String, nullable=False, default='custom')  # custom, song_request, etc.
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    class PointsTransaction(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╤В╤А╨░╨╜╨╖╨░╨║╤Ж╨╕╨╣ ╨▒╨░╨╗╨╗╨╛╨▓"""
        __tablename__ = 'points_transactions'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # ╨Т╨╗╨░╨┤╨╡╨╗╨╡╤Ж ╨║╨░╨╜╨░╨╗╨░
        viewer_id = Column(String, nullable=False, index=True)
        viewer_name = Column(String, nullable=False)
        platform = Column(String, nullable=False)
        channel_name = Column(String, nullable=False, index=True)
        transaction_type = Column(String, nullable=False)  # earn, spend, admin_add, admin_remove, refund
        amount = Column(Integer, nullable=False)  # ╨Ь╨╛╨╢╨╡╤В ╨▒╤Л╤В╤М ╨╛╤В╤А╨╕╤Ж╨░╤В╨╡╨╗╤М╨╜╤Л╨╝ ╨┤╨╗╤П ╤В╤А╨░╤В
        reason = Column(String, nullable=True)  # ╨Я╤А╨╕╤З╨╕╨╜╨░ ╤В╤А╨░╨╜╨╖╨░╨║╤Ж╨╕╨╕
        reward_id = Column(Integer, ForeignKey('channel_rewards.id'), nullable=True)  # ╨б╨▓╤П╨╖╨░╨╜╨╜╨░╤П ╨╜╨░╨│╤А╨░╨┤╨░
        created_at = Column(DateTime, default=datetime.utcnow, index=True)

    class RewardQueue(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨╛╤З╨╡╤А╨╡╨┤╨╕ ╨╜╨░╨│╤А╨░╨┤ (╨┤╨╗╤П ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╨╕ ╨╝╨╛╨┤╨╡╤А╨░╤В╨╛╤А╨╛╨╝)"""
        __tablename__ = 'reward_queue'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # ╨Т╨╗╨░╨┤╨╡╨╗╨╡╤Ж ╨║╨░╨╜╨░╨╗╨░
        reward_id = Column(Integer, ForeignKey('channel_rewards.id'), nullable=False)
        viewer_id = Column(String, nullable=False, index=True)
        viewer_name = Column(String, nullable=False)
        platform = Column(String, nullable=False)
        channel_name = Column(String, nullable=False, index=True)
        user_input = Column(String, nullable=True)  # ╨Т╨▓╨╛╨┤ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П (╨╡╤Б╨╗╨╕ ╤В╤А╨╡╨▒╤Г╨╡╤В╤Б╤П)
        status = Column(String, nullable=False, default='pending')  # pending, approved, rejected, fulfilled
        points_cost = Column(Integer, nullable=False)  # ╨б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М ╨╜╨░╨│╤А╨░╨┤╤Л
        moderator_note = Column(String, nullable=True)  # ╨Ч╨░╨╝╨╡╤В╨║╨░ ╨╝╨╛╨┤╨╡╤А╨░╤В╨╛╤А╨░
        created_at = Column(DateTime, default=datetime.utcnow, index=True)
        processed_at = Column(DateTime, nullable=True)

    class BotCommand(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨║╨╛╨╝╨░╨╜╨┤ ╨▒╨╛╤В╨░
        
        ╨в╨╕╨┐╤Л ╨║╨╛╨╝╨░╨╜╨┤:
        - 'global': ╨│╨╗╨╛╨▒╨░╨╗╤М╨╜╤Л╨╡ ╨▒╨░╨╖╨╛╨▓╤Л╨╡ ╨║╨╛╨╝╨░╨╜╨┤╤Л (user_id=NULL), ╨┤╨╛╤Б╤В╤Г╨┐╨╜╤Л ╨▓╤Б╨╡╨╝
        - 'override': ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М╤Б╨║╨╕╨╡ ╨╜╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╨▒╨░╨╖╨╛╨▓╨╛╨╣ ╨║╨╛╨╝╨░╨╜╨┤╤Л (╨┐╨╡╤А╨╡╨╛╨┐╤А╨╡╨┤╨╡╨╗╤П╤О╤В global)
        - 'custom': ╨║╨░╤Б╤В╨╛╨╝╨╜╤Л╨╡ ╨║╨╛╨╝╨░╨╜╨┤╤Л ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П (╨╝╨░╨║╤Б 5 ╨╜╨░ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П)
        """
        __tablename__ = 'bot_commands'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # NULL ╨┤╨╗╤П global, user_id ╨┤╨╗╤П override/custom
        channel_name = Column(String, nullable=True, index=True)  # ╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨║╨░╨╜╨░╨╗╨░ (NULL ╨┤╨╗╤П global)
        command_name = Column(String, nullable=False, index=True)  # ╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨║╨╛╨╝╨░╨╜╨┤╤Л (╨▒╨╡╨╖ !)
        command_type = Column(String, nullable=False, index=True)  # 'global', 'override', 'custom'
        parent_command_id = Column(Integer, ForeignKey('bot_commands.id'), nullable=True)  # ╨Ф╨╗╤П override - ╤Б╤Б╤Л╨╗╨║╨░ ╨╜╨░ global ╨║╨╛╨╝╨░╨╜╨┤╤Г
        alias = Column(String, nullable=True, index=True)  # ╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М╤Б╨║╨╕╨╣ ╨░╨╗╨╕╨░╤Б (╨╜╨░╨┐╤А╨╕╨╝╨╡╤А !song ╨▓╨╝╨╡╤Б╤В╨╛ !sr)
        description = Column(String, nullable=True)  # ╨Ю╨┐╨╕╤Б╨░╨╜╨╕╨╡ ╨║╨╛╨╝╨░╨╜╨┤╤Л
        response_text = Column(String, nullable=True)  # ╨Ю╤В╨▓╨╡╤В ╨║╨╛╨╝╨░╨╜╨┤╤Л (╨┤╨╗╤П ╨║╨░╤Б╤В╨╛╨╝╨╜╤Л╤Е)
        is_enabled = Column(Boolean, default=True)  # ╨Т╨║╨╗╤О╤З╨╡╨╜╨░ ╨╗╨╕ ╨║╨╛╨╝╨░╨╜╨┤╨░
        platforms = Column(String, nullable=False, default='twitch,vk')  # ╨Я╨╗╨░╤В╤Д╨╛╤А╨╝╤Л ╤З╨╡╤А╨╡╨╖ ╨╖╨░╨┐╤П╤В╤Г╤О
        allowed_roles = Column(String, nullable=False, default='all')  # all, broadcaster, moderator, subscriber, vip (twitch) | all, owner, moderator (vk)
        cooldown_seconds = Column(Integer, default=0)  # ╨Ъ╤Г╨╗╨┤╨░╤Г╨╜ ╨▓ ╤Б╨╡╨║╤Г╨╜╨┤╨░╤Е
        last_used = Column(DateTime, nullable=True)  # ╨Я╨╛╤Б╨╗╨╡╨┤╨╜╨╡╨╡ ╨╕╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╨╜╨╕╨╡
        usage_count = Column(Integer, default=0)  # ╨Ъ╨╛╨╗╨╕╤З╨╡╤Б╤В╨▓╨╛ ╨╕╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╨╜╨╕╨╣
        tags = Column(String, nullable=True, default='')  # ╨в╨╡╨│╨╕ ╨║╨╛╨╝╨░╨╜╨┤╤Л ╤З╨╡╤А╨╡╨╖ ╨╖╨░╨┐╤П╤В╤Г╤О
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    class AudioSettings(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨╜╨░╤Б╤В╤А╨╛╨╡╨║ ╨╖╨▓╤Г╨║╨░ ╨┤╨╗╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣"""
        __tablename__ = 'audio_settings'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)
        website_volume = Column(Integer, nullable=False, default=50)  # ╨У╤А╨╛╨╝╨║╨╛╤Б╤В╤М ╨╜╨░ ╤Б╨░╨╣╤В╨╡ (0-100)
        obs_volume = Column(Integer, nullable=False, default=50)  # ╨У╤А╨╛╨╝╨║╨╛╤Б╤В╤М ╨▓ OBS (0-100)
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    class TTSUserSettings(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨▒╨░╨╖╨╛╨▓╤Л╤Е ╨╜╨░╤Б╤В╤А╨╛╨╡╨║ TTS ╨┤╨╗╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣"""
        __tablename__ = 'tts_user_settings'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, nullable=True, unique=True)  # ╨Ф╨╗╤П ╨╛╨▒╤Л╤З╨╜╤Л╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
        session_id = Column(String, nullable=True, unique=True)  # ╨Ф╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣
        
        # ╨Ю╤Б╨╜╨╛╨▓╨╜╤Л╨╡ ╨╜╨░╤Б╤В╤А╨╛╨╣╨║╨╕ TTS
        engine = Column(String, nullable=False, default='gtts')  # 'gtts' ╨╕╨╗╨╕ 'f5tts'
        voice = Column(String, nullable=False, default='female_1')  # ╨У╨╛╨╗╨╛╤Б ╨┤╨╗╤П ╨╛╨╖╨▓╤Г╤З╨║╨╕
        listening_mode = Column(String, nullable=False, default='website')  # 'website' ╨╕╨╗╨╕ 'obs'
        
        # ╨Я╨╗╨░╤В╤Д╨╛╤А╨╝╤Л ╨┤╨╗╤П ╨╛╨╖╨▓╤Г╤З╨║╨╕
        enabled_platforms = Column(JSON, nullable=False, default=lambda: ['twitch', 'vk'])  # ╨б╨┐╨╕╤Б╨╛╨║ ╨░╨║╤В╨╕╨▓╨╜╤Л╤Е ╨┐╨╗╨░╤В╤Д╨╛╤А╨╝
        
        # ╨а╨╡╨╢╨╕╨╝ ╤А╨░╨▒╨╛╤В╤Л TTS (NEW!)
        tts_mode = Column(String, nullable=False, default='all_messages')  # 'all_messages' ╨╕╨╗╨╕ 'channel_points'
        tts_reward_ids = Column(JSON, nullable=False, default=lambda: {})  # {"twitch": "reward_id", "vk": "reward_id"}
        
        # ╨д╨╕╨╗╤М╤В╤А╤Л ╤Н╨╝╨╛╨┤╨╖╨╕ ╨╕ ╤Б╨╝╨░╨╣╨╗╨╛╨▓
        enable_7tv = Column(Boolean, nullable=False, default=False)  # ╨Т╨║╨╗╤О╤З╨╕╤В╤М 7TV ╤Б╨╝╨░╨╣╨╗╤Л
        enable_twitch = Column(Boolean, nullable=False, default=False)  # ╨Т╨║╨╗╤О╤З╨╕╤В╤М Twitch ╤Б╨╝╨░╨╣╨╗╤Л
        enable_lexicon_filter = Column(Boolean, nullable=False, default=True)  # ╨Т╨║╨╗╤О╤З╨╕╤В╤М ╤Д╨╕╨╗╤М╤В╤А ╨╗╨╡╨║╤Б╨╕╨║╨╕
        enable_custom_lexicon = Column(Boolean, nullable=False, default=False)  # ╨Т╨║╨╗╤О╤З╨╕╤В╤М ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М╤Б╨║╨╕╨╣ ╤Б╨╗╨╛╨▓╨░╤А╤М
        
        # ╨Ф╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╤Л╨╡ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╤Л
        max_message_length = Column(Integer, nullable=False, default=500)  # ╨Ь╨░╨║╤Б╨╕╨╝╨░╨╗╤М╨╜╨░╤П ╨┤╨╗╨╕╨╜╨░ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╤П
        skip_commands = Column(Boolean, nullable=False, default=True)  # ╨Я╤А╨╛╨┐╤Г╤Б╨║╨░╤В╤М ╨║╨╛╨╝╨░╨╜╨┤╤Л (╨╜╨░╤З╨╕╨╜╨░╤О╤Й╨╕╨╡╤Б╤П ╤Б !)
        use_local_tts = Column(Boolean, nullable=False, default=False)  # ╨Ш╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╤М ╨╗╨╛╨║╨░╨╗╤М╨╜╤Л╨╣ TTS F5 ╨┤╨▓╨╕╨╢╨╛╨║
        
        # ╨д╨╕╨╗╤М╤В╤А╤Л ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╣ (╨╛╨┐╤Ж╨╕╨╛╨╜╨░╨╗╤М╨╜╤Л╨╡)
        filter_replies = Column(Boolean, nullable=False, default=False)  # ╨д╨╕╨╗╤М╤В╤А╨╛╨▓╨░╤В╤М ╨╛╤В╨▓╨╡╤В╤Л (reply)
        filter_mentions = Column(Boolean, nullable=False, default=False)  # ╨д╨╕╨╗╤М╤В╤А╨╛╨▓╨░╤В╤М ╤Г╨┐╨╛╨╝╨╕╨╜╨░╨╜╨╕╤П (@username)
        
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
        
        # ╨Ю╨│╤А╨░╨╜╨╕╤З╨╡╨╜╨╕╨╡: ╨┤╨╛╨╗╨╢╨╡╨╜ ╨▒╤Л╤В╤М ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜ ╨╗╨╕╨▒╨╛ user_id, ╨╗╨╕╨▒╨╛ session_id
        __table_args__ = (
            CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session'),
            {'extend_existing': True}
        )

    class LocalTTSEndpoint(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨║╨╛╨╜╤Д╨╕╨│╤Г╤А╨░╤Ж╨╕╨╕ ╨╗╨╛╨║╨░╨╗╤М╨╜╨╛╨│╨╛ TTS F5 ╨┤╨▓╨╕╨╢╨║╨░"""
        __tablename__ = 'local_tts_endpoints'
        __table_args__ = (
            CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_local_tts'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # ╨Ф╨╗╤П ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╨╜╤Л╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
        session_id = Column(String, nullable=True, index=True)  # ╨Ф╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣
        
        # ╨Ъ╨╛╨╜╤Д╨╕╨│╤Г╤А╨░╤Ж╨╕╤П endpoint
        endpoint_url = Column(String, nullable=False)  # URL ╨╗╨╛╨║╨░╨╗╤М╨╜╨╛╨│╨╛ TTS ╤Б╨╡╤А╨▓╨╕╤Б╨░ (╨╜╨░╨┐╤А╨╕╨╝╨╡╤А: http://localhost:8001)
        api_key = Column(String, nullable=True)  # ╨Ю╨┐╤Ж╨╕╨╛╨╜╨░╨╗╤М╨╜╤Л╨╣ API ╨║╨╗╤О╤З ╨┤╨╗╤П ╨▒╨╡╨╖╨╛╨┐╨░╤Б╨╜╨╛╤Б╤В╨╕
        is_active = Column(Boolean, default=True)

  # ╨Р╨║╤В╨╕╨▓╨╡╨╜ ╨╗╨╕ endpoint
        use_local = Column(Boolean, default=False)  # ╨Ш╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╤М ╨╗╨╛╨║╨░╨╗╤М╨╜╤Л╨╣ ╨▓╨╝╨╡╤Б╤В╨╛ ╤Ж╨╡╨╜╤В╤А╨░╨╗╨╕╨╖╨╛╨▓╨░╨╜╨╜╨╛╨│╨╛
        # ╨б╤В╨░╤В╤Г╤Б ╨╕ ╨╝╨╛╨╜╨╕╤В╨╛╤А╨╕╨╜╨│
        last_health_check = Column(DateTime, nullable=True)  # ╨Я╨╛╤Б╨╗╨╡╨┤╨╜╤П╤П ╨┐╤А╨╛╨▓╨╡╤А╨║╨░ ╨╖╨┤╨╛╤А╨╛╨▓╤М╤П
        is_healthy = Column(Boolean, default=False)  # ╨Ф╨╛╤Б╤В╤Г╨┐╨╡╨╜ ╨╗╨╕ ╤Б╨╡╤А╨▓╨╕╤Б
        health_check_failures = Column(Integer, default=0)  # ╨Ъ╨╛╨╗╨╕╤З╨╡╤Б╤В╨▓╨╛ ╨╜╨╡╤Г╨┤╨░╤З╨╜╤Л╤Е ╨┐╤А╨╛╨▓╨╡╤А╨╛╨║
        
        # ╨Ь╨╡╤В╨░╨┤╨░╨╜╨╜╤Л╨╡
        tts_version = Column(String, nullable=True)  # ╨Т╨╡╤А╤Б╨╕╤П TTS ╨┤╨▓╨╕╨╢╨║╨░
        gpu_info = Column(JSON, nullable=True)  # ╨Ш╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤П ╨╛ GPU
        
        
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
    class AdminUser(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨░╨┤╨╝╨╕╨╜╨╕╤Б╤В╤А╨░╤В╨╛╤А╨╛╨▓ ╤Б╨╕╤Б╤В╨╡╨╝╤Л"""
        __tablename__ = 'admin_users'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        platform = Column(String, nullable=False)  # 'twitch', 'vk', etc.
        platform_user_id = Column(String, nullable=False)  # ID ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╜╨░ ╨┐╨╗╨░╤В╤Д╨╛╤А╨╝╨╡
        username = Column(String, nullable=True)  # ╨Ш╨╝╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╜╨░ ╨┐╨╗╨░╤В╤Д╨╛╤А╨╝╨╡
        is_active = Column(Boolean, default=True)

  # ╨Р╨║╤В╨╕╨▓╨╡╨╜ ╨╗╨╕ ╨░╨┤╨╝╨╕╨╜
        permissions = Column(JSON, nullable=True)  # ╨Ф╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╤Л╨╡ ╨┐╤А╨░╨▓╨░
        created_by = Column(Integer, ForeignKey('users.id'), nullable=True)  # ╨Ъ╤В╨╛ ╤Б╨╛╨╖╨┤╨░╨╗ ╨░╨┤╨╝╨╕╨╜╨░
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
        # ╨г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╣ ╨╕╨╜╨┤╨╡╨║╤Б ╨┤╨╗╤П platform + platform_user_id
        __table_args__ = (
            UniqueConstraint('platform', 'platform_user_id', name='uq_admin_platform_user'),
            {'extend_existing': True}
        )



    class SupportTicket(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╤В╨╕╨║╨╡╤В╨╛╨▓ ╨┐╨╛╨┤╨┤╨╡╤А╨╢╨║╨╕"""
        __tablename__ = "support_tickets"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # ╨Ь╨╛╨╢╨╡╤В ╨▒╤Л╤В╤М null ╨┤╨╗╤П ╨░╨╜╨╛╨╜╨╕╨╝╨╜╤Л╤Е ╤В╨╕╨║╨╡╤В╨╛╨▓
        user_name = Column(String, nullable=True)  # ╨Ш╨╝╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П (╨╡╤Б╨╗╨╕ ╨╜╨╡ ╨░╤Г╤В╨╡╨╜╤В╨╕╤Д╨╕╤Ж╨╕╤А╨╛╨▓╨░╨╜)
        user_email = Column(String, nullable=True)  # Email ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П (╨╛╨┐╤Ж╨╕╨╛╨╜╨░╨╗╤М╨╜╨╛)
        subject = Column(String, nullable=False)  # ╨в╨╡╨╝╨░ ╤В╨╕╨║╨╡╤В╨░
        message = Column(Text, nullable=False)  # ╨б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╡ (╨┤╨╛ 500 ╤Б╨╕╨╝╨▓╨╛╨╗╨╛╨▓)
        status = Column(String, default="open")  # open, in_progress, closed
        priority = Column(String, default="medium")  # low, medium, high, urgent
        admin_notes = Column(Text, nullable=True)  # ╨Ч╨░╨╝╨╡╤В╨║╨╕ ╨░╨┤╨╝╨╕╨╜╨╕╤Б╤В╤А╨░╤В╨╛╤А╨░
        is_archived = Column(Boolean, default=False)  # ╨д╨╗╨░╨│ ╨░╤А╤Е╨╕╨▓╨╕╤А╨╛╨▓╨░╨╜╨╕╤П
        created_at = Column(DateTime, default=datetime.utcnow, index=True)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
        closed_at = Column(DateTime, nullable=True)

    class TicketResponse(Base):
        """╨Ь╨╛╨┤╨╡╨╗╤М ╨╛╤В╨▓╨╡╤В╨╛╨▓ ╨╜╨░ ╤В╨╕╨║╨╡╤В╤Л"""
        __tablename__ = "ticket_responses"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        ticket_id = Column(Integer, ForeignKey('support_tickets.id'), nullable=False)
        author_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # ID ╨░╨┤╨╝╨╕╨╜╨╕╤Б╤В╤А╨░╤В╨╛╤А╨░ (null ╨┤╨╗╤П ╤Б╨╕╤Б╤В╨╡╨╝╨╜╤Л╤Е ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╣)
        author_name = Column(String, nullable=False)  # ╨Ш╨╝╤П ╨░╨▓╤В╨╛╤А╨░ ╨╛╤В╨▓╨╡╤В╨░
        message = Column(Text, nullable=False)  # ╨в╨╡╨║╤Б╤В ╨╛╤В╨▓╨╡╤В╨░
        is_admin_response = Column(Boolean, default=True)  # True ╨┤╨╗╤П ╨╛╤В╨▓╨╡╤В╨╛╨▓ ╨░╨┤╨╝╨╕╨╜╨╛╨▓, False ╨┤╨╗╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
        is_read = Column(Boolean, default=False)  # ╨Я╤А╨╛╤З╨╕╤В╨░╨╜ ╨╗╨╕ ╨╛╤В╨▓╨╡╤В ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╝
        created_at = Column(DateTime, default=datetime.utcnow, index=True)

except Exception as e:
    logger.error(f"тЭМ ╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╤Б╨║╨╛╨╜╤Д╨╕╨│╤Г╤А╨╕╤А╨╛╨▓╨░╤В╤М ╨▒╨░╨╖╤Г ╨┤╨░╨╜╨╜╤Л╤Е: {e}")
    # ╨г╤Б╤В╨░╨╜╨░╨▓╨╗╨╕╨▓╨░╨╡╨╝ ╨╖╨░╨│╨╗╤Г╤И╨║╨╕, ╤З╤В╨╛╨▒╤Л ╨┐╤А╨╕╨╗╨╛╨╢╨╡╨╜╨╕╨╡ ╨╜╨╡ ╨┐╨░╨┤╨░╨╗╨╛
    engine = None
    SessionLocal = None
    Base = object()
    User = WhitelistedChannel = YouTubeVideo = object()
    def get_db():
        raise RuntimeError("╨С╨░╨╖╨░ ╨┤╨░╨╜╨╜╤Л╤Е ╨╜╨╡ ╤Б╨║╨╛╨╜╤Д╨╕╨│╤Г╤А╨╕╤А╨╛╨▓╨░╨╜╨░")
    def init_db():
        raise RuntimeError("╨С╨░╨╖╨░ ╨┤╨░╨╜╨╜╤Л╤Е ╨╜╨╡ ╤Б╨║╨╛╨╜╤Д╨╕╨│╤Г╤А╨╕╤А╨╛╨▓╨░╨╜╨░")

# === ╨б╨Ш╨б╨в╨Х╨Ь╨Р ╨Ы╨г╨в╨С╨Ю╨Ъ╨б╨Ю╨Т ╨Ш ╨У╨Х╨Щ╨Ь╨Ш╨д╨Ш╨Ъ╨Р╨ж╨Ш╨Ш ===

class ChatMessage(Base):
    """╨б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╤П ╨╕╨╖ ╤З╨░╤В╨░ ╨┤╨╗╤П ╨╛╤В╤Б╨╗╨╡╨╢╨╕╨▓╨░╨╜╨╕╤П ╨░╨║╤В╨╕╨▓╨╜╨╛╤Б╤В╨╕"""
    __tablename__ = "chat_messages"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)  # twitch, vk_live
    author_username = Column(String, nullable=True, index=True)  # ╨Ш╨╝╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╕╨╖ ╤З╨░╤В╨░
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    is_deleted = Column(Boolean, default=False)
    
    # ╨а╨╛╨╗╨╕ ╨╕ ╨╖╨╜╨░╤З╨║╨╕ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П
    role = Column(String, nullable=True)  # moderator, subscriber, vip, broadcaster
    badges = Column(JSON, nullable=True)  # ╨Ь╨░╤Б╤Б╨╕╨▓ ╨╖╨╜╨░╤З╨║╨╛╨▓: ["broadcaster/1", "subscriber/12", "premium/1"]

class UserProgression(Base):
    """╨Я╤А╨╛╨│╤А╨╡╤Б╤Б╨╕╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣ ╨▓ ╤Б╨╕╤Б╤В╨╡╨╝╨╡ ╨┤╨╛╤Б╤В╨╕╨╢╨╡╨╜╨╕╨╣"""
    __tablename__ = "user_progression"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)  # twitch, vk_live
    
    # ╨б╤В╨░╤В╨╕╤Б╤В╨╕╨║╨░ ╨░╨║╤В╨╕╨▓╨╜╨╛╤Б╤В╨╕
    total_days_active = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)  # ╨в╨╡╨║╤Г╤Й╨░╤П ╤Б╨╡╤А╨╕╤П ╨┤╨╜╨╡╨╣
    longest_streak = Column(Integer, default=0)  # ╨б╨░╨╝╨░╤П ╨┤╨╗╨╕╨╜╨╜╨░╤П ╤Б╨╡╤А╨╕╤П
    last_activity_date = Column(DateTime)
    total_messages = Column(Integer, default=0)
    
    # ╨Ф╨╛╨╜╨░╤В╤Л
    total_donated = Column(Float, default=0.0)
    total_donations_count = Column(Integer, default=0)
    
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Achievement(Base):
    """╨Ф╨╛╤Б╤В╨╕╨╢╨╡╨╜╨╕╤П, ╨║╨╛╤В╨╛╤А╤Л╨╡ ╨╝╨╛╨╢╨╜╨╛ ╨┐╨╛╨╗╤Г╤З╨╕╤В╤М"""
    __tablename__ = "achievements"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    channel_name = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    type = Column(String, nullable=False)  # daily_streak, total_days, total_donated, etc.
    requirement_value = Column(Integer, nullable=False)  # ╨Ч╨╜╨░╤З╨╡╨╜╨╕╨╡ ╨┤╨╗╤П ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П
    reward_type = Column(String, nullable=False)  # free_lootbox, paid_lootbox, special
    reward_value = Column(Integer, default=1)  # ╨Ъ╨╛╨╗╨╕╤З╨╡╤Б╤В╨▓╨╛ ╨╜╨░╨│╤А╨░╨┤
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

class UserAchievement(Base):
    """╨Я╨╛╨╗╤Г╤З╨╡╨╜╨╜╤Л╨╡ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П╨╝╨╕ ╨┤╨╛╤Б╤В╨╕╨╢╨╡╨╜╨╕╤П"""
    __tablename__ = "user_achievements"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    achievement_id = Column(Integer, ForeignKey("achievements.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    earned_at = Column(DateTime, default=datetime.utcnow)
    is_claimed = Column(Boolean, default=False)  # ╨Ч╨░╨▒╤А╨░╨╜╨░ ╨╗╨╕ ╨╜╨░╨│╤А╨░╨┤╨░

class DonationAlert(Base):
    """╨Ф╨╛╨╜╨░╤В╤Л ╤З╨╡╤А╨╡╨╖ DonationAlerts"""
    __tablename__ = "donation_alerts"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="RUB")
    message = Column(Text)
    alert_id = Column(String, unique=True, index=True)  # ID ╨╕╨╖ DonationAlerts
    processed_at = Column(DateTime, default=datetime.utcnow)
    is_processed = Column(Boolean, default=False)

    # === ╨б╨Ш╨б╨в╨Х╨Ь╨Р DROPS ===

class DropsType(Base):
    """╨в╨╕╨┐╤Л Drops"""
    __tablename__ = 'drops_types'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # "╨б╤В╤А╨╕╨║", "╨Ф╨╛╨╜╨░╤В", "╨Ь╨╕╤Д╨╕╤З╨╡╤Б╨║╨╕╨╣"
    description = Column(Text)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=utcnow_naive)

class DropsQuality(Base):
    """╨Ъ╨░╤З╨╡╤Б╤В╨▓╨░ Drops"""
    __tablename__ = 'drops_qualities'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # "Common", "Rare", "Epic", "Legendary"
    color = Column(String, nullable=False)  # Hex ╤Ж╨▓╨╡╤В
    weight = Column(Integer, default=100)  # ╨Т╨╡╤Б ╨┤╨╗╤П ╤Б╨╗╤Г╤З╨░╨╣╨╜╨╛╨│╨╛ ╨▓╤Л╨▒╨╛╤А╨░
    created_at = Column(DateTime, default=utcnow_naive)

class DropsConfig(Base):
    """╨Ъ╨╛╨╜╤Д╨╕╨│╤Г╤А╨░╤Ж╨╕╤П Drops ╨┤╨╗╤П ╨║╨░╨╜╨░╨╗╨░"""
    __tablename__ = 'drops_configs'
    __table_args__ = (
        CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_drops_config'),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # ╨Ф╨╗╤П ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╨╜╤Л╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
    session_id = Column(String, nullable=True, index=True)  # ╨Ф╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=True, default="global")  # twitch, vk, или "global" для общих настроек
    
    # ╨б╤В╤А╨╕╨║ ╨╜╨░╤Б╤В╤А╨╛╨╣╨║╨╕ (общие настройки)
    streak_days_common = Column(Integer, default=1)
    streak_days_rare = Column(Integer, default=3)
    streak_days_epic = Column(Integer, default=7)
    streak_days_legendary = Column(Integer, default=14)
    streak_messages_required = Column(Integer, default=5)  # ╨б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╣ ╨▓ ╤З╨░╤В╨╡ ╨╖╨░ ╤Б╤В╤А╨╕╨╝
    streak_reset_on_skip = Column(Boolean, default=True)  # ╨б╨▒╤А╨░╤Б╤Л╨▓╨░╤В╤М ╤Б╤В╤А╨╕╨║ ╨┐╤А╨╕ ╨┐╤А╨╛╨┐╤Г╤Б╨║╨╡ ╤Б╤В╤А╨╕╨╝╨░
    # Флаги включения стрика для каждой платформы
    streak_enabled_twitch = Column(Boolean, nullable=False, server_default='false')  # Включен ли стрик для Twitch
    streak_enabled_vk = Column(Boolean, nullable=False, server_default='false')  # Включен ли стрик для VK Live
    # Устаревшее поле (оставляем для обратной совместимости)
    streak_enabled = Column(Boolean, default=False)  # DEPRECATED: использовать streak_enabled_twitch/vk
    
    # ╨Ф╨╛╨╜╨░╤В ╨╜╨░╤Б╤В╤А╨╛╨╣╨║╨╕
    donation_enabled = Column(Boolean, default=True)
    donation_amount_common = Column(Float, default=50.0)
    donation_amount_rare = Column(Float, default=100.0)
    donation_amount_epic = Column(Float, default=500.0)
    donation_amount_legendary = Column(Float, default=1000.0)
    
    # ╨Ь╨╕╤Д╨╕╤З╨╡╤Б╨║╨╕╨╣ ╨╗╤Г╤В╨▒╨╛╨║╤Б
    mythical_enabled = Column(Boolean, default=True)
    mythical_min_interval_hours = Column(Integer, default=2)  # ╨Ь╨╕╨╜╨╕╨╝╨░╨╗╤М╨╜╤Л╨╣ ╨╕╨╜╤В╨╡╤А╨▓╨░╨╗
    mythical_max_interval_hours = Column(Integer, default=8)  # ╨Ь╨░╨║╤Б╨╕╨╝╨░╨╗╤М╨╜╤Л╨╣ ╨╕╨╜╤В╨╡╤А╨▓╨░╨╗
    mythical_window_duration_minutes = Column(Integer, default=5)  # ╨Ф╨╗╨╕╤В╨╡╨╗╤М╨╜╨╛╤Б╤В╤М ╨╛╨║╨╜╨░
    mythical_donation_amount = Column(Float, default=2000.0)  # ╨б╤Г╨╝╨╝╨░ ╨┤╨╗╤П ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П
    mythical_last_appeared = Column(DateTime, nullable=True)  # ╨Я╨╛╤Б╨╗╨╡╨┤╨╜╨╡╨╡ ╨┐╨╛╤П╨▓╨╗╨╡╨╜╨╕╨╡
    
    # ╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╨▓╨╕╨┤╨╢╨╡╤В╨░ (OBS ╨░╨╜╨╕╨╝╨░╤Ж╨╕╤П)
    widget_spinning_duration_ms = Column(Integer, default=1500)  # ╨Ф╨╗╨╕╤В╨╡╨╗╤М╨╜╨╛╤Б╤В╤М ╨║╤А╤Г╤В╨║╨╕ (╨╝╤Б)
    widget_opening_duration_ms = Column(Integer, default=1000)  # ╨Ф╨╗╨╕╤В╨╡╨╗╤М╨╜╨╛╤Б╤В╤М ╨╛╤В╨║╤А╤Л╤В╨╕╤П (╨╝╤Б)
    widget_result_duration_ms = Column(Integer, default=5500)  # ╨Ф╨╗╨╕╤В╨╡╨╗╤М╨╜╨╛╤Б╤В╤М ╨┐╨╛╨║╨░╨╖╨░ ╤А╨╡╨╖╤Г╨╗╤М╤В╨░╤В╨░ (╨╝╤Б)
    widget_closing_duration_ms = Column(Integer, default=500)  # ╨Ф╨╗╨╕╤В╨╡╨╗╤М╨╜╨╛╤Б╤В╤М ╨╖╨░╨║╤А╤Л╤В╨╕╤П (╨╝╤Б)
    widget_token = Column(String, nullable=True, unique=True, index=True)  # ╨г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╣ ╤В╨╛╨║╨╡╨╜ ╨┤╨╗╤П ╨▓╨╕╨┤╨╢╨╡╤В╨░ OBS
    
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

class DropsReward(Base):
    """╨Э╨░╨│╤А╨░╨┤╤Л ╨▓ Drops"""
    __tablename__ = 'drops_rewards'
    __table_args__ = (
        CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_drops_reward'),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # ╨Ф╨╗╤П ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╨╜╤Л╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
    session_id = Column(String, nullable=True, index=True)  # ╨Ф╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    
    name = Column(String, nullable=False)
    description = Column(Text)
    quality_id = Column(Integer, ForeignKey('drops_qualities.id'), nullable=False)
    weight = Column(Integer, default=100)  # ╨Т╨╡╤Б ╨┤╨╗╤П ╤Б╨╗╤Г╤З╨░╨╣╨╜╨╛╨│╨╛ ╨▓╤Л╨▒╨╛╤А╨░
    
    # ╨в╨╕╨┐ ╨╜╨░╨│╤А╨░╨┤╤Л
    reward_type = Column(String, nullable=False)  # "points", "voice", "command", "custom"
    reward_value = Column(String, nullable=False)  # ╨Ч╨╜╨░╤З╨╡╨╜╨╕╨╡ ╨╜╨░╨│╤А╨░╨┤╤Л (JSON)
    
    # ╨Ш╨╖╨╛╨▒╤А╨░╨╢╨╡╨╜╨╕╨╡ ╨┤╨╗╤П ╨║╨░╤А╤В╨╛╤З╨║╨╕ ╨▓ ╨│╨░╤З╨░ ╨║╤А╤Г╤В╨║╨╡
    image_url = Column(String, nullable=True)  # URL ╨╕╨╖╨╛╨▒╤А╨░╨╢╨╡╨╜╨╕╤П ╨╜╨░╨│╤А╨░╨┤╤Л
    
    # ╨Ч╨▓╤Г╨║ ╨╜╨░╨│╤А╨░╨┤╤Л
    sound_file = Column(String, nullable=True)  # ╨Я╤Г╤В╤М ╨║ ╤Д╨░╨╣╨╗╤Г ╨╖╨▓╤Г╨║╨░
    sound_volume = Column(Float, default=1.0)
    
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

class UserStreak(Base):
    """╨б╤В╤А╨╕╨║╨╕ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣"""
    __tablename__ = 'user_streaks'
    __table_args__ = (
        UniqueConstraint('user_id', 'viewer_id', 'platform', name='uq_user_streak'),
        UniqueConstraint('session_id', 'viewer_id', 'platform', name='uq_session_streak'),
        CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_user_streak'),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # ╨Ф╨╗╤П ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╨╜╤Л╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
    session_id = Column(String, nullable=True, index=True)  # ╨Ф╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    viewer_id = Column(String, nullable=False, index=True)
    viewer_name = Column(String, nullable=False)
    
    current_streak = Column(Integer, default=0)
    max_streak = Column(Integer, default=0)
    last_activity = Column(DateTime, default=utcnow_naive)
    messages_this_stream = Column(Integer, default=0)
    
    # ✅ НОВОЕ: Информация о последней трансляции
    last_stream_session_id = Column(Integer, ForeignKey('stream_sessions.id'), nullable=True, index=True)  # ID последней трансляции, в которой участвовал зритель
    last_stream_attended_at = Column(DateTime, nullable=True, index=True)  # Время последнего посещения трансляции
    
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

class DropsHistory(Base):
    """╨Ш╤Б╤В╨╛╤А╨╕╤П ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П Drops"""
    __tablename__ = 'drops_history'
    __table_args__ = (
        CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_drops_history'),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # ╨Ф╨╗╤П ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╨╜╤Л╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
    session_id = Column(String, nullable=True, index=True)  # ╨Ф╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    viewer_id = Column(String, nullable=False, index=True)
    viewer_name = Column(String, nullable=False)
    
    # ╨в╨╕╨┐ ╨╗╤Г╤В╨▒╨╛╨║╤Б╨░
    lootbox_type = Column(String, nullable=False)  # "streak", "donation", "mythical"
    quality_id = Column(Integer, ForeignKey('drops_qualities.id'), nullable=False)
    
    # ╨Я╨╛╨╗╤Г╤З╨╡╨╜╨╜╨░╤П ╨╜╨░╨│╤А╨░╨┤╨░
    reward_id = Column(Integer, ForeignKey('drops_rewards.id'), nullable=True)
    reward_name = Column(String, nullable=False)
    reward_type = Column(String, nullable=False)
    reward_value = Column(String, nullable=False)  # JSON
    
    # ╨Ф╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╨░╤П ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤П
    donation_amount = Column(Float, nullable=True)  # ╨б╤Г╨╝╨╝╨░ ╨┤╨╛╨╜╨░╤В╨░ (╨╡╤Б╨╗╨╕ ╨┤╨╛╨╜╨░╤В╨╜╤Л╨╣)
    streak_days = Column(Integer, nullable=True)  # ╨Ф╨╜╨╕ ╤Б╤В╤А╨╕╨║╨░ (╨╡╤Б╨╗╨╕ ╤Б╤В╤А╨╕╨║)
    messages_count = Column(Integer, nullable=True)  # ╨Ъ╨╛╨╗╨╕╤З╨╡╤Б╤В╨▓╨╛ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╣
    
    # ╨Т╨╜╨╡╤И╨╜╨╕╨╡ ╨┤╨░╨╜╨╜╤Л╨╡
    donation_alert_id = Column(String, nullable=True)  # ID ╨╕╨╖ DonationAlerts
    chat_message_id = Column(Integer, nullable=True)  # ID ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╤П ╨▓ ╤З╨░╤В╨╡
    
    created_at = Column(DateTime, default=utcnow_naive, index=True)


class UserVoiceSettings(Base):
    """Personal settings for voices (both custom and global)
    
    For global voices: stores user's personal settings (speed, volume, CFG) that apply only to them.
    For custom voices: this table is not used (settings are stored in TTS service).
    """
    __tablename__ = 'user_voice_settings'
    __table_args__ = (
        UniqueConstraint('user_id', 'voice_id', name='uq_user_voice_settings'),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    voice_id = Column(Integer, nullable=False, index=True)  # ID голоса из TTS service
    voice_name = Column(String, nullable=False)  # Имя голоса для удобства
    
    # Personal settings for this voice
    cfg_strength = Column(Float, nullable=True)  # Stability/CFG strength (0.1-10.0)
    speed_preset = Column(Float, nullable=True)  # Speed preset (0.5-2.0)
    volume = Column(Float, nullable=True)  # Volume (0-100)
    
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)


class MythicalDropsSession(Base):
    """╨б╨╡╤Б╤Б╨╕╨╕ ╨╝╨╕╤Д╨╕╤З╨╡╤Б╨║╨╕╤Е Drops"""
    __tablename__ = 'mythical_drops_sessions'
    __table_args__ = (
        CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_mythical_drops'),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # ╨Ф╨╗╤П ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╨╜╤Л╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
    session_id = Column(String, nullable=True, index=True)  # ╨Ф╨╗╤П ╨│╨╛╤Б╤В╨╡╨╣
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    
    # ╨Я╨░╤А╨░╨╝╨╡╤В╤А╤Л ╤Б╨╡╤Б╤Б╨╕╨╕
    donation_amount = Column(Float, nullable=False)
    window_duration_minutes = Column(Integer, nullable=False)
    
    # ╨б╤В╨░╤В╤Г╤Б
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
        CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_stream_session'),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # Для авторизованных пользователей
    session_id = Column(String, nullable=True, index=True)  # Для гостей
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)  # twitch, vk
    
    # Время начала и конца трансляции
    started_at = Column(DateTime, nullable=False, default=utcnow_naive, index=True)
    ended_at = Column(DateTime, nullable=True, index=True)
    
    # Статус трансляции
    is_active = Column(Boolean, default=True, index=True)
    
    # Дополнительная информация
    viewer_count_peak = Column(Integer, default=0)  # Пиковое количество зрителей
    title = Column(String, nullable=True)  # Название трансляции
    
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

# ╨д╤Г╨╜╨║╤Ж╨╕╤П ╨┤╨╗╤П ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╤Б╨╡╤Б╤Б╨╕╨╡╨╣ ╨С╨Ф
def get_db():
    """╨д╤Г╨╜╨║╤Ж╨╕╤П-╨│╨╡╨╜╨╡╤А╨░╤В╨╛╤А ╨┤╨╗╤П ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╤Б╨╡╤Б╤Б╨╕╨╕ ╨С╨Ф"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """╨Ш╨╜╨╕╤Ж╨╕╨░╨╗╨╕╨╖╨╕╤А╤Г╨╡╤В ╨▒╨░╨╖╤Г ╨┤╨░╨╜╨╜╤Л╤Е ╨╕ ╤Б╨╛╨╖╨┤╨░╨╡╤В ╤В╨░╨▒╨╗╨╕╤Ж╤Л, ╨╡╤Б╨╗╨╕ ╨╕╤Е ╨╜╨╡╤В."""
    if engine is None:
        logger.error("тЭМ ╨С╨░╨╖╨░ ╨┤╨░╨╜╨╜╤Л╤Е ╨╜╨╡ ╤Б╨║╨╛╨╜╤Д╨╕╨│╤Г╤А╨╕╤А╨╛╨▓╨░╨╜╨░")
        return
        
    # ╨б╨╛╨╖╨┤╨░╨╡╨╝ ╨▓╤Б╨╡ ╤В╨░╨▒╨╗╨╕╤Ж╤Л
    Base.metadata.create_all(bind=engine)
    
    # ╨б╨┐╨╕╤Б╨╛╨║ ╨▒╨╛╤В╨╛╨▓ ╨┤╨╗╤П ╨▒╨╗╨╛╨║╨╕╤А╨╛╨▓╨║╨╕ ╨┐╨╛ ╤Г╨╝╨╛╨╗╤З╨░╨╜╨╕╤О
    DEFAULT_BLOCKED_BOTS = [
        'nightbot', 'streamlabs', 'fossabot', 'moobot', 'streamelements', 'wizebot', 'ankhbot', 'deepbot', 'phantombot', 'coebot'
    ]

    # ╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╕╨╡ ╨▒╨╛╤В╨╛╨▓ ╨┐╨╛ ╤Г╨╝╨╛╨╗╤З╨░╨╜╨╕╤О, ╨╡╤Б╨╗╨╕ ╨╕╤Е ╨╜╨╡╤В
    db = SessionLocal()
    try:
        existing_bots = {bot.bot_name for bot in db.query(BlockedBot).all()}
        for bot_name in DEFAULT_BLOCKED_BOTS:
            if bot_name not in existing_bots:
                db_bot = BlockedBot(bot_name=bot_name)
                db.add(db_bot)
        db.commit()
        logger.info("ЁЯдЦ Initialized default blocked bots in database")
    except Exception as e:
        logger.error(f"Error initializing blocked bots: {e}")
        db.rollback()
    finally:
        db.close()
    
    # ✅ Инициализация качеств лутбоксов (Drops Qualities)
    DEFAULT_QUALITIES = [
        {"name": "Common", "color": "#9ca3af", "weight": 100},
        {"name": "Rare", "color": "#3b82f6", "weight": 50},
        {"name": "Epic", "color": "#a855f7", "weight": 20},
        {"name": "Legendary", "color": "#eab308", "weight": 5},
        {"name": "Mythical", "color": "#ef4444", "weight": 1}
    ]
    
    db = SessionLocal()
    try:
        existing_qualities = {q.name for q in db.query(DropsQuality).all()}
        for quality_data in DEFAULT_QUALITIES:
            if quality_data["name"] not in existing_qualities:
                quality = DropsQuality(**quality_data)
                db.add(quality)
        db.commit()
        logger.info("🎁 Initialized default lootbox qualities")
    except Exception as e:
        logger.error(f"Error initializing lootbox qualities: {e}")
        db.rollback()
    finally:
        db.close()
    
    logger.info("тЬЕ ╨С╨░╨╖╨░ ╨┤╨░╨╜╨╜╤Л╤Е ╨╕╨╜╨╕╤Ж╨╕╨░╨╗╨╕╨╖╨╕╤А╨╛╨▓╨░╨╜╨░")

class SecurityLog(Base):
    """╨Ы╨╛╨│╨╕ ╨▒╨╡╨╖╨╛╨┐╨░╤Б╨╜╨╛╤Б╤В╨╕"""
    __tablename__ = 'security_logs'
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive, index=True)


class SystemLog(Base):
    """╨Ы╨╛╨│╨╕ ╨┤╨╡╨╣╤Б╤В╨▓╨╕╨╣ ╨▓ ╤Б╨╕╤Б╤В╨╡╨╝╨╡ (╨╕╤Б╤В╨╛╤А╨╕╤П ╨┤╨╡╨╣╤Б╤В╨▓╨╕╨╣ ╨░╨┤╨╝╨╕╨╜╨╕╤Б╤В╤А╨░╤В╨╛╤А╨╛╨▓)"""
    __tablename__ = 'system_logs'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    action_type = Column(String, nullable=False, index=True)  # "user_deleted", "user_blocked", "settings_changed", etc
    target_user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # ╨ж╨╡╨╗╨╡╨▓╨╛╨╣ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М (╨╡╤Б╨╗╨╕ ╨┐╤А╨╕╨╝╨╡╨╜╨╕╨╝╨╛)
    target_resource = Column(String, nullable=True)  # ╨Э╨░╨┐╤А╨╕╨╝╨╡╤А: "voice_123", "command_456", "bot_status"
    description = Column(String, nullable=True)  # ╨Я╨╛╨╜╤П╤В╨╜╨╛╨╡ ╨╛╨┐╨╕╤Б╨░╨╜╨╕╨╡ ╨┤╨╡╨╣╤Б╤В╨▓╨╕╤П
    old_value = Column(JSON, nullable=True)  # ╨б╤В╨░╤А╨╛╨╡ ╨╖╨╜╨░╤З╨╡╨╜╨╕╨╡ (╨╡╤Б╨╗╨╕ ╨╕╨╖╨╝╨╡╨╜╨╡╨╜╨╕╨╡)
    new_value = Column(JSON, nullable=True)  # ╨Э╨╛╨▓╨╛╨╡ ╨╖╨╜╨░╤З╨╡╨╜╨╕╨╡ (╨╡╤Б╨╗╨╕ ╨╕╨╖╨╝╨╡╨╜╨╡╨╜╨╕╨╡)
    ip_address = Column(String, nullable=True)  # IP ╨░╨┤╨╝╨╕╨╜╨░
    user_agent = Column(String, nullable=True)  # User Agent ╨░╨┤╨╝╨╕╨╜╨░
    details = Column(JSON, nullable=True)  # ╨Ф╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╤Л╨╡ ╨┤╨╡╤В╨░╨╗╨╕
    status = Column(String, default='success')  # success, failed, warning
    error_message = Column(String, nullable=True)  # ╨б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╡ ╨╛╨▒ ╨╛╤И╨╕╨▒╨║╨╡ ╨╡╤Б╨╗╨╕ ╨╡╤Б╤В╤М
    timestamp = Column(DateTime, default=utcnow_naive, index=True)



class ChatBoxSettings(Base):
    """╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╨║╨░╤Б╤В╨╛╨╝╨╕╨╖╨░╤Ж╨╕╨╕ ChatBox ╨┤╨╗╤П OBS ╨▓╨╕╨┤╨╢╨╡╤В╨░"""
    __tablename__ = 'chatbox_settings'
    __table_args__ = (
        UniqueConstraint('user_id', name='uq_chatbox_user'),
        UniqueConstraint('widget_token', name='uq_chatbox_token'),
        {'extend_existing': True}
    )
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    widget_token = Column(String, nullable=False, unique=True, index=True)  # ╨г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╣ ╤В╨╛╨║╨╡╨╜ ╨┤╨╗╤П OBS ╨▓╨╕╨┤╨╢╨╡╤В╨░
    
    # ╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╤И╤А╨╕╤Д╤В╨░
    font_family = Column(String, default='Inter')  # Google Font name
    font_size = Column(Integer, default=16)  # ╨▓ px
    font_weight = Column(String, default='normal')  # normal, bold, 600, etc
    text_stroke_width = Column(Integer, default=0)  # ╨в╨╛╨╗╤Й╨╕╨╜╨░ ╨║╨╛╨╜╤В╤Г╤А╨░ ╤В╨╡╨║╤Б╤В╨░ ╨▓ px (0 = ╨▒╨╡╨╖ ╨║╨╛╨╜╤В╤Г╤А╨░)
    text_stroke_color = Column(String, default='#000000')  # ╨ж╨▓╨╡╤В ╨║╨╛╨╜╤В╤Г╤А╨░ ╤В╨╡╨║╤Б╤В╨░
    
    # ╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╤Д╨╛╨╜╨░
    background_color = Column(String, default='#000000')  # ╨ж╨▓╨╡╤В ╤Д╨╛╨╜╨░
    background_opacity = Column(Float, default=0.5)  # ╨Я╤А╨╛╨╖╤А╨░╤З╨╜╨╛╤Б╤В╤М ╤Д╨╛╨╜╨░ (0-1)
    
    # ╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╨╛╤В╨╛╨▒╤А╨░╨╢╨╡╨╜╨╕╤П
    max_messages = Column(Integer, default=20)  # ╨Ъ╨╛╨╗╨╕╤З╨╡╤Б╤В╨▓╨╛ ╨╛╤В╨╛╨▒╤А╨░╨╢╨░╨╡╨╝╤Л╤Е ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╣ (╨╝╨╕╨╜: 1, ╨╝╨░╨║╤Б: 50)
    chat_direction = Column(String, default='vertical')  # vertical ╨╕╨╗╨╕ horizontal
    chat_width = Column(Integer, default=100)  # Ширина чата в vw (viewport width), по умолчанию 100vw
    show_platform_icons = Column(Boolean, default=True)  # ╨Я╨╛╨║╨░╨╖╤Л╨▓╨░╤В╤М ╨╕╨║╨╛╨╜╨║╨╕ ╨┐╨╗╨░╤В╤Д╨╛╤А╨╝ (Twitch/VK)
    show_roles = Column(Boolean, default=False)  # ╨Я╨╛╨║╨░╨╖╤Л╨▓╨░╤В╤М ╤А╨╛╨╗╨╕ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣ (╨Ь╨╛╨┤╨╡╤А╨░╤В╨╛╤А, ╨Я╨╛╨┤╨┐╨╕╤Б╤З╨╕╨║ ╨╕ ╤В.╨┤.)
    show_badges = Column(Boolean, default=True)  # ╨Я╨╛╨║╨░╨╖╤Л╨▓╨░╤В╤М ╨╖╨╜╨░╤З╨║╨╕ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣ (Twitch badges ╤З╨╡╤А╨╡╨╖ API)
    show_avatars = Column(Boolean, default=False)  # ╨Я╨╛╨║╨░╨╖╤Л╨▓╨░╤В╤М ╨░╨▓╨░╤В╨░╤А╤Л ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
    
    # ╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╤Ж╨▓╨╡╤В╨╛╨▓ ╤В╨╡╨║╤Б╤В╨░
    text_color = Column(String, default='#FFFFFF')  # ╨ж╨▓╨╡╤В ╤В╨╡╨║╤Б╤В╨░ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╣
    username_color = Column(String, default='#9147FF')  # ╨ж╨▓╨╡╤В ╨╕╨╝╨╡╨╜╨╕ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П
    
    # ╨Ф╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╤Л╨╡ ╨╜╨░╤Б╤В╤А╨╛╨╣╨║╨╕
    message_spacing = Column(Integer, default=4)  # ╨Ю╤В╤Б╤В╤Г╨┐ ╨╝╨╡╨╢╨┤╤Г ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╤П╨╝╨╕ ╨▓ px
    border_radius = Column(Integer, default=8)  # ╨б╨║╤А╤Г╨│╨╗╨╡╨╜╨╕╨╡ ╤Г╨│╨╗╨╛╨▓ ╨▓ px
    animation_duration = Column(Integer, default=300)  # ╨Ф╨╗╨╕╤В╨╡╨╗╤М╨╜╨╛╤Б╤В╤М ╨░╨╜╨╕╨╝╨░╤Ж╨╕╨╕ ╨┐╨╛╤П╨▓╨╗╨╡╨╜╨╕╤П ╨▓ ms
    animation_type = Column(String, default='fade')  # ╨в╨╕╨┐ ╨░╨╜╨╕╨╝╨░╤Ж╨╕╨╕: fade, slide-right, slide-left, scale, bounce
    message_fade_seconds = Column(Integer, default=60)  # ╨Т╤А╨╡╨╝╤П ╨┤╨╛ ╨╕╤Б╤З╨╡╨╖╨░╨╜╨╕╤П ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╤П (10-60 ╤Б╨╡╨║, 60 = ╨╜╨╡ ╨╕╤Б╤З╨╡╨╖╨░╤О╤В)
    
    # ╨Я╤П╤В╨╛╨╝ ╨▓ v0.03 - ╨Э╨╛╨┤╨┤╨╡╤А╨╖╨╕ 7TV ╤Б╨╝╨░╨╣╨╗╨╕╨║╨╛╨▓, ╤Ж╤Г╨║╨╛╨▒ ╨╕ ╨║╨░╤А╤В╨╕╨╜╨╛╨║
    show_7tv_emotes = Column(Boolean, default=True)  # ╨Я╨╛╨║╨░╨╖╤Л╨▓╨░╤В╤М ╤Б╨╝╨░╨╣╨╗╨╕╨║╨╕ 7TV
    show_links = Column(Boolean, default=True)  # ╨Я╨╛╨║╨░╨╖╤Л╨▓╨░╤В╤М ╤Ж╤Г╨║╨╛╨▓ ╨╕╨╖ ╤Ж╨░╤В╨░
    auto_load_images = Column(Boolean, default=True)  # ╨Х╨░╨│╤А╤Г╨╞╨░╤В╤М ╨║╨░╤А╤В╨╕╨╜╨║╨╕/╨│╨╕╤Д╨║╨╕ ╤Б╤А╨░╨╖╤Г ╨╕╨╗╨╕ ╨║╨░╨║ ╤Ж╤Г╨║╨╕
    
    
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
