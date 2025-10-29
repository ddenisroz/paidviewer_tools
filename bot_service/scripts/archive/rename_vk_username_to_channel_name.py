"""
Миграция: переименование vk_username → vk_channel_name
Для ясности: channel_name (ник канала) vs user_name (ник пользователя)
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine, get_db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_vk_username_to_channel_name():
    """Переименовывает колонку vk_username в vk_channel_name"""
    
    try:
        with engine.connect() as conn:
            # Проверяем, существует ли колонка vk_username
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result]
            
            logger.info(f"📊 Существующие колонки: {columns}")
            
            if 'vk_username' in columns:
                logger.info("🔄 Переименовываем vk_username → vk_channel_name")
                
                # SQLite не поддерживает ALTER COLUMN RENAME напрямую
                # Нужно создать новую колонку и скопировать данные
                
                # 1. Добавляем новую колонку
                conn.execute(text("ALTER TABLE users ADD COLUMN vk_channel_name VARCHAR"))
                conn.commit()
                logger.info("✅ Создана колонка vk_channel_name")
                
                # 2. Копируем данные
                conn.execute(text("UPDATE users SET vk_channel_name = vk_username WHERE vk_username IS NOT NULL"))
                conn.commit()
                logger.info("✅ Данные скопированы")
                
                # 3. Удаляем старую колонку (для SQLite нужно пересоздать таблицу)
                # Проще оставить старую колонку, но использовать новую
                logger.info("⚠️ Старая колонка vk_username сохранена для совместимости")
                logger.info("💡 Используйте vk_channel_name в новом коде")
                
            elif 'vk_channel_name' in columns:
                logger.info("ℹ️ Колонка vk_channel_name уже существует")
            else:
                logger.error("❌ Ни vk_username, ни vk_channel_name не найдены!")
                return
            
            logger.info("\n✅ Миграция завершена!")
            
    except Exception as e:
        logger.error(f"❌ Ошибка миграции: {e}")
        import traceback
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    migrate_vk_username_to_channel_name()


