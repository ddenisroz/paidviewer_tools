# services/database_cleanup_service.py
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from core.database import ChatMessage, PsychologyAnalysis, User
from core.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)

class DatabaseCleanupService:
    """Сервис для очистки старых данных и управления размером базы данных"""
    
    def __init__(self, db: Session):
        self.db = db
        
        # Настройки лимитов (из централизованной конфигурации)
        from core.config import settings
        self.MAX_CHAT_MESSAGES_PER_USER = settings.chat_messages_db_limit_per_user
        self.MAX_TOTAL_CHAT_MESSAGES = settings.chat_messages_db_limit_total
        self.CHAT_MESSAGES_RETENTION_DAYS = settings.chat_messages_retention_days
        
        # Анализы больше не хранятся в БД
        self.MAX_PSYCHOLOGY_ANALYSES = 0
        self.PSYCHOLOGY_RETENTION_DAYS = 0
        
        logger.info(f"📊 Database cleanup settings: MAX_PER_USER={self.MAX_CHAT_MESSAGES_PER_USER}, "
                   f"MAX_TOTAL={self.MAX_TOTAL_CHAT_MESSAGES}, "
                   f"RETENTION_DAYS={self.CHAT_MESSAGES_RETENTION_DAYS}")
        
    def get_database_stats(self) -> Dict[str, Any]:
        """Получает статистику базы данных"""
        try:
            stats = {}
            
            # Статистика сообщений
            total_messages = self.db.query(ChatMessage).count()
            stats['total_chat_messages'] = total_messages
            
            # Статистика по платформам
            twitch_messages = self.db.query(ChatMessage).filter(ChatMessage.platform == 'twitch').count()
            vk_messages = self.db.query(ChatMessage).filter(ChatMessage.platform == 'vk').count()
            stats['twitch_messages'] = twitch_messages
            stats['vk_messages'] = vk_messages
            
            # Анализы больше не хранятся в БД
            stats['total_psychology_analyses'] = 0
            
            # Статистика пользователей
            total_users = self.db.query(User).count()
            stats['total_users'] = total_users
            
            # Размер базы данных (в байтах)
            database_size_bytes = self._get_actual_database_size()
            stats['database_size_bytes'] = database_size_bytes
            stats['estimated_db_size_mb'] = round(database_size_bytes / (1024 * 1024), 2)
            
            # Для фронтенда
            stats['total_records'] = total_messages + total_users
            
            # Размеры компонентов (приблизительно)
            stats['logs_size_bytes'] = int(database_size_bytes * 0.3)  # ~30% на логи
            stats['log_entries'] = total_messages
            
            stats['voices_size_bytes'] = self._get_voices_size()
            stats['voices_count'] = self._count_voice_files()
            
            stats['cache_size_bytes'] = self._get_cache_size()
            stats['cache_files'] = self._count_cache_files()
            
            stats['backup_size_bytes'] = self._get_latest_backup_size()
            stats['last_backup_time'] = self._get_latest_backup_time()
            
            # Старые записи
            old_messages = self.db.query(ChatMessage).filter(
                ChatMessage.timestamp < utcnow_naive() - timedelta(days=self.CHAT_MESSAGES_RETENTION_DAYS)
            ).count()
            stats['old_messages_to_cleanup'] = old_messages
            
            old_analyses = self.db.query(PsychologyAnalysis).filter(
                PsychologyAnalysis.analysis_date < utcnow_naive() - timedelta(days=self.PSYCHOLOGY_RETENTION_DAYS)
            ).count()
            stats['old_analyses_to_cleanup'] = old_analyses
            
            # Лимиты
            stats['max_messages_per_user'] = self.MAX_CHAT_MESSAGES_PER_USER
            stats['max_total_messages'] = self.MAX_TOTAL_CHAT_MESSAGES
            
            # Пользователи с превышением лимита
            from sqlalchemy import func
            users_over_limit = self.db.query(
                ChatMessage.user_id,
                func.count(ChatMessage.id).label('message_count')
            ).group_by(ChatMessage.user_id).having(
                func.count(ChatMessage.id) > self.MAX_CHAT_MESSAGES_PER_USER
            ).count()
            stats['users_over_message_limit'] = users_over_limit
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting database stats: {e}", exc_info=True)
            return {}
    
    def cleanup_old_data(self) -> Dict[str, int]:
        """Очищает данные: старые записи (старше 30 дней) и по лимитам"""
        try:
            cleanup_stats = {
                'messages_deleted': 0,
                'old_messages_deleted': 0,
                'limit_based_deleted': 0,
                'users_cleaned': 0,
                'cleanup_reason': 'age_and_limit_based'
            }
            
            # 1. Очистка сообщений старше RETENTION_DAYS (30 дней по умолчанию)
            cutoff_date = utcnow_naive() - timedelta(days=self.CHAT_MESSAGES_RETENTION_DAYS)
            old_messages_query = self.db.query(ChatMessage).filter(
                ChatMessage.timestamp < cutoff_date
            )
            old_messages_count = old_messages_query.count()
            
            if old_messages_count > 0:
                old_messages_query.delete(synchronize_session=False)
                cleanup_stats['old_messages_deleted'] = old_messages_count
                cleanup_stats['messages_deleted'] += old_messages_count
                logger.info(f"🗑️ Deleted {old_messages_count} messages older than {self.CHAT_MESSAGES_RETENTION_DAYS} days")
            
            # 2. Очистка избыточных сообщений (если превышен общий лимит)
            total_messages = self.db.query(ChatMessage).count()
            if total_messages > self.MAX_TOTAL_CHAT_MESSAGES:
                excess_count = total_messages - self.MAX_TOTAL_CHAT_MESSAGES
                oldest_messages = self.db.query(ChatMessage).order_by(ChatMessage.timestamp.asc()).limit(excess_count)
                oldest_messages.delete(synchronize_session=False)
                cleanup_stats['limit_based_deleted'] = excess_count
                cleanup_stats['messages_deleted'] += excess_count
                logger.info(f"🗑️ Deleted {excess_count} excess messages to maintain total limit ({self.MAX_TOTAL_CHAT_MESSAGES})")
            
            # 3. Очистка избыточных сообщений на пользователя (если превышен лимит на пользователя)
            user_cleanup_count = self._cleanup_user_message_limits()
            cleanup_stats['limit_based_deleted'] += user_cleanup_count
            cleanup_stats['messages_deleted'] += user_cleanup_count
            
            if cleanup_stats['messages_deleted'] == 0:
                logger.info("✅ No messages deleted - all within limits and retention period")
            else:
                logger.info(f"✅ Cleanup completed: {cleanup_stats['messages_deleted']} messages deleted "
                          f"(old: {cleanup_stats['old_messages_deleted']}, limit-based: {cleanup_stats['limit_based_deleted']})")
            
            self.db.commit()
            return cleanup_stats
            
        except Exception as e:
            logger.error(f"❌ Error cleaning up old data: {e}", exc_info=True)
            self.db.rollback()
            return {'messages_deleted': 0, 'old_messages_deleted': 0, 'limit_based_deleted': 0, 'users_cleaned': 0, 'error': str(e)}
    
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
            
        except Exception as e:
            logger.error(f"Error optimizing database: {e}")
            return {}
    
    def _estimate_database_size(self) -> float:
        """Оценивает размер базы данных в МБ"""
        try:
            # Примерная оценка размера записи
            avg_message_size = 200  # байт на сообщение
            avg_analysis_size = 500  # байт на анализ
            avg_user_size = 1000  # байт на пользователя
            
            total_messages = self.db.query(ChatMessage).count()
            total_analyses = self.db.query(PsychologyAnalysis).count()
            total_users = self.db.query(User).count()
            
            estimated_bytes = (
                total_messages * avg_message_size +
                total_analyses * avg_analysis_size +
                total_users * avg_user_size
            )
            
            return round(estimated_bytes / (1024 * 1024), 2)
            
        except Exception as e:
            logger.error(f"Error estimating database size: {e}")
            return 0.0
    
    def _cleanup_user_message_limits(self):
        """Очищает избыточные сообщения пользователей (превышающих лимит)"""
        try:
            from sqlalchemy import func
            
            total_deleted = 0
            
            # Находим пользователей с превышением лимита
            user_message_counts = self.db.query(
                ChatMessage.user_id,
                func.count(ChatMessage.id).label('message_count')
            ).group_by(ChatMessage.user_id).having(
                func.count(ChatMessage.id) > self.MAX_CHAT_MESSAGES_PER_USER
            ).all()
            
            for user_id, message_count in user_message_counts:
                excess_count = message_count - self.MAX_CHAT_MESSAGES_PER_USER
                
                # Удаляем самые старые сообщения пользователя
                oldest_messages = self.db.query(ChatMessage).filter(
                    ChatMessage.user_id == user_id
                ).order_by(ChatMessage.timestamp.asc()).limit(excess_count)
                
                deleted_count = oldest_messages.count()
                if deleted_count > 0:
                    oldest_messages.delete(synchronize_session=False)
                    total_deleted += deleted_count
                    logger.info(f"Deleted {deleted_count} excess messages for user {user_id} (limit: {self.MAX_CHAT_MESSAGES_PER_USER})")
            
            return total_deleted
                    
        except Exception as e:
            logger.error(f"Error cleaning up user message limits: {e}")
            return 0
    
    def sync_user_message_counts(self) -> Dict[str, int]:
        """Синхронизирует счетчики сообщений пользователей с реальными данными в базе"""
        try:
            from core.database import UserProgression
            from sqlalchemy import func
            
            sync_stats = {
                'users_updated': 0,
                'total_discrepancies': 0
            }
            
            # Получаем всех пользователей с прогрессией
            progressions = self.db.query(UserProgression).all()
            
            for progression in progressions:
                # Считаем реальное количество сообщений (включая удаленные)
                real_count = self.db.query(ChatMessage).filter(
                    and_(
                        ChatMessage.user_id == progression.user_id,
                        ChatMessage.channel_name == progression.channel_name,
                        ChatMessage.platform == progression.platform
                    )
                ).count()
                
                # Если есть расхождение, обновляем счетчик
                if progression.total_messages != real_count:
                    discrepancy = abs(progression.total_messages - real_count)
                    progression.total_messages = real_count
                    sync_stats['users_updated'] += 1
                    sync_stats['total_discrepancies'] += discrepancy
                    
                    logger.info(f"Synced message count for user {progression.user_id} in {progression.channel_name}: {real_count}")
            
            if sync_stats['users_updated'] > 0:
                self.db.commit()
                logger.info(f"Message count sync completed: {sync_stats}")
            
            return sync_stats
            
        except Exception as e:
            logger.error(f"Error syncing user message counts: {e}")
            self.db.rollback()
            return {}
    
    def get_user_message_count(self, username: str, platform: str) -> int:
        """Получает количество сообщений пользователя"""
        try:
            user = self.db.query(User).filter(User.id == int(username)).first()
            if not user:
                return 0
            
            count = self.db.query(ChatMessage).filter(
                and_(
                    ChatMessage.user_id == user.id,
                    ChatMessage.platform == platform
                )
            ).count()
            
            return count
            
        except Exception as e:
            logger.error(f"Error getting user message count: {e}")
            return 0
    
    def cleanup_user_data(self, username: str, platform: str, keep_days: int = 30) -> int:
        """Очищает старые данные конкретного пользователя"""
        try:
            user = self.db.query(User).filter(User.id == int(username)).first()
            if not user:
                return 0
            
            cutoff_date = utcnow_naive() - timedelta(days=keep_days)
            
            old_messages = self.db.query(ChatMessage).filter(
                and_(
                    ChatMessage.user_id == user.id,
                    ChatMessage.platform == platform,
                    ChatMessage.timestamp < cutoff_date
                )
            )
            
            count = old_messages.count()
            if count > 0:
                old_messages.delete(synchronize_session=False)
                self.db.commit()
                logger.info(f"Cleaned {count} old messages for user {username}")
            
            return count
            
        except Exception as e:
            logger.error(f"Error cleaning user data: {e}")
            self.db.rollback()
            return 0
    
    def cleanup_cache(self) -> Dict[str, Any]:
        """Очищает кеш файлы"""
        try:
            import shutil
            import pathlib
            
            cache_dirs = [
                os.path.join(os.getcwd(), '.cache'),
                os.path.join(os.getcwd(), 'tts_service', 'cache'),
                os.path.join(os.getcwd(), 'temp'),
            ]
            
            deleted_files = 0
            freed_space = 0
            
            for cache_dir in cache_dirs:
                if not os.path.exists(cache_dir):
                    continue
                    
                try:
                    for cache_file in pathlib.Path(cache_dir).glob('**/*'):
                        if cache_file.is_file():
                            try:
                                freed_space += cache_file.stat().st_size
                                cache_file.unlink()
                                deleted_files += 1
                            except Exception as e:
                                logger.warning(f"Could not delete cache file {cache_file}: {e}")
                except Exception as e:
                    logger.warning(f"Error cleaning cache directory {cache_dir}: {e}")
            
            logger.info(f"💾 Cache cleaned: {deleted_files} files removed, freed {freed_space / (1024*1024):.2f} MB")
            return {
                'deleted_files': deleted_files,
                'freed_space_bytes': freed_space
            }
            
        except Exception as e:
            logger.error(f"Error cleaning cache: {e}")
            return {'deleted_files': 0, 'freed_space_bytes': 0, 'error': str(e)}
    
    def create_backup(self) -> Dict[str, Any]:
        """Создает резервную копию базы данных"""
        try:
            from datetime import datetime
            import subprocess
            
            backup_dir = os.path.join(os.getcwd(), 'backups')
            os.makedirs(backup_dir, exist_ok=True)
            
            # PostgreSQL: используем pg_dump
            import subprocess
            from core.config import settings as app_settings
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            database_url = app_settings.database_url
            if not database_url or 'postgresql://' not in database_url:
                return {'success': False, 'error': 'PostgreSQL DATABASE_URL not configured'}
            
            # Парсим DATABASE_URL для pg_dump
            from urllib.parse import urlparse
            parsed = urlparse(database_url)
            backup_file = os.path.join(backup_dir, f'backup_{timestamp}.sql')
            
            try:
                # Формируем команду pg_dump
                pg_dump_cmd = [
                    'pg_dump',
                    '-h', parsed.hostname or 'localhost',
                    '-p', str(parsed.port or 5432),
                    '-U', parsed.username,
                    '-d', parsed.path[1:] if parsed.path else '',
                    '-f', backup_file
                ]
                
                # Устанавливаем пароль через переменную окружения
                env = os.environ.copy()
                if parsed.password:
                    env['PGPASSWORD'] = parsed.password
                
                result = subprocess.run(pg_dump_cmd, env=env, capture_output=True, text=True)
                
                if result.returncode == 0:
                    file_size = os.path.getsize(backup_file)
                    logger.info(f"🔐 PostgreSQL backup created: {backup_file} ({file_size / (1024*1024):.2f} MB)")
                    return {
                        'success': True,
                        'backup_file': backup_file,
                        'size_bytes': file_size,
                        'timestamp': timestamp,
                        'type': 'postgresql'
                    }
                else:
                    logger.error(f"pg_dump error: {result.stderr}")
                    return {'success': False, 'error': f'pg_dump failed: {result.stderr}'}
            except FileNotFoundError:
                return {'success': False, 'error': 'pg_dump not found. Install PostgreSQL client tools.'}
            except Exception as e:
                logger.error(f"PostgreSQL backup error: {e}")
                return {'success': False, 'error': str(e)}
            
        except Exception as e:
            logger.error(f"Error creating backup: {e}")
            return {'success': False, 'error': str(e)}
    
    def restore_from_backup(self) -> Dict[str, Any]:
        """Восстанавливает БД из последней резервной копии (PostgreSQL)"""
        try:
            import pathlib
            
            backup_dir = os.path.join(os.getcwd(), 'backups')
            if not os.path.exists(backup_dir):
                return {'success': False, 'error': 'No backups found'}
            
            # PostgreSQL: используем psql для восстановления
            from core.config import settings as app_settings
            database_url = app_settings.database_url
            if not database_url or 'postgresql://' not in database_url:
                return {'success': False, 'error': 'PostgreSQL DATABASE_URL not configured'}
            
            # Находим последний SQL бэкап
            backup_files = sorted(pathlib.Path(backup_dir).glob('backup_*.sql'), 
                                 key=lambda p: p.stat().st_mtime, reverse=True)
            
            if not backup_files:
                return {'success': False, 'error': 'No PostgreSQL backups found'}
            
            latest_backup = backup_files[0]
            
            # Парсим DATABASE_URL
            from urllib.parse import urlparse
            parsed = urlparse(database_url)
            
            try:
                import subprocess
                # Используем psql для восстановления
                psql_cmd = [
                    'psql',
                    '-h', parsed.hostname or 'localhost',
                    '-p', str(parsed.port or 5432),
                    '-U', parsed.username,
                    '-d', parsed.path[1:] if parsed.path else '',
                    '-f', str(latest_backup)
                ]
                
                env = os.environ.copy()
                if parsed.password:
                    env['PGPASSWORD'] = parsed.password
                
                result = subprocess.run(psql_cmd, env=env, capture_output=True, text=True)
                
                if result.returncode == 0:
                    logger.info(f"✅ PostgreSQL database restored from {latest_backup}")
                    return {
                        'success': True,
                        'restored_from': str(latest_backup),
                        'type': 'postgresql'
                    }
                else:
                    logger.error(f"psql restore error: {result.stderr}")
                    return {'success': False, 'error': f'Restore failed: {result.stderr}'}
            except FileNotFoundError:
                return {'success': False, 'error': 'psql not found. Install PostgreSQL client tools.'}
            except Exception as e:
                logger.error(f"PostgreSQL restore error: {e}")
                return {'success': False, 'error': str(e)}
            
        except Exception as e:
            logger.error(f"Error restoring backup: {e}")
            return {'success': False, 'error': str(e)}

    def _get_actual_database_size(self) -> int:
        """Получает реальный размер базы данных в байтах (PostgreSQL)"""
        try:
            # PostgreSQL: используем SQL запрос
            from sqlalchemy import text
            result = self.db.execute(text("SELECT pg_database_size(current_database())"))
            size = result.scalar()
            return size if size else 0
        except Exception as e:
            logger.error(f"Error getting actual database size: {e}")
            return 0

    def _get_voices_size(self) -> int:
        """Получает размер директории пользовательских голосов в байтах"""
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
        except Exception as e:
            logger.error(f"Error getting voices size: {e}")
            return 0

    def _count_voice_files(self) -> int:
        """Подсчитывает количество файлов голосов в директории"""
        try:
            voices_dir = os.path.join(os.getcwd(), 'tts_service', 'user_voices')
            if not os.path.exists(voices_dir):
                return 0
            return len([f for f in os.listdir(voices_dir) if f.endswith('.wav')])
        except Exception as e:
            logger.error(f"Error counting voice files: {e}")
            return 0

    def _get_cache_size(self) -> int:
        """Получает размер директории кеша в байтах"""
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
        except Exception as e:
            logger.error(f"Error getting cache size: {e}")
            return 0

    def _count_cache_files(self) -> int:
        """Подсчитывает количество файлов в директориях кеша"""
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
        except Exception as e:
            logger.error(f"Error counting cache files: {e}")
            return 0

    def _get_latest_backup_size(self) -> int:
        """Получает размер последней резервной копии в байтах"""
        try:
            backup_dir = os.path.join(os.getcwd(), 'backups')
            if not os.path.exists(backup_dir):
                return 0
            latest_backup = sorted(os.listdir(backup_dir), key=lambda x: os.path.getmtime(os.path.join(backup_dir, x)))[-1]
            return os.path.getsize(os.path.join(backup_dir, latest_backup))
        except Exception as e:
            logger.error(f"Error getting latest backup size: {e}")
            return 0

    def _get_latest_backup_time(self) -> str:
        """Получает время последней резервной копии"""
        try:
            from datetime import datetime
            backup_dir = os.path.join(os.getcwd(), 'backups')
            if not os.path.exists(backup_dir):
                return None
            files = [f for f in os.listdir(backup_dir) if f.startswith('backup_') and f.endswith('.db')]
            if not files:
                return None
            latest_backup = sorted(files, key=lambda x: os.path.getmtime(os.path.join(backup_dir, x)))[-1]
            timestamp = os.path.getmtime(os.path.join(backup_dir, latest_backup))
            return datetime.fromtimestamp(timestamp).isoformat()
        except Exception as e:
            logger.error(f"Error getting latest backup time: {e}")
            return None
    
    def list_backups(self) -> Dict[str, Any]:
        """Получает список всех резервных копий"""
        try:
            from datetime import datetime
            backup_dir = os.path.join(os.getcwd(), 'backups')
            if not os.path.exists(backup_dir):
                return {'success': True, 'backups': []}
            
            backups = []
            for filename in os.listdir(backup_dir):
                if filename.startswith('backup_') and filename.endswith('.db'):
                    file_path = os.path.join(backup_dir, filename)
                    stat = os.stat(file_path)
                    backups.append({
                        'filename': filename,
                        'size_bytes': stat.st_size,
                        'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat()
                    })
            
            # Сортируем по дате создания (новые первыми)
            backups.sort(key=lambda x: x['created_at'], reverse=True)
            
            return {
                'success': True,
                'backups': backups,
                'total': len(backups),
                'total_size_bytes': sum(b['size_bytes'] for b in backups)
            }
        except Exception as e:
            logger.error(f"Error listing backups: {e}")
            return {'success': False, 'error': str(e), 'backups': []}
    
    def delete_backup(self, filename: str) -> Dict[str, Any]:
        """Удаляет конкретную резервную копию"""
        try:
            backup_dir = os.path.join(os.getcwd(), 'backups')
            file_path = os.path.join(backup_dir, filename)
            
            # Безопасность: проверяем что файл находится в backup_dir и имеет правильное имя
            if not filename.startswith('backup_') or not filename.endswith('.db'):
                return {'success': False, 'error': 'Invalid backup filename'}
            
            if not os.path.exists(file_path):
                return {'success': False, 'error': 'Backup file not found'}
            
            # Проверяем что путь нормализован (защита от path traversal)
            if os.path.abspath(file_path) != file_path or '..' in filename:
                return {'success': False, 'error': 'Invalid file path'}
            
            file_size = os.path.getsize(file_path)
            os.remove(file_path)
            
            logger.info(f"🗑️ Backup deleted: {filename} ({file_size / (1024*1024):.2f} MB)")
            return {
                'success': True,
                'deleted_file': filename,
                'freed_bytes': file_size
            }
        except Exception as e:
            logger.error(f"Error deleting backup: {e}")
            return {'success': False, 'error': str(e)}
    
    def restore_from_backup_file(self, filename: str) -> Dict[str, Any]:
        """Восстанавливает БД из конкретной резервной копии (PostgreSQL)"""
        try:
            from datetime import datetime
            
            backup_dir = os.path.join(os.getcwd(), 'backups')
            backup_file = os.path.join(backup_dir, filename)
            
            # PostgreSQL: проверяем расширение .sql
            if not filename.startswith('backup_') or not filename.endswith('.sql'):
                return {'success': False, 'error': 'Invalid PostgreSQL backup filename (must be .sql)'}
            
            if not os.path.exists(backup_file):
                return {'success': False, 'error': 'Backup file not found'}
            
            # Проверяем что путь нормализован
            if os.path.abspath(backup_file) != backup_file or '..' in filename:
                return {'success': False, 'error': 'Invalid file path'}
            
            database_url = os.getenv('DATABASE_URL', '')
            if not database_url or 'postgresql://' not in database_url:
                return {'success': False, 'error': 'PostgreSQL DATABASE_URL not configured'}
            
            from urllib.parse import urlparse
            parsed = urlparse(database_url)
            
            try:
                import subprocess
                psql_cmd = [
                    'psql',
                    '-h', parsed.hostname or 'localhost',
                    '-p', str(parsed.port or 5432),
                    '-U', parsed.username,
                    '-d', parsed.path[1:] if parsed.path else '',
                    '-f', backup_file
                ]
                
                env = os.environ.copy()
                if parsed.password:
                    env['PGPASSWORD'] = parsed.password
                
                result = subprocess.run(psql_cmd, env=env, capture_output=True, text=True)
                
                if result.returncode == 0:
                    logger.info(f"✅ PostgreSQL database restored from {filename}")
                    return {
                        'success': True,
                        'restored_from': filename,
                        'type': 'postgresql',
                        'message': f'PostgreSQL database restored from {filename}'
                    }
                else:
                    logger.error(f"psql restore error: {result.stderr}")
                    return {'success': False, 'error': f'Restore failed: {result.stderr}'}
            except FileNotFoundError:
                return {'success': False, 'error': 'psql not found. Install PostgreSQL client tools.'}
            except Exception as e:
                logger.error(f"PostgreSQL restore error: {e}")
                return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Error restoring from {filename}: {e}")
            return {'success': False, 'error': str(e)}