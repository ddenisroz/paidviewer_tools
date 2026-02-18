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
        """РЎРѕР·РґР°РµС‚ СЂРµР·РµСЂРІРЅСѓСЋ РєРѕРїРёСЋ Р±Р°Р·С‹ РґР°РЅРЅС‹С…"""
        try:
            backup_dir = os.path.join(os.getcwd(), 'backups')
            os.makedirs(backup_dir, exist_ok=True)

            # PostgreSQL: РёСЃРїРѕР»СЊР·СѓРµРј pg_dump
            from core.config import settings as app_settings
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            database_url = app_settings.database_url
            if not database_url or 'postgresql://' not in database_url:
                return {'success': False, 'error': 'PostgreSQL DATABASE_URL not configured'}

            # РџР°СЂСЃРёРј DATABASE_URL РґР»СЏ pg_dump
            parsed = urlparse(database_url)
            backup_file = os.path.join(backup_dir, f'backup_{timestamp}.sql')

            try:
                # Р¤РѕСЂРјРёСЂСѓРµРј РєРѕРјР°РЅРґСѓ pg_dump
                pg_dump_cmd = [
                    'pg_dump',
                    '-h', parsed.hostname or 'localhost',
                    '-p', str(parsed.port or 5432),
                    '-U', parsed.username,
                    '-d', parsed.path[1:] if parsed.path else '',
                    '-f', backup_file
                ]

                # РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј РїР°СЂРѕР»СЊ С‡РµСЂРµР· РїРµСЂРµРјРµРЅРЅСѓСЋ РѕРєСЂСѓР¶РµРЅРёСЏ
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
                    logger.error("pg_dump failed with returncode=%s stderr=%s", result.returncode, (result.stderr or "")[:500])
                    return {'success': False, 'error': 'pg_dump failed'}
            except FileNotFoundError:
                return {'success': False, 'error': 'pg_dump not found. Install PostgreSQL client tools.'}
            except Exception:
                logger.exception("PostgreSQL backup error")
                return {'success': False, 'error': "Internal server error"}

        except Exception:
            logger.exception("Error creating backup")
            return {'success': False, 'error': "Internal server error"}

    def restore_from_backup(self) -> Dict[str, Any]:
        """Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ Р‘Р” РёР· РїРѕСЃР»РµРґРЅРµР№ СЂРµР·РµСЂРІРЅРѕР№ РєРѕРїРёРё (PostgreSQL)"""
        try:
            backup_dir = os.path.join(os.getcwd(), 'backups')
            if not os.path.exists(backup_dir):
                return {'success': False, 'error': 'No backups found'}

            # PostgreSQL configuration
            from core.config import settings as app_settings
            database_url = app_settings.database_url
            if not database_url or 'postgresql://' not in database_url:
                return {'success': False, 'error': 'PostgreSQL DATABASE_URL not configured'}

            # РќР°С…РѕРґРёРј РїРѕСЃР»РµРґРЅРёР№ SQL Р±СЌРєР°Рї
            backup_files = sorted(pathlib.Path(backup_dir).glob('backup_*.sql'),
                                 key=lambda p: p.stat().st_mtime, reverse=True)

            if not backup_files:
                return {'success': False, 'error': 'No PostgreSQL backups found'}

            latest_backup = backup_files[0]
            
            return self.restore_from_backup_file(latest_backup.name)

        except Exception:
            logger.exception("Error restoring backup")
            return {'success': False, 'error': "Internal server error"}

    def restore_from_backup_file(self, filename: str) -> Dict[str, Any]:
        """Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ Р‘Р” РёР· РєРѕРЅРєСЂРµС‚РЅРѕР№ СЂРµР·РµСЂРІРЅРѕР№ РєРѕРїРёРё (PostgreSQL)"""
        try:
            backup_dir = os.path.join(os.getcwd(), 'backups')
            backup_dir_path = pathlib.Path(backup_dir).resolve()

            # PostgreSQL: РїСЂРѕРІРµСЂСЏРµРј СЂР°СЃС€РёСЂРµРЅРёРµ .sql
            if not filename.startswith('backup_') or not filename.endswith('.sql'):
                return {'success': False, 'error': 'Invalid PostgreSQL backup filename (must be .sql)'}
            if '/' in filename or '\\' in filename or '..' in filename:
                return {'success': False, 'error': 'Invalid file path'}

            backup_file_path = (backup_dir_path / filename).resolve()
            try:
                backup_file_path.relative_to(backup_dir_path)
            except ValueError:
                return {'success': False, 'error': 'Invalid file path'}

            if not backup_file_path.exists():
                return {'success': False, 'error': 'Backup file not found'}

            from core.config import settings
            database_url = settings.database_url
            if not database_url or 'postgresql://' not in database_url:
                return {'success': False, 'error': 'PostgreSQL DATABASE_URL not configured'}

            parsed = urlparse(database_url)

            try:
                # РСЃРїРѕР»СЊР·СѓРµРј psql РґР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ
                psql_cmd = [
                    'psql',
                    '-h', parsed.hostname or 'localhost',
                    '-p', str(parsed.port or 5432),
                    '-U', parsed.username,
                    '-d', parsed.path[1:] if parsed.path else '',
                    '-f', str(backup_file_path)
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
                    logger.error("psql restore failed with returncode=%s stderr=%s", result.returncode, (result.stderr or "")[:500])
                    return {'success': False, 'error': 'Restore failed'}
            except FileNotFoundError:
                return {'success': False, 'error': 'psql not found. Install PostgreSQL client tools.'}
            except Exception:
                logger.exception("PostgreSQL restore error")
                return {'success': False, 'error': "Internal server error"}
        except Exception:
            logger.exception("Error restoring from %s", filename)
            return {'success': False, 'error': "Internal server error"}

    def list_backups(self) -> Dict[str, Any]:
        """РџРѕР»СѓС‡Р°РµС‚ СЃРїРёСЃРѕРє РІСЃРµС… СЂРµР·РµСЂРІРЅС‹С… РєРѕРїРёР№"""
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

            # РЎРѕСЂС‚РёСЂСѓРµРј РїРѕ РґР°С‚Рµ СЃРѕР·РґР°РЅРёСЏ (РЅРѕРІС‹Рµ РїРµСЂРІС‹РјРё)
            backups.sort(key=lambda x: x['created_at'], reverse=True)

            return {
                'success': True,
                'backups': backups,
                'total': len(backups),
                'total_size_bytes': sum(b['size_bytes'] for b in backups)
            }
        except Exception:
            logger.exception("Error listing backups")
            return {'success': False, 'error': "Internal server error", 'backups': []}

    def delete_backup(self, filename: str) -> Dict[str, Any]:
        """РЈРґР°Р»СЏРµС‚ РєРѕРЅРєСЂРµС‚РЅСѓСЋ СЂРµР·РµСЂРІРЅСѓСЋ РєРѕРїРёСЋ"""
        try:
            backup_dir = os.path.join(os.getcwd(), 'backups')
            backup_dir_path = pathlib.Path(backup_dir).resolve()

            # ????????????: ????????? ??? ???? ????????? ? backup_dir ? ????? ?????????? ???
            if not filename.startswith('backup_') or not (filename.endswith('.db') or filename.endswith('.sql')):
                return {'success': False, 'error': 'Invalid backup filename'}
            if '/' in filename or '\\' in filename or '..' in filename:
                return {'success': False, 'error': 'Invalid file path'}

            file_path = (backup_dir_path / filename).resolve()
            try:
                file_path.relative_to(backup_dir_path)
            except ValueError:
                return {'success': False, 'error': 'Invalid file path'}

            if not os.path.exists(file_path):
                return {'success': False, 'error': 'Backup file not found'}

            file_size = os.path.getsize(file_path)
            os.remove(file_path)

            logger.info(f"[DELETE] Backup deleted: {filename} ({file_size / (1024*1024):.2f} MB)")
            return {
                'success': True,
                'deleted_file': filename,
                'freed_bytes': file_size
            }
        except Exception:
            logger.exception("Error deleting backup")
            return {'success': False, 'error': "Internal server error"}
