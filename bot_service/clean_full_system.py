#!/usr/bin/env python3
"""
Полная очистка системы: база данных + активные боты в памяти
Комбинирует очистку БД и активных соединений
"""
import os
import sys
import asyncio
from pathlib import Path

# Добавляем корневую директорию в путь
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def clean_memory_state():
    """Очистить состояние в памяти (боты, соединения)"""
    try:
        logger.info("🧠 Очистка состояния в памяти...")
        
        from core.connection_manager import get_connection_manager
        connection_manager = get_connection_manager()
        
        cleaned_items = []
        
        # Очищаем активные VK боты
        if hasattr(connection_manager, 'active_vk_bots') and connection_manager.active_vk_bots:
            vk_count = len(connection_manager.active_vk_bots)
            logger.info(f"🤖 Останавливаем {vk_count} VK ботов...")
            
            for channel_name, bot_data in list(connection_manager.active_vk_bots.items()):
                try:
                    bot = bot_data["bot"]
                    task = bot_data["task"]
                    
                    await bot.stop_bot()
                    task.cancel()
                    
                    logger.info(f"  ✅ VK бот для {channel_name} остановлен")
                except Exception as e:
                    logger.warning(f"  ⚠️ Ошибка при остановке VK бота {channel_name}: {e}")
            
            connection_manager.active_vk_bots.clear()
            cleaned_items.append(f"VK боты: {vk_count}")
        
        # Очищаем активные сессии
        if hasattr(connection_manager, 'active_sessions') and connection_manager.active_sessions:
            sessions_count = len(connection_manager.active_sessions)
            connection_manager.active_sessions.clear()
            cleaned_items.append(f"активные сессии: {sessions_count}")
        
        # Очищаем верифицированные сессии
        if hasattr(connection_manager, 'verified_sessions') and connection_manager.verified_sessions:
            verified_count = len(connection_manager.verified_sessions)
            connection_manager.verified_sessions.clear()
            cleaned_items.append(f"верифицированные сессии: {verified_count}")
        
        # Очищаем ожидающие верификации
        if hasattr(connection_manager, 'pending_verifications') and connection_manager.pending_verifications:
            pending_count = len(connection_manager.pending_verifications)
            connection_manager.pending_verifications.clear()
            cleaned_items.append(f"ожидающие верификации: {pending_count}")
        
        # Очищаем WebSocket соединения
        if hasattr(connection_manager, 'active_connections') and connection_manager.active_connections:
            ws_count = len(connection_manager.active_connections)
            connection_manager.active_connections.clear()
            cleaned_items.append(f"WebSocket соединения: {ws_count}")
        
        # Очищаем OBS соединения
        if hasattr(connection_manager, 'obs_connections') and connection_manager.obs_connections:
            obs_count = len(connection_manager.obs_connections)
            connection_manager.obs_connections.clear()
            cleaned_items.append(f"OBS соединения: {obs_count}")
        
        # Очищаем TTS каналы
        if hasattr(connection_manager, 'tts_enabled_channels') and connection_manager.tts_enabled_channels:
            tts_count = len(connection_manager.tts_enabled_channels)
            connection_manager.tts_enabled_channels.clear()
            cleaned_items.append(f"TTS каналы: {tts_count}")
        
        # Очищаем платформо-специфические TTS каналы
        if hasattr(connection_manager, 'tts_enabled_twitch') and connection_manager.tts_enabled_twitch:
            twitch_tts_count = len(connection_manager.tts_enabled_twitch)
            connection_manager.tts_enabled_twitch.clear()
            cleaned_items.append(f"Twitch TTS каналы: {twitch_tts_count}")
            
        if hasattr(connection_manager, 'tts_enabled_vk') and connection_manager.tts_enabled_vk:
            vk_tts_count = len(connection_manager.tts_enabled_vk)
            connection_manager.tts_enabled_vk.clear()
            cleaned_items.append(f"VK TTS каналы: {vk_tts_count}")
        
        # Очищаем YouTube очереди
        if hasattr(connection_manager, 'youtube_queues') and connection_manager.youtube_queues:
            youtube_count = len(connection_manager.youtube_queues)
            connection_manager.youtube_queues.clear()
            cleaned_items.append(f"YouTube очереди: {youtube_count}")
        
        # Очищаем кэши
        if hasattr(connection_manager, 'twitch_cache'):
            connection_manager.twitch_cache = {
                'categories': {},
                'streams': {},
                'last_update': 0
            }
            cleaned_items.append("Twitch кэш")
        
        if hasattr(connection_manager, 'youtube_cache'):
            connection_manager.youtube_cache = {
                'videos': {},
                'last_update': 0
            }
            cleaned_items.append("YouTube кэш")
        
        if cleaned_items:
            logger.info("✅ Очищено из памяти:")
            for item in cleaned_items:
                logger.info(f"  🧹 {item}")
        else:
            logger.info("✨ Память уже чистая!")
        
        return len(cleaned_items)
        
    except Exception as e:
        logger.error(f"❌ Ошибка при очистке памяти: {e}")
        return 0

