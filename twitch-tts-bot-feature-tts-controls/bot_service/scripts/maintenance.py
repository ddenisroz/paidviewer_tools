#!/usr/bin/env python3
"""
Основной скрипт обслуживания bot_service
Объединяет все задачи по очистке, бэкапам и мониторингу
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime
import logging

# Добавляем корневую папку в путь для импорта модулей
sys.path.append(str(Path(__file__).parent.parent))

from logging_config import LoggingConfig
from cleanup_backups import BackupCleanup
from backup_manager import BackupManager
from disk_monitor import DiskMonitor

class MaintenanceManager:
    def __init__(self, service_name: str = "bot_service"):
        self.service_name = service_name
        self.logger = LoggingConfig(service_name).setup_logging("INFO")
        
        # Инициализируем компоненты
        self.cleanup = BackupCleanup(service_name)
        self.backup_manager = BackupManager(service_name)
        self.disk_monitor = DiskMonitor(service_name)
    
    def daily_maintenance(self, create_backups: bool = True, 
                         cleanup_old: bool = True,
                         max_backup_age: int = 30,
                         max_log_age: int = 90):
        """Ежедневное обслуживание"""
        self.logger.info("=" * 60)
        self.logger.info("ЕЖЕДНЕВНОЕ ОБСЛУЖИВАНИЕ")
        self.logger.info("=" * 60)
        
        # 1. Проверка места на диске
        self.logger.info("1. Проверка места на диске...")
        has_alerts = self.disk_monitor.check_and_alert(
            warning_threshold=80.0,
            critical_threshold=90.0,
            service_max_size=3 * 1024**3  # 3 GB
        )
        
        if has_alerts:
            self.logger.warning("Обнаружены проблемы с местом на диске!")
        
        # 2. Создание бэкапов
        if create_backups:
            self.logger.info("2. Создание бэкапов...")
            try:
                created_backups = self.backup_manager.run_backup(
                    backup_types=["database", "config"],
                    compress=True,
                    cleanup_old=False,  # Очистку делаем отдельно
                    max_age_days=max_backup_age
                )
                self.logger.info(f"Создано бэкапов: {len(created_backups)}")
            except Exception as e:
                self.logger.error(f"Ошибка создания бэкапов: {e}")
        
        # 3. Очистка старых файлов
        if cleanup_old:
            self.logger.info("3. Очистка старых файлов...")
            try:
                # Очистка бэкапов
                backup_results = self.cleanup.cleanup_backups(max_backup_age)
                total_backup_freed = sum(r["size_freed"] for r in backup_results.values())
                
                # Очистка логов
                log_results = self.cleanup.cleanup_logs(max_log_age)
                total_log_freed = sum(r["size_freed"] for r in log_results.values())
                
                total_freed = total_backup_freed + total_log_freed
                self.logger.info(f"Освобождено места: {self.cleanup.format_size(total_freed)}")
                
            except Exception as e:
                self.logger.error(f"Ошибка очистки: {e}")
        
        # 4. Финальная проверка
        self.logger.info("4. Финальная проверка...")
        final_alerts = self.disk_monitor.check_and_alert(
            warning_threshold=85.0,
            critical_threshold=95.0,
            service_max_size=3 * 1024**3
        )
        
        if not final_alerts:
            self.logger.info("Обслуживание завершено успешно!")
        else:
            self.logger.warning("Обслуживание завершено с предупреждениями")
        
        return not final_alerts
    
    def weekly_maintenance(self):
        """Еженедельное обслуживание"""
        self.logger.info("=" * 60)
        self.logger.info("ЕЖЕНЕДЕЛЬНОЕ ОБСЛУЖИВАНИЕ")
        self.logger.info("=" * 60)
        
        # 1. Полный бэкап
        self.logger.info("1. Создание полного бэкапа...")
        try:
            full_backup = self.backup_manager.create_full_backup(compress=True)
            if full_backup:
                self.logger.info(f"Полный бэкап создан: {full_backup}")
            else:
                self.logger.error("Не удалось создать полный бэкап")
        except Exception as e:
            self.logger.error(f"Ошибка создания полного бэкапа: {e}")
        
        # 2. Агрессивная очистка
        self.logger.info("2. Агрессивная очистка...")
        try:
            # Очищаем бэкапы старше 14 дней
            backup_results = self.cleanup.cleanup_backups(14)
            # Очищаем логи старше 30 дней
            log_results = self.cleanup.cleanup_logs(30)
            
            total_freed = sum(r["size_freed"] for r in {**backup_results, **log_results}.values())
            self.logger.info(f"Освобождено места: {self.cleanup.format_size(total_freed)}")
            
        except Exception as e:
            self.logger.error(f"Ошибка агрессивной очистки: {e}")
        
        # 3. Генерация отчета
        self.logger.info("3. Генерация отчета...")
        try:
            report = self.disk_monitor.generate_report(include_large_files=True)
            self.logger.info("Отчет сгенерирован")
            
            # Сохраняем отчет в файл
            report_file = Path(f"maintenance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")
            with open(report_file, 'w', encoding='utf-8') as f:
                f.write(report)
            self.logger.info(f"Отчет сохранен: {report_file}")
            
        except Exception as e:
            self.logger.error(f"Ошибка генерации отчета: {e}")
    
    def emergency_cleanup(self):
        """Экстренная очистка при нехватке места"""
        self.logger.warning("=" * 60)
        self.logger.warning("ЭКСТРЕННАЯ ОЧИСТКА")
        self.logger.warning("=" * 60)
        
        # 1. Удаляем старые бэкапы (старше 7 дней)
        self.logger.warning("1. Удаление старых бэкапов...")
        backup_results = self.cleanup.cleanup_backups(7)
        backup_freed = sum(r["size_freed"] for r in backup_results.values())
        
        # 2. Удаляем старые логи (старше 14 дней)
        self.logger.warning("2. Удаление старых логов...")
        log_results = self.cleanup.cleanup_logs(14)
        log_freed = sum(r["size_freed"] for r in log_results.values())
        
        total_freed = backup_freed + log_freed
        self.logger.warning(f"Экстренно освобождено: {self.cleanup.format_size(total_freed)}")
        
        # 3. Проверяем результат
        has_alerts = self.disk_monitor.check_and_alert(
            warning_threshold=90.0,
            critical_threshold=95.0,
            service_max_size=3 * 1024**3
        )
        
        if has_alerts:
            self.logger.error("Экстренная очистка не помогла! Требуется ручное вмешательство!")
            return False
        else:
            self.logger.info("Экстренная очистка успешна!")
            return True
    
    def status_check(self):
        """Проверка статуса системы"""
        self.logger.info("=" * 60)
        self.logger.info("ПРОВЕРКА СТАТУСА СИСТЕМЫ")
        self.logger.info("=" * 60)
        
        # Генерируем отчет
        report = self.disk_monitor.generate_report(include_large_files=True)
        print(report)
        
        # Проверяем на проблемы
        has_alerts = self.disk_monitor.check_and_alert(
            warning_threshold=80.0,
            critical_threshold=90.0,
            service_max_size=3 * 1024**3
        )
        
        return not has_alerts

def main():
    parser = argparse.ArgumentParser(description="Обслуживание bot_service")
    parser.add_argument("action", choices=["daily", "weekly", "emergency", "status"],
                       help="Тип обслуживания")
    parser.add_argument("--no-backup", action="store_true",
                       help="Не создавать бэкапы (только для daily)")
    parser.add_argument("--no-cleanup", action="store_true",
                       help="Не очищать старые файлы (только для daily)")
    parser.add_argument("--backup-age", type=int, default=30,
                       help="Максимальный возраст бэкапов в днях")
    parser.add_argument("--log-age", type=int, default=90,
                       help="Максимальный возраст логов в днях")
    parser.add_argument("--service", default="bot_service",
                       help="Имя сервиса")
    
    args = parser.parse_args()
    
    # Создаем менеджер обслуживания
    maintenance = MaintenanceManager(args.service)
    
    success = False
    
    if args.action == "daily":
        success = maintenance.daily_maintenance(
            create_backups=not args.no_backup,
            cleanup_old=not args.no_cleanup,
            max_backup_age=args.backup_age,
            max_log_age=args.log_age
        )
    elif args.action == "weekly":
        maintenance.weekly_maintenance()
        success = True
    elif args.action == "emergency":
        success = maintenance.emergency_cleanup()
    elif args.action == "status":
        success = maintenance.status_check()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
