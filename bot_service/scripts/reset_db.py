#!/usr/bin/env python3
"""
Скрипт для сброса базы данных.
Удаляет все таблицы и пересоздает их с начальными данными.
"""
import sys
import os

# Добавляем корневую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Загружаем переменные окружения
from dotenv import load_dotenv
load_dotenv()

from models.base import Base, engine, init_db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def reset_database():
    """Сбрасывает базу данных: удаляет все таблицы и пересоздает их."""
    logger.info("🗑️ Удаление всех таблиц...")
    
    # Импортируем все модели для регистрации в metadata
    from models import (
        User, UserSettings, UserSession, UserToken, AdminUser,
        TTSUserSettings, TTSBlockedUser, FilteredWord, LocalTTSEndpoint, AudioSettings, UserVoiceSettings,
        YouTubeQueue,
        ChannelPoints, ChannelReward, PointsTransaction, RewardQueue,
        BotCommand,
        BlockedBot, BlockedChannel, WhitelistedChannel,
        PsychologyAnalysis, ChatMessage, UserProgression,
        DropsType, DropsQuality, DropsConfig, DropsReward, UserStreak, DropsHistory, MythicalDropsSession, StreamSession,
        Achievement, UserAchievement, DonationAlert,
        SupportTicket, TicketResponse,
        SecurityLog, SystemLog,
        ChatBoxSettings,
    )
    
    # Удаляем все таблицы
    Base.metadata.drop_all(bind=engine)
    logger.info("✅ Все таблицы удалены")
    
    # Пересоздаем таблицы и инициализируем данные
    logger.info("🔄 Создание таблиц и инициализация данных...")
    init_db()
    
    logger.info("✅ База данных успешно сброшена!")


if __name__ == "__main__":
    confirm = input("⚠️ Это удалит ВСЕ данные из базы данных. Продолжить? (yes/no): ")
    if confirm.lower() == "yes":
        reset_database()
    else:
        logger.info("❌ Операция отменена")
