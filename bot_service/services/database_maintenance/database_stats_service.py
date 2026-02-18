# services/database_maintenance/database_stats_service.py
"""Service for gathering database statistics - refactored to use repositories."""

import logging
import os
from typing import Dict, Any

from sqlalchemy.orm import Session

from repositories.database_stats_repository import DatabaseStatsRepository

logger = logging.getLogger(__name__)


class DatabaseStatsService:
    """Service for gathering database statistics"""

    def __init__(self, db: Session):
        self.db = db
        self.stats_repo = DatabaseStatsRepository(db)
        
        # Settings from config
        from core.config import settings
        self.MAX_CHAT_MESSAGES_PER_USER = settings.chat_messages_db_limit_per_user
        self.MAX_TOTAL_CHAT_MESSAGES = settings.chat_messages_db_limit_total
        self.CHAT_MESSAGES_RETENTION_DAYS = settings.chat_messages_retention_days
        
        # Psychology analyses no longer stored in DB
        self.MAX_PSYCHOLOGY_ANALYSES = 0
        self.PSYCHOLOGY_RETENTION_DAYS = 0

    def get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics using repository pattern."""
        try:
            stats = {}

            # Message statistics via repository
            total_messages = self.stats_repo.count_total_messages()
            stats['total_chat_messages'] = total_messages

            # Platform statistics via repository
            twitch_messages = self.stats_repo.count_messages_by_platform('twitch')
            vk_messages = self.stats_repo.count_messages_by_platform('vk')
            stats['twitch_messages'] = twitch_messages
            stats['vk_messages'] = vk_messages

            # Psychology analyses no longer stored in DB
            stats['total_psychology_analyses'] = 0

            # User statistics via repository
            total_users = self.stats_repo.count_total_users()
            stats['total_users'] = total_users

            # Database size via repository
            database_size_bytes = self.stats_repo.get_database_size_bytes()
            stats['database_size_bytes'] = database_size_bytes
            stats['estimated_db_size_mb'] = round(database_size_bytes / (1024 * 1024), 2)

            # For frontend
            stats['total_records'] = total_messages + total_users

            # Component sizes (approximate)
            stats['logs_size_bytes'] = int(database_size_bytes * 0.3)
            stats['log_entries'] = total_messages

            stats['voices_size_bytes'] = self._get_voices_size()
            stats['voices_count'] = self._count_voice_files()

            stats['cache_size_bytes'] = self._get_cache_size()
            stats['cache_files'] = self._count_cache_files()

            stats['backup_size_bytes'] = self._get_latest_backup_size()
            stats['last_backup_time'] = self._get_latest_backup_time()

            # Old records via repository
            old_messages = self.stats_repo.count_old_messages(self.CHAT_MESSAGES_RETENTION_DAYS)
            stats['old_messages_to_cleanup'] = old_messages
            stats['old_analyses_to_cleanup'] = 0

            # Limits
            stats['max_messages_per_user'] = self.MAX_CHAT_MESSAGES_PER_USER
            stats['max_total_messages'] = self.MAX_TOTAL_CHAT_MESSAGES

            # Users over limit via repository
            users_over_limit = self.stats_repo.count_users_over_message_limit(
                self.MAX_CHAT_MESSAGES_PER_USER
            )
            stats['users_over_message_limit'] = users_over_limit

            return stats

        except Exception:
            logger.exception("Error getting database stats")
            return {}

    def _get_voices_size(self) -> int:
        """Get voices directory size in bytes."""
        try:
            voices_dir = os.path.join(os.getcwd(), 'tts_service', 'user_voices')
            if not os.path.exists(voices_dir):
                return 0
            total_size = 0
            for root, dirs, files in os.walk(voices_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    total_size += os.path.getsize(file_path)
            return total_size
        except Exception:
            logger.exception("Error getting voices size")
            return 0

    def _count_voice_files(self) -> int:
        """Count voice files in directory."""
        try:
            voices_dir = os.path.join(os.getcwd(), 'tts_service', 'user_voices')
            if not os.path.exists(voices_dir):
                return 0
            return len([f for f in os.listdir(voices_dir) if f.endswith('.wav')])
        except Exception:
            logger.exception("Error counting voice files")
            return 0

    def _get_cache_size(self) -> int:
        """Get cache directory size in bytes."""
        try:
            cache_dirs = [
                os.path.join(os.getcwd(), '.cache'),
                os.path.join(os.getcwd(), 'tts_service', 'cache'),
                os.path.join(os.getcwd(), 'temp'),
            ]
            total_size = 0
            for cache_dir in cache_dirs:
                if not os.path.exists(cache_dir):
                    continue
                for root, dirs, files in os.walk(cache_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        total_size += os.path.getsize(file_path)
            return total_size
        except Exception:
            logger.exception("Error getting cache size")
            return 0

    def _count_cache_files(self) -> int:
        """Count files in cache directories."""
        try:
            cache_dirs = [
                os.path.join(os.getcwd(), '.cache'),
                os.path.join(os.getcwd(), 'tts_service', 'cache'),
                os.path.join(os.getcwd(), 'temp'),
            ]
            total_count = 0
            for cache_dir in cache_dirs:
                if not os.path.exists(cache_dir):
                    continue
                total_count += sum(len(files) for _, _, files in os.walk(cache_dir))
            return total_count
        except Exception:
            logger.exception("Error counting cache files")
            return 0

    def _get_latest_backup_size(self) -> int:
        """Get latest backup size in bytes."""
        try:
            backup_dir = os.path.join(os.getcwd(), 'backups')
            if not os.path.exists(backup_dir):
                return 0
            files = os.listdir(backup_dir)
            if not files:
                return 0
            latest_backup = sorted(files, key=lambda x: os.path.getmtime(os.path.join(backup_dir, x)))[-1]
            return os.path.getsize(os.path.join(backup_dir, latest_backup))
        except Exception:
            logger.exception("Error getting latest backup size")
            return 0

    def _get_latest_backup_time(self) -> str:
        """Get latest backup time."""
        try:
            from datetime import datetime
            backup_dir = os.path.join(os.getcwd(), 'backups')
            if not os.path.exists(backup_dir):
                return None
            files = [f for f in os.listdir(backup_dir) if f.startswith('backup_') and (f.endswith('.db') or f.endswith('.sql'))]
            if not files:
                return None
            latest_backup = sorted(files, key=lambda x: os.path.getmtime(os.path.join(backup_dir, x)))[-1]
            timestamp = os.path.getmtime(os.path.join(backup_dir, latest_backup))
            return datetime.fromtimestamp(timestamp).isoformat()
        except Exception:
            logger.exception("Error getting latest backup time")
            return None
