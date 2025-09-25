#!/usr/bin/env python3
"""
Быстрая очистка пользователей для разработки
Без подтверждений и backup - только для быстрого тестирования
"""
import os
import sys
from pathlib import Path

# Добавляем корневую директорию в путь
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from core.database import (
    get_db, User, UserToken, UserSession, GuestVerification, 
    VkGuestVerification, StreamData, YouTubeVideo
)
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def quick_clean():
    """Быстрая очистка пользовательских данных"""
    db = next(get_db())
    
    try:
        # Подсчитываем что удаляем
        counts = {
            'users': db.query(User).count(),
            'user_tokens': db.query(UserToken).count(),
            'user_sessions': db.query(UserSession).count(),
            'guest_verifications': db.query(GuestVerification).count(),
            'vk_guest_verifications': db.query(VkGuestVerification).count(),
            'stream_data': db.query(StreamData).count(),
            'youtube_videos': db.query(YouTubeVideo).count(),
        }
        
        total_before = sum(counts.values())
        
        if total_before == 0:
            logger.info("✨ База уже чистая!")
            return True
        
        logger.info(f"🗑️ Удаляем {total_before} записей...")
        
        # Удаляем в правильном порядке
        db.query(YouTubeVideo).delete()
        db.query(StreamData).delete()
        db.query(UserSession).delete()
        db.query(UserToken).delete()
        db.query(GuestVerification).delete()
        db.query(VkGuestVerification).delete()
        db.query(User).delete()
        
        db.commit()
        
        # Проверяем результат
        total_after = sum([
            db.query(User).count(),
            db.query(UserToken).count(),
            db.query(UserSession).count(),
            db.query(GuestVerification).count(),
            db.query(VkGuestVerification).count(),
            db.query(StreamData).count(),
            db.query(YouTubeVideo).count(),
        ])
        
        if total_after == 0:
            logger.info(f"✅ Успешно удалено {total_before} записей")
            logger.info("🧪 База готова для тестирования")
            return True
        else:
            logger.warning(f"⚠️ Осталось {total_after} записей")
            return False
            
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def main():
    """Главная функция"""
    if len(sys.argv) > 1 and sys.argv[1] == '--force':
        # Принудительное выполнение без подтверждения
        success = quick_clean()
        sys.exit(0 if success else 1)
    
    print("🧹 БЫСТРАЯ ОЧИСТКА ПОЛЬЗОВАТЕЛЕЙ")
    print("⚡ Удалит всех пользователей и их данные без backup")
    print("🔒 Сохранит настройки системы")
    print()
    
    response = input("Продолжить? (y/n): ").strip().lower()
    
    if response in ['y', 'yes', 'да', 'д']:
        success = quick_clean()
        if success:
            print("✨ Готово!")
        else:
            print("❌ Ошибка при очистке")
    else:
        print("❌ Отменено")

if __name__ == "__main__":
    main()
