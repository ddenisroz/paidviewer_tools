#!/usr/bin/env python3
"""
Скрипт для очистки базы данных от тестовых данных
"""
import os
import sys
from pathlib import Path

# Добавляем корневую директорию в путь
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from core.database import get_db, User, UserToken, UserSession, GuestVerification, VkGuestVerification, BlockedChannel, WhitelistedChannel, StreamData, MutedUser
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_database():
    """Очищает базу данных от всех тестовых данных"""
    db = next(get_db())
    
    try:
        logger.info("🧹 Начинаем очистку базы данных...")
        
        # Подсчитываем записи до очистки
        counts_before = {
            'users': db.query(User).count(),
            'user_tokens': db.query(UserToken).count(),
            'user_sessions': db.query(UserSession).count(),
            'guest_verifications': db.query(GuestVerification).count(),
            'vk_guest_verifications': db.query(VkGuestVerification).count(),
            'blocked_channels': db.query(BlockedChannel).count(),
            'whitelisted_channels': db.query(WhitelistedChannel).count(),
            'stream_data': db.query(StreamData).count(),
            'muted_users': db.query(MutedUser).count(),
        }
        
        logger.info("📊 Записи до очистки:")
        for table, count in counts_before.items():
            logger.info(f"  {table}: {count}")
        
        # Очищаем таблицы в правильном порядке (с учетом внешних ключей)
        logger.info("🗑️ Удаляем записи...")
        
        # Удаляем данные, которые ссылаются на пользователей
        db.query(UserToken).delete()
        db.query(UserSession).delete()
        db.query(GuestVerification).delete()
        db.query(VkGuestVerification).delete()
        db.query(BlockedChannel).delete()
        db.query(WhitelistedChannel).delete()
        db.query(StreamData).delete()
        db.query(MutedUser).delete()
        
        # Удаляем пользователей
        db.query(User).delete()
        
        # Подтверждаем изменения
        db.commit()
        
        logger.info("✅ База данных успешно очищена!")
        
        # Проверяем результат
        counts_after = {
            'users': db.query(User).count(),
            'user_tokens': db.query(UserToken).count(),
            'user_sessions': db.query(UserSession).count(),
            'guest_verifications': db.query(GuestVerification).count(),
            'vk_guest_verifications': db.query(VkGuestVerification).count(),
            'blocked_channels': db.query(BlockedChannel).count(),
            'whitelisted_channels': db.query(WhitelistedChannel).count(),
            'stream_data': db.query(StreamData).count(),
            'muted_users': db.query(MutedUser).count(),
        }
        
        logger.info("📊 Записи после очистки:")
        for table, count in counts_after.items():
            logger.info(f"  {table}: {count}")
        
        # Проверяем, что все таблицы пусты
        total_remaining = sum(counts_after.values())
        if total_remaining == 0:
            logger.info("🎉 Все таблицы успешно очищены!")
        else:
            logger.warning(f"⚠️ Осталось {total_remaining} записей в базе данных")
            
    except Exception as e:
        logger.error(f"❌ Ошибка при очистке базы данных: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("🚨 ВНИМАНИЕ: Этот скрипт удалит ВСЕ данные из базы данных!")
    print("📋 Будут удалены:")
    print("  - Все пользователи")
    print("  - Все токены авторизации")
    print("  - Все сессии")
    print("  - Все верификации гостевого режима")
    print("  - Все настройки каналов")
    print("  - Все данные стримов")
    print()
    
    response = input("🤔 Вы уверены, что хотите продолжить? (yes/no): ").strip().lower()
    
    if response in ['yes', 'y', 'да', 'д']:
        clean_database()
    else:
        print("❌ Очистка отменена")
