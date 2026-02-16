# models/tts.py
"""
Модели для TTS (Text-to-Speech) настроек.
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Float,
    Index, UniqueConstraint, CheckConstraint
)
from core.datetime_utils import utcnow_naive
from models.base import Base


class TTSUserSettings(Base):
    """Модель базовых настроек TTS для пользователей"""
    __tablename__ = 'tts_user_settings'
    __table_args__ = (
        CheckConstraint(
            '(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)',
            name='check_user_or_session'
        ),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, unique=True)
    session_id = Column(String, nullable=True, unique=True)

    # Основные настройки TTS
    engine = Column(String, nullable=False, default='gtts')
    voice = Column(String, nullable=False, default='female_1')
    listening_mode = Column(String, nullable=False, default='website')
    gcloud_voices = Column(JSON, nullable=False, default=list)
    gcloud_mood = Column(String, nullable=False, default='neutral')

    # Платформы для озвучки
    enabled_platforms = Column(JSON, nullable=False, default=lambda: ['twitch', 'vk'])

    # Режим работы TTS
    tts_mode = Column(String, nullable=False, default='all_messages')
    tts_reward_ids = Column(JSON, nullable=False, default=lambda: {})

    # Фильтры эмодзи и смайлов
    enable_7tv = Column(Boolean, nullable=False, default=False)
    enable_twitch = Column(Boolean, nullable=False, default=False)
    enable_lexicon_filter = Column(Boolean, nullable=False, default=True)
    enable_custom_lexicon = Column(Boolean, nullable=False, default=False)

    # Дополнительные параметры
    max_message_length = Column(Integer, nullable=False, default=500)
    skip_commands = Column(Boolean, nullable=False, default=True)
    use_local_tts = Column(Boolean, nullable=False, default=False)

    # Фильтры сообщений
    filter_replies = Column(Boolean, nullable=False, default=False)
    filter_mentions = Column(Boolean, nullable=False, default=False)

    # YouTube настройки (playback_mode, volume_level)
    youtube_settings = Column(JSON, nullable=False, default=lambda: {'playback_mode': 'browser', 'volume_level': 100})

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)


class TTSBlockedUser(Base):
    """Модель пользователей, заблокированных от TTS"""
    __tablename__ = "tts_blocked_users"
    __table_args__ = (
        CheckConstraint(
            '(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)',
            name='check_user_or_session_tts_blocked_user'
        ),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    username = Column(String, nullable=False)
    blocked_at = Column(DateTime, default=utcnow_naive)
    blocked_by = Column(Integer, nullable=True)
    reason = Column(String, nullable=True)


class FilteredWord(Base):
    """Модель заблокированных слов для TTS"""
    __tablename__ = 'filtered_words'
    __table_args__ = (
        Index('idx_user_word', 'user_id', 'word'),
        Index('idx_session_word', 'session_id', 'word'),
        Index('idx_platform', 'platform'),
        Index('idx_active', 'is_active'),
        UniqueConstraint('user_id', 'word', 'platform', name='uq_user_word_platform'),
        UniqueConstraint('session_id', 'word', 'platform', name='uq_session_word_platform'),
        CheckConstraint(
            '(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)',
            name='check_user_or_session_filtered_word'
        ),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    word = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False, default='all')
    created_at = Column(DateTime, default=utcnow_naive, index=True)
    is_active = Column(Boolean, default=True)


class LocalTTSEndpoint(Base):
    """Модель конфигурации локального TTS F5 движка"""
    __tablename__ = 'local_tts_endpoints'
    __table_args__ = (
        CheckConstraint(
            '(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)',
            name='check_user_or_session_local_tts'
        ),
        {'extend_existing': True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    session_id = Column(String, nullable=True, index=True)

    # Конфигурация endpoint
    endpoint_url = Column(String, nullable=False)
    api_key = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    use_local = Column(Boolean, default=False)

    # Статус и мониторинг
    last_health_check = Column(DateTime, nullable=True)
    is_healthy = Column(Boolean, default=False)
    health_check_failures = Column(Integer, default=0)

    # Метаданные
    tts_version = Column(String, nullable=True)
    gpu_info = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)


class AudioSettings(Base):
    """Модель настроек звука для пользователей"""
    __tablename__ = 'audio_settings'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)
    website_volume = Column(Integer, nullable=False, default=50)
    obs_volume = Column(Integer, nullable=False, default=50)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)


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
    voice_id = Column(Integer, nullable=False, index=True)
    voice_name = Column(String, nullable=False)

    # Personal settings for this voice
    cfg_strength = Column(Float, nullable=True)
    speed_preset = Column(Float, nullable=True)
    volume = Column(Float, nullable=True)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
