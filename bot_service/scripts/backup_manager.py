#!/usr/bin/env python3
"""
Менеджер бэкапов для bot_service
Создает бэкапы базы данных, конфигурации и других важных файлов
"""

import os
import sys
import shutil
import sqlite3
import json
import argparse
from pathlib import Path
from datetime import datetime
import logging
import gzip

# Добавляем корневую папку в путь для импорта модулей
sys.path.append(str(Path(__file__).parent.parent))

from logging_config import LoggingConfig

class BackupManager:
    def __init__(self, service_name: str = "bot_service"):
        self.service_name = service_name
        self.base_dir = Path(__file__).parent.parent
        self.backups_dir = self.base_dir / "backups"
        
        # Создаем структуру папок для бэкапов
        self.db_backups_dir = self.backups_dir / "database"
        self.config_backups_dir = self.backups_dir / "config"
        self.audio_backups_dir = self.backups_dir / "audio"
        self.full_backups_dir = self.backups_dir / "full"
        
        for backup_dir in [self.db_backups_dir, self.config_backups_dir, 
                          self.audio_backups_dir, self.full_backups_dir]:
            backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Настройка логирования
        self.logger = LoggingConfig(service_name).setup_logging("INFO")
        
        # Пути к важным файлам
        self.db_path = self.base_dir / "bot_service.db"
        self.config_files = [
            self.base_dir / "env.production.example",
            self.base_dir / "alembic.ini",
            self.base_dir / "requirements.txt"
        ]
        
    def create_timestamp(self) -> str:
        """Создать временную метку для имени файла"""
        return datetime.now().strftime("%Y%m%d_%H%M%S")
    
    def compress_file(self, source_path: Path, target_path: Path) -> bool:
        """Сжать файл с помощью gzip"""
        try:
            with open(source_path, 'rb') as f_in:
                with gzip.open(target_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            return True
        except Exception as e:
            self.logger.error(f"Ошибка сжатия {source_path}: {e}")
            return False
    
    def backup_database(self, compress: bool = True) -> Path:
        """Создать бэкап базы данных"""
        if not self.db_path.exists():
            self.logger.warning(f"База данных {self.db_path} не найдена")
            return None
        
        timestamp = self.create_timestamp()
        backup_name = f"bot_service_db_{timestamp}.db"
        if compress:
            backup_name += ".gz"
        
        backup_path = self.db_backups_dir / backup_name
        
        try:
            # Создаем копию базы данных
            shutil.copy2(self.db_path, backup_path)
            
            if compress:
                # Сжимаем файл
                compressed_path = backup_path.with_suffix(backup_path.suffix + '.gz')
                if self.compress_file(backup_path, compressed_path):
                    backup_path.unlink()  # Удаляем несжатую версию
                    backup_path = compressed_path
                else:
                    self.logger.error("Не удалось сжать бэкап базы данных")
            
            # Проверяем целостность бэкапа
            if self.verify_database_backup(backup_path):
                self.logger.info(f"Бэкап базы данных создан: {backup_path}")
                return backup_path
            else:
                self.logger.error("Бэкап базы данных поврежден")
                backup_path.unlink()
                return None
                
        except Exception as e:
            self.logger.error(f"Ошибка создания бэкапа базы данных: {e}")
            return None
    
    def verify_database_backup(self, backup_path: Path) -> bool:
        """Проверить целостность бэкапа базы данных"""
        try:
            # Если файл сжат, распаковываем во временный файл
            if backup_path.suffix == '.gz':
                import tempfile
                with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                    with gzip.open(backup_path, 'rb') as f_in:
                        shutil.copyfileobj(f_in, temp_file)
                    temp_path = Path(temp_file.name)
            else:
                temp_path = backup_path
            
            # Проверяем целостность SQLite
            conn = sqlite3.connect(str(temp_path))
            cursor = conn.cursor()
            cursor.execute("PRAGMA integrity_check")
            result = cursor.fetchone()
            conn.close()
            
            # Удаляем временный файл если он был создан
            if backup_path.suffix == '.gz' and temp_path.exists():
                temp_path.unlink()
            
            return result[0] == "ok"
            
        except Exception as e:
            self.logger.error(f"Ошибка проверки целостности бэкапа: {e}")
            return False
    
    def backup_configuration(self, compress: bool = True) -> Path:
        """Создать бэкап конфигурационных файлов"""
        timestamp = self.create_timestamp()
        backup_name = f"config_{timestamp}.json"
        if compress:
            backup_name += ".gz"
        
        backup_path = self.config_backups_dir / backup_name
        
        try:
            config_data = {
                "timestamp": datetime.now().isoformat(),
                "service": self.service_name,
                "files": {}
            }
            
            # Собираем информацию о конфигурационных файлах
            for config_file in self.config_files:
                if config_file.exists():
                    config_data["files"][config_file.name] = {
                        "path": str(config_file),
                        "size": config_file.stat().st_size,
                        "modified": datetime.fromtimestamp(config_file.stat().st_mtime).isoformat(),
                        "content": config_file.read_text(encoding='utf-8')
                    }
            
            # Сохраняем в JSON
            json_str = json.dumps(config_data, indent=2, ensure_ascii=False)
            
            if compress:
                with gzip.open(backup_path, 'wt', encoding='utf-8') as f:
                    f.write(json_str)
            else:
                with open(backup_path, 'w', encoding='utf-8') as f:
                    f.write(json_str)
            
            self.logger.info(f"Бэкап конфигурации создан: {backup_path}")
            return backup_path
            
        except Exception as e:
            self.logger.error(f"Ошибка создания бэкапа конфигурации: {e}")
            return None
    
    def backup_audio_files(self, compress: bool = True) -> Path:
        """Создать бэкап аудио файлов"""
        audio_dir = self.base_dir / "audio"
        if not audio_dir.exists():
            self.logger.warning(f"Папка аудио {audio_dir} не найдена")
            return None
        
        timestamp = self.create_timestamp()
        backup_name = f"audio_{timestamp}.tar.gz"
        backup_path = self.audio_backups_dir / backup_name
        
        try:
            import tarfile
            
            with tarfile.open(backup_path, "w:gz") as tar:
                tar.add(audio_dir, arcname="audio")
            
            self.logger.info(f"Бэкап аудио файлов создан: {backup_path}")
            return backup_path
            
        except Exception as e:
            self.logger.error(f"Ошибка создания бэкапа аудио: {e}")
            return None
    
    def create_full_backup(self, compress: bool = True) -> Path:
        """Создать полный бэкап всех важных файлов"""
        timestamp = self.create_timestamp()
        backup_name = f"full_backup_{timestamp}.tar.gz"
        backup_path = self.full_backups_dir / backup_name
        
        try:
            import tarfile
            
            with tarfile.open(backup_path, "w:gz") as tar:
                # Добавляем базу данных
                if self.db_path.exists():
                    tar.add(self.db_path, arcname="bot_service.db")
                
                # Добавляем конфигурационные файлы
                for config_file in self.config_files:
                    if config_file.exists():
                        tar.add(config_file, arcname=f"config/{config_file.name}")
                
                # Добавляем папку с данными
                data_dir = self.base_dir / "core" / "data"
                if data_dir.exists():
                    tar.add(data_dir, arcname="data")
                
                # Добавляем папку с логами (только последние)
                logs_dir = self.base_dir / "logs"
                if logs_dir.exists():
                    tar.add(logs_dir, arcname="logs")
            
            self.logger.info(f"Полный бэкап создан: {backup_path}")
            return backup_path
            
        except Exception as e:
            self.logger.error(f"Ошибка создания полного бэкапа: {e}")
            return None
    
    def get_backup_info(self, backup_path: Path) -> dict:
        """Получить информацию о бэкапе"""
        if not backup_path.exists():
            return None
        
        stat = backup_path.stat()
        return {
            "path": str(backup_path),
            "name": backup_path.name,
            "size": stat.st_size,
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
        }
    
    def list_backups(self, backup_type: str = "all") -> dict:
        """Список всех бэкапов"""
        backups = {
            "database": [],
            "config": [],
            "audio": [],
            "full": []
        }
        
        backup_dirs = {
            "database": self.db_backups_dir,
            "config": self.config_backups_dir,
            "audio": self.audio_backups_dir,
            "full": self.full_backups_dir
        }
        
        for backup_type_name, backup_dir in backup_dirs.items():
            if backup_type == "all" or backup_type == backup_type_name:
                for backup_file in backup_dir.glob("*"):
                    if backup_file.is_file():
                        info = self.get_backup_info(backup_file)
                        if info:
                            backups[backup_type_name].append(info)
        
        return backups
    
    def cleanup_old_backups(self, max_age_days: int = 30, backup_type: str = "all"):
        """Очистка старых бэкапов"""
        from cleanup_backups import BackupCleanup
        
        cleanup = BackupCleanup(self.service_name)
        
        if backup_type == "all" or backup_type == "database":
            cleanup.cleanup_directory(self.db_backups_dir, max_age_days, "*.db*")
        
        if backup_type == "all" or backup_type == "config":
            cleanup.cleanup_directory(self.config_backups_dir, max_age_days, "*.json*")
        
        if backup_type == "all" or backup_type == "audio":
            cleanup.cleanup_directory(self.audio_backups_dir, max_age_days, "*.tar.gz")
        
        if backup_type == "all" or backup_type == "full":
            cleanup.cleanup_directory(self.full_backups_dir, max_age_days, "*.tar.gz")
    
    def run_backup(self, backup_types: list = None, compress: bool = True, 
                  cleanup_old: bool = True, max_age_days: int = 30):
        """Запуск создания бэкапов"""
        if backup_types is None:
            backup_types = ["database", "config"]
        
        self.logger.info("=" * 50)
        self.logger.info("ЗАПУСК СОЗДАНИЯ БЭКАПОВ")
        self.logger.info("=" * 50)
        
        created_backups = []
        
        for backup_type in backup_types:
            if backup_type == "database":
                backup_path = self.backup_database(compress)
            elif backup_type == "config":
                backup_path = self.backup_configuration(compress)
            elif backup_type == "audio":
                backup_path = self.backup_audio_files(compress)
            elif backup_type == "full":
                backup_path = self.create_full_backup(compress)
            else:
                self.logger.warning(f"Неизвестный тип бэкапа: {backup_type}")
                continue
            
            if backup_path:
                created_backups.append(backup_path)
        
        # Очистка старых бэкапов
        if cleanup_old and created_backups:
            self.logger.info("Очистка старых бэкапов...")
            self.cleanup_old_backups(max_age_days)
        
        self.logger.info(f"Создано бэкапов: {len(created_backups)}")
        return created_backups

def main():
    parser = argparse.ArgumentParser(description="Менеджер бэкапов bot_service")
    parser.add_argument("--types", nargs="+", 
                       choices=["database", "config", "audio", "full"],
                       default=["database", "config"],
                       help="Типы бэкапов для создания")
    parser.add_argument("--no-compress", action="store_true",
                       help="Не сжимать бэкапы")
    parser.add_argument("--no-cleanup", action="store_true",
                       help="Не очищать старые бэкапы")
    parser.add_argument("--max-age", type=int, default=30,
                       help="Максимальный возраст бэкапов в днях")
    parser.add_argument("--list", action="store_true",
                       help="Показать список существующих бэкапов")
    parser.add_argument("--service", default="bot_service",
                       help="Имя сервиса")
    
    args = parser.parse_args()
    
    # Создаем менеджер бэкапов
    backup_manager = BackupManager(args.service)
    
    if args.list:
        # Показываем список бэкапов
        backups = backup_manager.list_backups()
        print("\nСуществующие бэкапы:")
        print("=" * 50)
        
        for backup_type, backup_list in backups.items():
            if backup_list:
                print(f"\n{backup_type.upper()}:")
                for backup in backup_list:
                    size_mb = backup["size"] / (1024 * 1024)
                    print(f"  {backup['name']} - {size_mb:.1f} MB - {backup['created']}")
    else:
        # Создаем бэкапы
        backup_manager.run_backup(
            backup_types=args.types,
            compress=not args.no_compress,
            cleanup_old=not args.no_cleanup,
            max_age_days=args.max_age
        )

if __name__ == "__main__":
    main()
