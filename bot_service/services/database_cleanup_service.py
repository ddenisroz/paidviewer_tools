# services/database_cleanup_service.py
import logging
from typing import Dict, Any
from sqlalchemy.orm import Session
from core.datetime_utils import utcnow_naive

from services.database_maintenance.database_stats_service import DatabaseStatsService
from services.database_maintenance.database_backup_service import DatabaseBackupService
from services.database_maintenance.database_cleanup_core import DatabaseCleanupCore

logger = logging.getLogger(__name__)

class DatabaseCleanupService:
    """
    Facade service for database maintenance operations.
    Aggregates:
    - DatabaseStatsService (statistics)
    - DatabaseBackupService (backups)
    - DatabaseCleanupCore (cleanup logic)
    """

    def __init__(self, db: Session):
        self.db = db
        self.stats_service = DatabaseStatsService(db)
        self.backup_service = DatabaseBackupService()
        self.cleanup_core = DatabaseCleanupCore(db)

    def get_database_stats(self) -> Dict[str, Any]:
        """Получает статистику базы данных"""
        return self.stats_service.get_database_stats()

    def cleanup_old_data(self) -> Dict[str, int]:
        """Очищает данные: старые записи (старше 30 дней) и по лимитам"""
        return self.cleanup_core.cleanup_old_data()

    def optimize_database(self) -> Dict[str, Any]:
        """Оптимизирует базу данных"""
        try:
            # Получаем статистику до оптимизации
            stats_before = self.get_database_stats()

            # Выполняем очистку
            cleanup_stats = self.cleanup_old_data()

            # Получаем статистику после оптимизации
            stats_after = self.get_database_stats()

            return {
                'before': stats_before,
                'after': stats_after,
                'cleanup': cleanup_stats,
                'optimization_date': utcnow_naive().isoformat()
            }

        except Exception:
            logger.exception("Error optimizing database")
            return {}

    def create_backup(self) -> Dict[str, Any]:
        """Создает резервную копию базы данных"""
        return self.backup_service.create_backup()

    def restore_from_backup(self) -> Dict[str, Any]:
        """Восстанавливает БД из последней резервной копии"""
        return self.backup_service.restore_from_backup()

    def restore_from_backup_file(self, filename: str) -> Dict[str, Any]:
        """Восстанавливает БД из конкретной резервной копии"""
        return self.backup_service.restore_from_backup_file(filename)

    def list_backups(self) -> Dict[str, Any]:
        """Получает список всех резервных копий"""
        return self.backup_service.list_backups()

    def delete_backup(self, filename: str) -> Dict[str, Any]:
        """Удаляет конкретную резервную копию"""
        return self.backup_service.delete_backup(filename)

    def cleanup_cache(self) -> Dict[str, Any]:
        """Очищает кеш файлы"""
        return self.cleanup_core.cleanup_cache()

    def sync_user_message_counts(self) -> Dict[str, int]:
        """Синхронизирует счетчики сообщений пользователей"""
        return self.cleanup_core.sync_user_message_counts()

    def get_user_message_count(self, username: str, platform: str) -> int:
        """Получает количество сообщений пользователя"""
        return self.cleanup_core.get_user_message_count(username, platform)
        
    def cleanup_user_data(self, username: str, platform: str, keep_days: int = 30) -> int:
        """Очищает старые данные конкретного пользователя"""
        return self.cleanup_core.cleanup_user_data(username, platform, keep_days)
