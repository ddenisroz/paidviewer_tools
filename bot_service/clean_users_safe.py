#!/usr/bin/env python3
"""
Безопасная очистка пользовательских данных для тестирования
Сохраняет важные настройки и делает backup
"""
import os
import sys
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

# Добавляем корневую директорию в путь
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from core.database import (
    get_db, User, UserToken, UserSession, GuestVerification, 
    VkGuestVerification, StreamData, YouTubeVideo, BlockedChannel
)
from constants import DEFAULT_BLOCKED_BOTS
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SafeDatabaseCleaner:
    """Безопасная очистка пользовательских данных с сохранением настроек"""
    
    def __init__(self):
        self.db_path = self._get_db_path()
        self.backup_dir = Path(__file__).parent / "backups"
        self.backup_dir.mkdir(exist_ok=True)
        
    def _get_db_path(self):
        """Получить путь к базе данных"""
        # Пробуем разные возможные расположения
        possible_paths = [
            Path(__file__).parent / "core" / "data" / "app_data.db",
            Path(__file__).parent / "data" / "app_data.db",
            Path(__file__).parent / "database.db"
        ]
        
        for path in possible_paths:
            if path.exists():
                return path
                
        # Если не найдено, используем путь по умолчанию
        return possible_paths[0]
    
    def create_backup(self):
        """Создать backup базы данных"""
        if not self.db_path.exists():
            logger.warning(f"❌ База данных не найдена: {self.db_path}")
            return None
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_{timestamp}.db"
        backup_path = self.backup_dir / backup_name
        
        try:
            shutil.copy2(self.db_path, backup_path)
            logger.info(f"📋 Backup создан: {backup_path}")
            return backup_path
        except Exception as e:
            logger.error(f"❌ Ошибка создания backup: {e}")
            return None
    
    def get_stats_before_cleanup(self):
        """Получить статистику до очистки"""
        db = next(get_db())
        try:
            stats = {
                'users': db.query(User).count(),
                'user_tokens': db.query(UserToken).count(),
                'user_sessions': db.query(UserSession).count(),
                'guest_verifications': db.query(GuestVerification).count(),
                'vk_guest_verifications': db.query(VkGuestVerification).count(),
                'stream_data': db.query(StreamData).count(),
                'youtube_videos': db.query(YouTubeVideo).count(),
            }
            
            # Получаем примеры данных для информации
            example_users = db.query(User).limit(3).all()
            if example_users:
                stats['example_users'] = [
                    f"ID {u.id}: {u.display_name} ({'admin' if u.is_admin else 'user'})"
                    for u in example_users
                ]
            
            return stats
        finally:
            db.close()
    
    def clean_user_data(self):
        """Очистить только пользовательские данные"""
        db = next(get_db())
        try:
            logger.info("🗑️ Удаляем пользовательские данные...")
            
            # Удаляем в правильном порядке (с учетом foreign keys)
            deleted_counts = {}
            
            # Связанные с пользователями данные
            deleted_counts['youtube_videos'] = db.query(YouTubeVideo).count()
            db.query(YouTubeVideo).delete()
            
            deleted_counts['stream_data'] = db.query(StreamData).count()
            db.query(StreamData).delete()
            
            deleted_counts['user_sessions'] = db.query(UserSession).count()
            db.query(UserSession).delete()
            
            deleted_counts['user_tokens'] = db.query(UserToken).count()
            db.query(UserToken).delete()
            
            # Верификации (не связаны foreign key, но относятся к пользователям)
            deleted_counts['guest_verifications'] = db.query(GuestVerification).count()
            db.query(GuestVerification).delete()
            
            deleted_counts['vk_guest_verifications'] = db.query(VkGuestVerification).count()
            db.query(VkGuestVerification).delete()
            
            # Пользователи (в последнюю очередь)
            deleted_counts['users'] = db.query(User).count()
            db.query(User).delete()
            
            db.commit()
            logger.info("✅ Пользовательские данные удалены")
            
            return deleted_counts
            
        except Exception as e:
            logger.error(f"❌ Ошибка при удалении данных: {e}")
            db.rollback()
            raise
        finally:
            db.close()
    
    def cleanup_blocked_channels(self):
        """Очистить заблокированные каналы (опционально)"""
        db = next(get_db())
        try:
            count = db.query(BlockedChannel).count()
            if count > 0:
                logger.info(f"🚫 Найдено {count} заблокированных каналов")
                response = input("🤔 Очистить заблокированные каналы? (y/n): ").strip().lower()
                if response in ['y', 'yes', 'да', 'д']:
                    db.query(BlockedChannel).delete()
                    db.commit()
                    logger.info(f"✅ Удалено {count} заблокированных каналов")
                    return count
            return 0
        finally:
            db.close()
    
    def verify_settings_preserved(self):
        """Проверить, что настройки сохранены"""
        db = next(get_db())
        try:
            # Проверяем что заблокированные боты на месте
            from core.database import BlockedBot, WhitelistedChannel, Voice
            
            preserved = {
                'blocked_bots': db.query(BlockedBot).count(),
                'whitelisted_channels': db.query(WhitelistedChannel).count(), 
                'voices': db.query(Voice).count(),
            }
            
            logger.info("🔒 Сохраненные настройки:")
            for setting, count in preserved.items():
                status = "✅" if count > 0 else "⚠️"
                logger.info(f"  {status} {setting}: {count}")
            
            return preserved
            
        finally:
            db.close()
    
    def show_summary(self, stats_before, deleted_counts, preserved_settings):
        """Показать итоговую сводку"""
        logger.info("=" * 60)
        logger.info("📊 СВОДКА ОЧИСТКИ")
        logger.info("=" * 60)
        
        logger.info("🗑️ УДАЛЕНО:")
        total_deleted = 0
        for table, count in deleted_counts.items():
            if count > 0:
                logger.info(f"  ❌ {table}: {count}")
                total_deleted += count
        
        logger.info(f"\n📈 ВСЕГО УДАЛЕНО: {total_deleted} записей")
        
        logger.info("\n🔒 СОХРАНЕНО:")
        total_preserved = 0
        for setting, count in preserved_settings.items():
            if count > 0:
                logger.info(f"  ✅ {setting}: {count}")
                total_preserved += count
        
        logger.info(f"\n🛡️ ВСЕГО СОХРАНЕНО: {total_preserved} настроек")
        
        if 'example_users' in stats_before and stats_before['example_users']:
            logger.info("\n👥 УДАЛЕННЫЕ ПОЛЬЗОВАТЕЛИ (примеры):")
            for user in stats_before['example_users']:
                logger.info(f"  🗑️ {user}")
    
    def run_cleanup(self, create_backup=True, clean_blocked_channels=False):
        """Запустить полную очистку"""
        logger.info("🚀 Запуск безопасной очистки пользовательских данных")
        logger.info("=" * 60)
        
        # Проверяем существование БД
        if not self.db_path.exists():
            logger.error(f"❌ База данных не найдена: {self.db_path}")
            return False
        
        # Создаем backup
        backup_path = None
        if create_backup:
            backup_path = self.create_backup()
            if not backup_path:
                logger.error("❌ Не удалось создать backup")
                return False
        
        try:
            # Получаем статистику до очистки
            stats_before = self.get_stats_before_cleanup()
            
            logger.info("📊 ДАННЫЕ ДО ОЧИСТКИ:")
            for table, count in stats_before.items():
                if table != 'example_users' and count > 0:
                    logger.info(f"  📄 {table}: {count}")
            
            # Показываем примеры пользователей
            if 'example_users' in stats_before:
                logger.info("\n👥 ПРИМЕРЫ ПОЛЬЗОВАТЕЛЕЙ:")
                for user in stats_before['example_users']:
                    logger.info(f"  👤 {user}")
            
            # Подтверждение
            total_user_records = sum(
                count for key, count in stats_before.items() 
                if key != 'example_users' and count > 0
            )
            
            if total_user_records == 0:
                logger.info("✨ База данных уже чистая!")
                return True
            
            logger.info(f"\n🚨 БУДЕТ УДАЛЕНО: {total_user_records} пользовательских записей")
            logger.info("🔒 БУДЕТ СОХРАНЕНО: настройки ботов, whitelist, голоса")
            
            if backup_path:
                logger.info(f"💾 Backup создан: {backup_path.name}")
            
            # Финальное подтверждение
            response = input("\n🤔 Продолжить очистку? (yes/no): ").strip().lower()
            if response not in ['yes', 'y', 'да', 'д']:
                logger.info("❌ Очистка отменена")
                return False
            
            # Очищаем пользовательские данные
            deleted_counts = self.clean_user_data()
            
            # Опционально очищаем заблокированные каналы
            if clean_blocked_channels:
                blocked_deleted = self.cleanup_blocked_channels()
                if blocked_deleted > 0:
                    deleted_counts['blocked_channels'] = blocked_deleted
            
            # Проверяем что настройки сохранены
            preserved_settings = self.verify_settings_preserved()
            
            # Показываем итоговую сводку
            self.show_summary(stats_before, deleted_counts, preserved_settings)
            
            logger.info("\n🎉 ОЧИСТКА ЗАВЕРШЕНА УСПЕШНО!")
            logger.info("🧪 База данных готова для тестирования")
            
            if backup_path:
                logger.info(f"💾 Для восстановления используйте: {backup_path}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка при очистке: {e}")
            if backup_path:
                logger.info(f"💾 Данные можно восстановить из: {backup_path}")
            return False

