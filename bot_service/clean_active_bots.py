#!/usr/bin/env python3
"""
Скрипт для очистки активных ботов и соединений в памяти
"""
import os
import sys
import asyncio
from pathlib import Path

# Добавляем корневую директорию в путь
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from core.connection_manager import get_connection_manager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def clean_active_bots():
    """Очищает активных ботов и соединения в памяти"""
    try:
        logger.info("🧹 Начинаем очистку активных ботов...")
        
        # Получаем connection_manager
        connection_manager = get_connection_manager()
        
        # Очищаем активные VK боты
        if hasattr(connection_manager, 'active_vk_bots'):
            vk_bots_count = len(connection_manager.active_vk_bots)
            logger.info(f"📊 Активных VK ботов: {vk_bots_count}")
            
            for channel_name, bot_data in list(connection_manager.active_vk_bots.items()):
                try:
                    logger.info(f"🛑 Останавливаем VK бота для канала: {channel_name}")
                    bot = bot_data["bot"]
                    task = bot_data["task"]
                    
                    # Останавливаем бота
                    await bot.stop_bot()
                    
                    # Отменяем задачу
                    task.cancel()
                    
                    logger.info(f"✅ VK бот для канала {channel_name} остановлен")
                except Exception as e:
                    logger.error(f"❌ Ошибка при остановке VK бота для {channel_name}: {e}")
            
            # Очищаем реестр
            connection_manager.active_vk_bots.clear()
            logger.info("🧹 Реестр VK ботов очищен")
        
        # Очищаем верифицированные сессии
        if hasattr(connection_manager, 'verified_sessions'):
            verified_count = len(connection_manager.verified_sessions)
            logger.info(f"📊 Верифицированных сессий: {verified_count}")
            connection_manager.verified_sessions.clear()
            logger.info("🧹 Верифицированные сессии очищены")
        
        # Очищаем ожидающие верификации
        if hasattr(connection_manager, 'pending_verifications'):
            pending_count = len(connection_manager.pending_verifications)
            logger.info(f"📊 Ожидающих верификации: {pending_count}")
            connection_manager.pending_verifications.clear()
            logger.info("🧹 Ожидающие верификации очищены")
        
        # Очищаем активные соединения
        if hasattr(connection_manager, 'active_connections'):
            connections_count = len(connection_manager.active_connections)
            logger.info(f"📊 Активных соединений: {connections_count}")
            connection_manager.active_connections.clear()
            logger.info("🧹 Активные соединения очищены")
        
        # Очищаем OBS соединения
        if hasattr(connection_manager, 'obs_connections'):
            obs_count = len(connection_manager.obs_connections)
            logger.info(f"📊 OBS соединений: {obs_count}")
            connection_manager.obs_connections.clear()
            logger.info("🧹 OBS соединения очищены")
        
        # Очищаем TTS каналы
        if hasattr(connection_manager, 'tts_enabled_channels'):
            tts_count = len(connection_manager.tts_enabled_channels)
            logger.info(f"📊 TTS каналов: {tts_count}")
            connection_manager.tts_enabled_channels.clear()
            logger.info("🧹 TTS каналы очищены")
        
        logger.info("✅ Все активные боты и соединения очищены!")
        
    except Exception as e:
        logger.error(f"❌ Ошибка при очистке активных ботов: {e}")
        raise

if __name__ == "__main__":
    print("🧹 Очистка активных ботов и соединений в памяти...")
    asyncio.run(clean_active_bots())
    print("✅ Очистка завершена!")
