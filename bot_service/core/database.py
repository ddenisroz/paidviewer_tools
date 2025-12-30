# core/database.py
"""
Фасад для обратной совместимости.

Все модели перенесены в bot_service/models/ для лучшей организации.
Этот файл реэкспортирует все модели для существующего кода.

ВАЖНО: Для нового кода рекомендуется импортировать напрямую из models:
    from models import User, get_db
    from models.user import User, UserSettings
    from models.base import db_session
"""

# Re-export всего из models для обратной совместимости
from models import (
    # Base и инфраструктура
    Base,
    engine,
    SessionLocal,
    get_db,
    db_session,
    init_db,
    DATABASE_URL,
    IS_POSTGRESQL,
    # Пользователи
    User,
    UserSettings,
    UserSession,
    UserToken,
    AdminUser,
    # TTS
    TTSUserSettings,
    TTSBlockedUser,
    FilteredWord,
    LocalTTSEndpoint,
    AudioSettings,
    UserVoiceSettings,
    # YouTube
    YouTubeQueue,
    # Баллы
    ChannelPoints,
    ChannelReward,
    PointsTransaction,
    RewardQueue,
    # Команды
    BotCommand,
    # Модерация
    BlockedBot,
    BlockedChannel,
    WhitelistedChannel,
    # Аналитика
    PsychologyAnalysis,
    ChatMessage,
    UserProgression,
    # Drops
    DropsType,
    DropsQuality,
    DropsConfig,
    DropsReward,
    UserStreak,
    DropsHistory,
    MythicalDropsSession,
    StreamSession,
    # Геймификация
    Achievement,
    UserAchievement,
    DonationAlert,
    # Поддержка
    SupportTicket,
    TicketResponse,
    # Безопасность
    SecurityLog,
    SystemLog,
    # Виджеты
    ChatBoxSettings,
)

# Также экспортируем утилиту datetime для совместимости
from core.datetime_utils import utcnow_naive

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
    # Utils
    "utcnow_naive",
]