def main():
    """Главная функция"""
    print("🧹 БЕЗОПАСНАЯ ОЧИСТКА ПОЛЬЗОВАТЕЛЬСКИХ ДАННЫХ")
    print("=" * 60)
    print("📋 Что будет удалено:")
    print("  ❌ Пользователи и их данные")
    print("  ❌ Токены авторизации")
    print("  ❌ Активные сессии")
    print("  ❌ Верификации гостевого режима")
    print("  ❌ Данные стримов")
    print("  ❌ Очередь YouTube")
    print()
    print("🔒 Что будет сохранено:")
    print("  ✅ Заблокированные боты")
    print("  ✅ Whitelist каналов")
    print("  ✅ Голоса TTS")
    print("  ✅ Другие настройки системы")
    print()
    
    # Опции запуска
    print("⚙️ Опции:")
    create_backup = input("📋 Создать backup перед очисткой? (Y/n): ").strip().lower()
    create_backup = create_backup not in ['n', 'no', 'нет']
    
    clean_blocked = input("🚫 Очистить заблокированные каналы? (y/N): ").strip().lower()
    clean_blocked = clean_blocked in ['y', 'yes', 'да', 'д']
    
    print()
    
    # Запускаем очистку
    cleaner = SafeDatabaseCleaner()
    success = cleaner.run_cleanup(
        create_backup=create_backup,
        clean_blocked_channels=clean_blocked
    )
    
    if success:
        print("\n✨ Готово! Можете начинать тестирование на чистой базе.")
    else:
        print("\n❌ Очистка не была завершена.")

if __name__ == "__main__":
    main()
