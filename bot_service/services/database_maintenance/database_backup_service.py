# services/database_maintenance/database_backup_service.py
import logging
import os
import pathlib
import subprocess
from datetime import datetime
from typing import Dict, Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class DatabaseBackupService:
    """Service for database backup and restore operations"""

    def create_backup(self) -> Dict[str, Any]:
        """Создает резервную копию базы данных"""
        try:
            backup_dir = os.path.join(os.getcwd(), 'backups')
            os.makedirs(backup_dir, exist_ok=True)

            # PostgreSQL: используем pg_dump
            from core.config import settings as app_settings
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            database_url = app_settings.database_url
            if not database_url or 'postgresql://' not in database_url:
                return {'success': False, 'error': 'PostgreSQL DATABASE_URL not configured'}

            # Парсим DATABASE_URL для pg_dump
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
                    logger.info(f"[AUTH] PostgreSQL backup created: {backup_file} ({file_size / (1024*1024):.2f} MB)")
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
            backup_dir = os.path.join(os.getcwd(), 'backups')
            if not os.path.exists(backup_dir):
                return {'success': False, 'error': 'No backups found'}

            # PostgreSQL configuration
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
            
            return self.restore_from_backup_file(latest_backup.name)

        except Exception as e:
            logger.error(f"Error restoring backup: {e}")
            return {'success': False, 'error': str(e)}

    def restore_from_backup_file(self, filename: str) -> Dict[str, Any]:
        """Восстанавливает БД из конкретной резервной копии (PostgreSQL)"""
        try:
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

            from core.config import settings
            database_url = settings.database_url
            if not database_url or 'postgresql://' not in database_url:
                return {'success': False, 'error': 'PostgreSQL DATABASE_URL not configured'}

            parsed = urlparse(database_url)

            try:
                # Используем psql для восстановления
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
                    logger.info(f"[OK] PostgreSQL database restored from {filename}")
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

    def list_backups(self) -> Dict[str, Any]:
        """Получает список всех резервных копий"""
        try:
            backup_dir = os.path.join(os.getcwd(), 'backups')
            if not os.path.exists(backup_dir):
                return {'success': True, 'backups': []}

            backups = []
            for filename in os.listdir(backup_dir):
                if filename.startswith('backup_') and (filename.endswith('.db') or filename.endswith('.sql')):
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
            if not filename.startswith('backup_') or not (filename.endswith('.db') or filename.endswith('.sql')):
                return {'success': False, 'error': 'Invalid backup filename'}

            if not os.path.exists(file_path):
                return {'success': False, 'error': 'Backup file not found'}

            # Проверяем что путь нормализован (защита от path traversal)
            if os.path.abspath(file_path) != file_path or '..' in filename:
                return {'success': False, 'error': 'Invalid file path'}

            file_size = os.path.getsize(file_path)
            os.remove(file_path)

            logger.info(f"[DELETE] Backup deleted: {filename} ({file_size / (1024*1024):.2f} MB)")
            return {
                'success': True,
                'deleted_file': filename,
                'freed_bytes': file_size
            }
        except Exception as e:
            logger.error(f"Error deleting backup: {e}")
            return {'success': False, 'error': str(e)}
