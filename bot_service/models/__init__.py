# models/__init__.py
"""
Модуль моделей базы данных.

Все модели разделены по доменам для лучшей организации кода.
Этот файл реэкспортирует все модели для обратной совместимости.
"""

# Base и инфраструктура
from models.base import (
    Base,
    engine,
    SessionLocal,
    db_session,
    init_db,
    DATABASE_URL,
    IS_POSTGRESQL,
)

# Import get_db from dependencies to avoid circular imports and keep single source of truth
from core.dependencies import get_db

# Пользователи и сессии
from models.user import (
    User,
    UserSettings,
    UserSession,
    UserToken,
    AdminUser,
)

# Токены ботов
from models.bot_token import BotToken

# TTS настройки
from models.tts import (
    TTSUserSettings,
    TTSBlockedUser,
    FilteredWord,
    LocalTTSEndpoint,
    AudioSettings,
    UserVoiceSettings,
)

# YouTube очередь
from models.youtube import YouTubeQueue

# Система баллов
from models.points import (
    ChannelPoints,
    ChannelReward,
    PointsTransaction,
    RewardQueue,
)

# Команды бота
from models.commands import BotCommand

# Модерация
from models.moderation import (
    BlockedBot,
    BlockedChannel,
    WhitelistedChannel,
)

# Аналитика и чат
from models.analytics import (
    PsychologyAnalysis,
    ChatMessage,
    UserProgression,
)

# Система Drops (лутбоксы)
from models.drops import (
    DropsType,
    DropsQuality,
    DropsConfig,
    DropsReward,
    UserStreak,
    DropsHistory,
    MythicalDropsSession,
    StreamSession,
)

# Геймификация
from models.gamification import (
    Achievement,
    UserAchievement,
    DonationAlert,
)

# Поддержка
from models.support import (
    SupportTicket,
    TicketResponse,
)

# Безопасность и логи
from models.security import (
    SecurityLog,
    SystemLog,
)

# Виджеты
from models.widgets import ChatBoxSettings

__all__ = [
    # Base
    "Base",
    "engine",
    "SessionLocal",
    "get_db",
    "db_session",
    "init_db",
    "DATABASE_URL",
    "IS_POSTGRESQL",
    # User
    "User",
    "UserSettings",
    "UserSession",
    "UserToken",
    "AdminUser",
    # Bot tokens
    "BotToken",
    # TTS
    "TTSUserSettings",
    "TTSBlockedUser",
    "FilteredWord",
    "LocalTTSEndpoint",
    "AudioSettings",
    "UserVoiceSettings",
    # YouTube
    "YouTubeQueue",
    # Points
    "ChannelPoints",
    "ChannelReward",
    "PointsTransaction",
    "RewardQueue",
    # Commands
    "BotCommand",
    # Moderation
    "BlockedBot",
    "BlockedChannel",
    "WhitelistedChannel",
    # Analytics
    "PsychologyAnalysis",
    "ChatMessage",
    "UserProgression",
    # Drops
    "DropsType",
    "DropsQuality",
    "DropsConfig",
    "DropsReward",
    "UserStreak",
    "DropsHistory",
    "MythicalDropsSession",
    "StreamSession",
    # Gamification
    "Achievement",
    "UserAchievement",
    "DonationAlert",
    # Support
    "SupportTicket",
    "TicketResponse",
    # Security
    "SecurityLog",
    "SystemLog",
    # Widgets
    "ChatBoxSettings",
]
