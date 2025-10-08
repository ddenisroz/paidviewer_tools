#!/usr/bin/env python3
"""
Скрипт для очистки старых бэкапов и логов
Удаляет файлы старше указанного количества дней
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime, timedelta
import logging

# Добавляем корневую папку в путь для импорта модулей
sys.path.append(str(Path(__file__).parent.parent))

from logging_config import LoggingConfig

class BackupCleanup:
    def __init__(self, service_name: str = "bot_service"):
        self.service_name = service_name
        self.base_dir = Path(__file__).parent.parent
        self.backups_dir = self.base_dir / "backups"
        self.logs_dir = self.base_dir / "logs"
        
        # Настройка логирования
        self.logger = LoggingConfig(service_name).setup_logging("INFO")
        
    def get_file_age_days(self, file_path: Path) -> int:
        """Получить возраст файла в днях"""
        if not file_path.exists():
            return 0
        
        file_time = datetime.fromtimestamp(file_path.stat().st_mtime)
        age = datetime.now() - file_time
        return age.days
    
    def cleanup_directory(self, directory: Path, max_age_days: int, 
                         file_pattern: str = "*", dry_run: bool = False) -> dict:
        """Очистка директории от старых файлов"""
        if not directory.exists():
            self.logger.warning(f"Директория {directory} не существует")
            return {"deleted": 0, "size_freed": 0, "errors": 0}
        
        deleted_count = 0
        size_freed = 0
        errors = 0
        
        try:
            # Ищем файлы по паттерну
            files = list(directory.glob(file_pattern))
            
            for file_path in files:
                if file_path.is_file():
                    age_days = self.get_file_age_days(file_path)
                    
                    if age_days > max_age_days:
                        file_size = file_path.stat().st_size
                        
                        if dry_run:
                            self.logger.info(f"[DRY RUN] Удалить: {file_path} (возраст: {age_days} дней, размер: {file_size} байт)")
                        else:
                            try:
                                file_path.unlink()
                                deleted_count += 1
                                size_freed += file_size
                                self.logger.info(f"Удален: {file_path} (возраст: {age_days} дней, размер: {file_size} байт)")
                            except Exception as e:
                                self.logger.error(f"Ошибка удаления {file_path}: {e}")
                                errors += 1
                    else:
                        self.logger.debug(f"Оставить: {file_path} (возраст: {age_days} дней)")
        
        except Exception as e:
            self.logger.error(f"Ошибка при обработке директории {directory}: {e}")
            errors += 1
        
        return {
            "deleted": deleted_count,
            "size_freed": size_freed,
            "errors": errors
        }
    
    def cleanup_backups(self, max_age_days: int = 30, dry_run: bool = False):
        """Очистка бэкапов"""
        self.logger.info(f"Очистка бэкапов старше {max_age_days} дней...")
        
        results = {}
        
        # Очистка бэкапов базы данных
        db_backups = self.backups_dir / "database"
        results["database"] = self.cleanup_directory(
            db_backups, max_age_days, "*.db", dry_run
        )
        
        # Очистка бэкапов конфигурации
        config_backups = self.backups_dir / "config"
        results["config"] = self.cleanup_directory(
            config_backups, max_age_days, "*.json", dry_run
        )
        
        # Очистка бэкапов аудио (если есть)
        audio_backups = self.backups_dir / "audio"
        results["audio"] = self.cleanup_directory(
            audio_backups, max_age_days, "*", dry_run
        )
        
        return results
    
    def cleanup_logs(self, max_age_days: int = 90, dry_run: bool = False):
        """Очистка старых логов"""
        self.logger.info(f"Очистка логов старше {max_age_days} дней...")
        
        results = {}
        
        # Очистка логов приложения
        app_logs = self.logs_dir / "app"
        results["app"] = self.cleanup_directory(
            app_logs, max_age_days, "*.log*", dry_run
        )
        
        # Очистка логов ошибок
        error_logs = self.logs_dir / "errors"
        results["errors"] = self.cleanup_directory(
            error_logs, max_age_days, "*.log*", dry_run
        )
        
        # Очистка логов доступа
        access_logs = self.logs_dir / "access"
        results["access"] = self.cleanup_directory(
            access_logs, max_age_days, "*.log*", dry_run
        )
        
        # Очистка логов аудита
        audit_logs = self.logs_dir / "audit"
        results["audit"] = self.cleanup_directory(
            audit_logs, max_age_days, "*.log*", dry_run
        )
        
        return results
    
    def get_directory_size(self, directory: Path) -> int:
        """Получить размер директории в байтах"""
        total_size = 0
        try:
            for file_path in directory.rglob("*"):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
        except Exception as e:
            self.logger.error(f"Ошибка при подсчете размера {directory}: {e}")
        return total_size
    
    def format_size(self, size_bytes: int) -> str:
        """Форматирование размера в читаемый вид"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"
    
    def run_cleanup(self, backup_days: int = 30, log_days: int = 90, 
                   dry_run: bool = False, show_stats: bool = True):
        """Запуск полной очистки"""
        self.logger.info("=" * 50)
        self.logger.info("ЗАПУСК ОЧИСТКИ СИСТЕМЫ")
        self.logger.info("=" * 50)
        
        if dry_run:
            self.logger.info("РЕЖИМ ТЕСТИРОВАНИЯ - файлы не будут удалены")
        
        # Показываем статистику до очистки
        if show_stats:
            self.logger.info("\nСтатистика ДО очистки:")
            self.logger.info(f"Размер бэкапов: {self.format_size(self.get_directory_size(self.backups_dir))}")
            self.logger.info(f"Размер логов: {self.format_size(self.get_directory_size(self.logs_dir))}")
        
        # Очистка бэкапов
        backup_results = self.cleanup_backups(backup_days, dry_run)
        
        # Очистка логов
        log_results = self.cleanup_logs(log_days, dry_run)
        
        # Подсчет результатов
        total_deleted = 0
        total_size_freed = 0
        total_errors = 0
        
        for category, result in {**backup_results, **log_results}.items():
            total_deleted += result["deleted"]
            total_size_freed += result["size_freed"]
            total_errors += result["errors"]
        
        # Показываем статистику после очистки
        if show_stats:
            self.logger.info("\nСтатистика ПОСЛЕ очистки:")
            self.logger.info(f"Размер бэкапов: {self.format_size(self.get_directory_size(self.backups_dir))}")
            self.logger.info(f"Размер логов: {self.format_size(self.get_directory_size(self.logs_dir))}")
        
        # Итоговый отчет
        self.logger.info("\n" + "=" * 50)
        self.logger.info("ИТОГОВЫЙ ОТЧЕТ")
        self.logger.info("=" * 50)
        self.logger.info(f"Удалено файлов: {total_deleted}")
        self.logger.info(f"Освобождено места: {self.format_size(total_size_freed)}")
        self.logger.info(f"Ошибок: {total_errors}")
        
        if not dry_run and total_deleted > 0:
            self.logger.info("Очистка завершена успешно!")
        elif dry_run:
            self.logger.info("Тестирование завершено. Для реальной очистки запустите без --dry-run")
        else:
            self.logger.info("Нет файлов для удаления")

def main():
    parser = argparse.ArgumentParser(description="Очистка старых бэкапов и логов")
    parser.add_argument("--backup-days", type=int, default=30, 
                       help="Удалять бэкапы старше N дней (по умолчанию: 30)")
    parser.add_argument("--log-days", type=int, default=90,
                       help="Удалять логи старше N дней (по умолчанию: 90)")
    parser.add_argument("--dry-run", action="store_true",
                       help="Режим тестирования (не удалять файлы)")
    parser.add_argument("--no-stats", action="store_true",
                       help="Не показывать статистику размеров")
    parser.add_argument("--service", default="bot_service",
                       help="Имя сервиса для логирования")
    
    args = parser.parse_args()
    
    # Создаем экземпляр очистки
    cleanup = BackupCleanup(args.service)
    
    # Запускаем очистку
    cleanup.run_cleanup(
        backup_days=args.backup_days,
        log_days=args.log_days,
        dry_run=args.dry_run,
        show_stats=not args.no_stats
    )

if __name__ == "__main__":
    main()