def clean_database():
    """Очистить базу данных"""
    try:
        logger.info("💾 Очистка базы данных...")
        
        from clean_users_safe import SafeDatabaseCleaner
        cleaner = SafeDatabaseCleaner()
        
        return cleaner.run_cleanup(
            create_backup=True,
            clean_blocked_channels=False
        )
        
    except Exception as e:
        logger.error(f"❌ Ошибка при очистке БД: {e}")
        return False

async def full_system_cleanup():
    """Полная очистка системы"""
    logger.info("🚀 ПОЛНАЯ ОЧИСТКА СИСТЕМЫ")
    logger.info("=" * 60)
    
    success_count = 0
    total_steps = 2
    
    # Шаг 1: Очистка памяти (боты, соединения)
    logger.info("📍 ШАГ 1/2: Очистка активных ботов и соединений")
    memory_cleaned = await clean_memory_state()
    if memory_cleaned >= 0:
        success_count += 1
        logger.info(f"✅ Шаг 1 завершен: очищено {memory_cleaned} элементов\n")
    else:
        logger.error("❌ Шаг 1 не удался\n")
    
    # Небольшая пауза между шагами
    await asyncio.sleep(1)
    
    # Шаг 2: Очистка базы данных
    logger.info("📍 ШАГ 2/2: Очистка базы данных")
    db_cleaned = clean_database()
    if db_cleaned:
        success_count += 1
        logger.info("✅ Шаг 2 завершен\n")
    else:
        logger.error("❌ Шаг 2 не удался\n")
    
    # Итоговый отчет
    logger.info("=" * 60)
    logger.info("📊 ИТОГОВЫЙ ОТЧЕТ")
    logger.info("=" * 60)
    
    if success_count == total_steps:
        logger.info("🎉 ПОЛНАЯ ОЧИСТКА ЗАВЕРШЕНА УСПЕШНО!")
        logger.info("✨ Система готова для тестирования на чистую")
        logger.info("\n🔄 Рекомендуется перезапустить сервисы:")
        logger.info("  1. Остановите bot_service")
        logger.info("  2. Остановите tts_service") 
        logger.info("  3. Перезапустите оба сервиса")
        logger.info("  4. Обновите фронтенд (F5)")
    else:
        logger.warning(f"⚠️ Частичная очистка: {success_count}/{total_steps} шагов выполнено")
        if success_count > 0:
            logger.info("✅ Система частично очищена, можно продолжать")
        else:
            logger.error("❌ Очистка не удалась")
    
    return success_count == total_steps

def main():
    """Главная функция"""
    print("🧹 ПОЛНАЯ ОЧИСТКА СИСТЕМЫ")
    print("=" * 60)
    print("📋 Что будет сделано:")
    print("  1️⃣ Остановка всех активных ботов")
    print("  2️⃣ Очистка соединений в памяти")
    print("  3️⃣ Очистка пользовательских данных в БД")
    print("  4️⃣ Сохранение важных настроек")
    print("  5️⃣ Создание backup")
    print()
    print("⚠️ ВНИМАНИЕ:")
    print("  • Все активные боты будут отключены")
    print("  • Все пользователи и сессии будут удалены")
    print("  • Настройки системы будут сохранены")
    print("  • Будет создан backup для восстановления")
    print()
    
    response = input("🤔 Продолжить полную очистку? (yes/no): ").strip().lower()
    
    if response not in ['yes', 'y', 'да', 'д']:
        print("❌ Очистка отменена")
        return
    
    print("\n🚀 Начинаем полную очистку...")
    print("=" * 60)
    
    # Запускаем асинхронную очистку
    success = asyncio.run(full_system_cleanup())
    
    if success:
        print("\n✨ Готово! Система полностью очищена и готова к тестированию.")
        print("🔄 Не забудьте перезапустить сервисы для применения изменений.")
    else:
        print("\n❌ Очистка была завершена с ошибками.")

if __name__ == "__main__":
    main()
