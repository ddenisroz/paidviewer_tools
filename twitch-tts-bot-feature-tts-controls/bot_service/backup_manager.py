# bot_service/backup_manager.py
import os
import shutil
import sqlite3
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional
import schedule
import threading
import time

class BackupManager:
    """Менеджер автоматических бэкапов системы"""
    
    def __init__(self, service_name: str = "bot_service"):
        self.service_name = service_name
        self.logger = logging.getLogger(f"{service_name}.backup")
        
        # Пути для бэкапов
        self.backups_dir = Path("backups")
        self.backups_dir.mkdir(exist_ok=True)
        
        # Подпапки для разных типов бэкапов
        self.db_backups_dir = self.backups_dir / "database"
        self.config_backups_dir = self.backups_dir / "config"
        self.logs_backups_dir = self.backups_dir / "logs"
        self.audio_backups_dir = self.backups_dir / "audio"
        
        for dir_path in [self.db_backups_dir, self.config_backups_dir, self.logs_backups_dir, self.audio_backups_dir]:
            dir_path.mkdir(exist_ok=True)
        
        # Настройки бэкапов
        self.max_db_backups = 30  # Дней
        self.max_config_backups = 7  # Дней
        self.max_logs_backups = 7  # Дней
        self.max_audio_backups = 3  # Дней
    
    def create_database_backup(self, db_path: str, backup_name: Optional[str] = None) -> str:
        """Создание бэкапа базы данных"""
        try:
            if not os.path.exists(db_path):
                self.logger.error(f"Database file not found: {db_path}")
                return None
            
            # Генерируем имя файла бэкапа
            if not backup_name:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_name = f"{self.service_name}_db_{timestamp}.db"
            
            backup_path = self.db_backups_dir / backup_name
            
            # Создаем бэкап через SQLite
            source_conn = sqlite3.connect(db_path)
            backup_conn = sqlite3.connect(backup_path)
            
            source_conn.backup(backup_conn)
            
            source_conn.close()
            backup_conn.close()
            
            self.logger.info(f"Database backup created: {backup_path}")
            return str(backup_path)
            
        except Exception as e:
            self.logger.error(f"Error creating database backup: {e}")
            return None
    
    def create_config_backup(self, config_files: List[str]) -> str:
        """Создание бэкапа конфигурационных файлов"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"{self.service_name}_config_{timestamp}"
            backup_path = self.config_backups_dir / backup_name
            backup_path.mkdir(exist_ok=True)
            
            copied_files = []
            for config_file in config_files:
                if os.path.exists(config_file):
                    file_path = Path(config_file)
                    dest_path = backup_path / file_path.name
                    shutil.copy2(config_file, dest_path)
                    copied_files.append(str(dest_path))
            
            # Создаем архив
            archive_path = f"{backup_path}.tar.gz"
            shutil.make_archive(str(backup_path), 'gztar', str(backup_path))
            shutil.rmtree(backup_path)  # Удаляем временную папку
            
            self.logger.info(f"Config backup created: {archive_path}")
            return archive_path
            
        except Exception as e:
            self.logger.error(f"Error creating config backup: {e}")
            return None
    
    def create_logs_backup(self, logs_dir: str) -> str:
        """Создание бэкапа логов"""
        try:
            if not os.path.exists(logs_dir):
                self.logger.warning(f"Logs directory not found: {logs_dir}")
                return None
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"{self.service_name}_logs_{timestamp}"
            backup_path = self.logs_backups_dir / backup_name
            
            # Создаем архив логов
            shutil.make_archive(str(backup_path), 'gztar', logs_dir)
            archive_path = f"{backup_path}.tar.gz"
            
            self.logger.info(f"Logs backup created: {archive_path}")
            return archive_path
            
        except Exception as e:
            self.logger.error(f"Error creating logs backup: {e}")
            return None
    
    def create_audio_backup(self, audio_dir: str) -> str:
        """Создание бэкапа аудио файлов"""
        try:
            if not os.path.exists(audio_dir):
                self.logger.warning(f"Audio directory not found: {audio_dir}")
                return None
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"{self.service_name}_audio_{timestamp}"
            backup_path = self.audio_backups_dir / backup_name
            
            # Создаем архив аудио
            shutil.make_archive(str(backup_path), 'gztar', audio_dir)
            archive_path = f"{backup_path}.tar.gz"
            
            self.logger.info(f"Audio backup created: {archive_path}")
            return archive_path
            
        except Exception as e:
            self.logger.error(f"Error creating audio backup: {e}")
            return None
    
    def cleanup_old_backups(self):
        """Очистка старых бэкапов"""
        try:
            now = datetime.now()
            
            # Очистка бэкапов БД
            self._cleanup_directory(self.db_backups_dir, self.max_db_backups, now)
            
            # Очистка бэкапов конфигурации
            self._cleanup_directory(self.config_backups_dir, self.max_config_backups, now)
            
            # Очистка бэкапов логов
            self._cleanup_directory(self.logs_backups_dir, self.max_logs_backups, now)
            
            # Очистка бэкапов аудио
            self._cleanup_directory(self.audio_backups_dir, self.max_audio_backups, now)
            
            self.logger.info("Old backups cleanup completed")
            
        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")
    
    def _cleanup_directory(self, directory: Path, max_days: int, now: datetime):
        """Очистка файлов в директории старше max_days дней"""
        if not directory.exists():
            return
        
        cutoff_date = now - timedelta(days=max_days)
        
        for file_path in directory.iterdir():
            if file_path.is_file():
                file_time = datetime.fromtimestamp(file_path.stat().st_mtime)
                if file_time < cutoff_date:
                    try:
                        file_path.unlink()
                        self.logger.info(f"Deleted old backup: {file_path}")
                    except Exception as e:
                        self.logger.error(f"Error deleting {file_path}: {e}")
    
    def get_backup_info(self) -> dict:
        """Получение информации о бэкапах"""
        info = {
            "database_backups": [],
            "config_backups": [],
            "logs_backups": [],
            "audio_backups": []
        }
        
        for backup_type, directory in [
            ("database_backups", self.db_backups_dir),
            ("config_backups", self.config_backups_dir),
            ("logs_backups", self.logs_backups_dir),
            ("audio_backups", self.audio_backups_dir)
        ]:
            if directory.exists():
                for file_path in directory.iterdir():
                    if file_path.is_file():
                        stat = file_path.stat()
                        info[backup_type].append({
                            "name": file_path.name,
                            "size": stat.st_size,
                            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
                        })
        
        return info
    
    def schedule_backups(self):
        """Планирование автоматических бэкапов"""
        # Ежедневный бэкап БД в 2:00
        schedule.every().day.at("02:00").do(self._daily_backup)
        
        # Еженедельный полный бэкап в воскресенье в 3:00
        schedule.every().sunday.at("03:00").do(self._weekly_backup)
        
        # Ежедневная очистка старых бэкапов в 4:00
        schedule.every().day.at("04:00").do(self.cleanup_old_backups)
        
        self.logger.info("Backup schedule configured")
    
    def _daily_backup(self):
        """Ежедневный бэкап"""
        try:
            # Бэкап БД
            db_path = "core/data/app_data.db"
            if os.path.exists(db_path):
                self.create_database_backup(db_path)
            
            self.logger.info("Daily backup completed")
        except Exception as e:
            self.logger.error(f"Error in daily backup: {e}")
    
    def _weekly_backup(self):
        """Еженедельный полный бэкап"""
        try:
            # Бэкап БД
            db_path = "core/data/app_data.db"
            if os.path.exists(db_path):
                self.create_database_backup(db_path)
            
            # Бэкап конфигурации
            config_files = [".env", "alembic.ini"]
            self.create_config_backup(config_files)
            
            # Бэкап логов
            self.create_logs_backup("logs")
            
            self.logger.info("Weekly backup completed")
        except Exception as e:
            self.logger.error(f"Error in weekly backup: {e}")
    
    def start_scheduler(self):
        """Запуск планировщика бэкапов в отдельном потоке"""
        def run_scheduler():
            while True:
                schedule.run_pending()
                time.sleep(60)  # Проверяем каждую минуту
        
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()
        self.logger.info("Backup scheduler started")

# Глобальные экземпляры
bot_backup_manager = BackupManager("bot_service")
tts_backup_manager = BackupManager("tts_service")
