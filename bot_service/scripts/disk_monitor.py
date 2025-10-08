#!/usr/bin/env python3
"""
Мониторинг размера диска для bot_service
Отслеживает использование места и предупреждает о превышении лимитов
"""

import os
import sys
import shutil
import argparse
from pathlib import Path
from datetime import datetime
import logging

# Добавляем корневую папку в путь для импорта модулей
sys.path.append(str(Path(__file__).parent.parent))

from logging_config import LoggingConfig

class DiskMonitor:
    def __init__(self, service_name: str = "bot_service"):
        self.service_name = service_name
        self.base_dir = Path(__file__).parent.parent
        self.logger = LoggingConfig(service_name).setup_logging("INFO")
        
        # Важные директории для мониторинга
        self.monitored_dirs = {
            "logs": self.base_dir / "logs",
            "backups": self.base_dir / "backups",
            "database": self.base_dir / "bot_service.db",
            "data": self.base_dir / "core" / "data",
            "audio": self.base_dir / "audio"
        }
    
    def get_directory_size(self, path: Path) -> int:
        """Получить размер директории или файла в байтах"""
        if not path.exists():
            return 0
        
        if path.is_file():
            return path.stat().st_size
        
        total_size = 0
        try:
            for file_path in path.rglob("*"):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
        except (PermissionError, OSError) as e:
            self.logger.warning(f"Не удалось получить размер {path}: {e}")
        
        return total_size
    
    def format_size(self, size_bytes: int) -> str:
        """Форматирование размера в читаемый вид"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} PB"
    
    def get_disk_usage(self, path: Path = None) -> dict:
        """Получить информацию об использовании диска"""
        if path is None:
            path = self.base_dir
        
        # Получаем информацию о диске
        total, used, free = shutil.disk_usage(path)
        
        return {
            "total": total,
            "used": used,
            "free": free,
            "used_percent": (used / total) * 100,
            "free_percent": (free / total) * 100
        }
    
    def get_service_usage(self) -> dict:
        """Получить использование места сервисом"""
        usage = {}
        total_service_size = 0
        
        for name, path in self.monitored_dirs.items():
            size = self.get_directory_size(path)
            usage[name] = {
                "path": str(path),
                "size": size,
                "size_formatted": self.format_size(size),
                "exists": path.exists()
            }
            total_service_size += size
        
        usage["total"] = {
            "size": total_service_size,
            "size_formatted": self.format_size(total_service_size)
        }
        
        return usage
    
    def check_disk_space(self, warning_threshold: float = 80.0, 
                        critical_threshold: float = 90.0) -> dict:
        """Проверить свободное место на диске"""
        disk_usage = self.get_disk_usage()
        
        status = "OK"
        if disk_usage["used_percent"] >= critical_threshold:
            status = "CRITICAL"
        elif disk_usage["used_percent"] >= warning_threshold:
            status = "WARNING"
        
        return {
            "status": status,
            "disk_usage": disk_usage,
            "thresholds": {
                "warning": warning_threshold,
                "critical": critical_threshold
            }
        }
    
    def get_largest_files(self, directory: Path, count: int = 10) -> list:
        """Получить список самых больших файлов в директории"""
        if not directory.exists():
            return []
        
        files = []
        try:
            for file_path in directory.rglob("*"):
                if file_path.is_file():
                    files.append({
                        "path": str(file_path),
                        "size": file_path.stat().st_size,
                        "modified": datetime.fromtimestamp(file_path.stat().st_mtime)
                    })
        except (PermissionError, OSError) as e:
            self.logger.warning(f"Ошибка сканирования {directory}: {e}")
            return []
        
        # Сортируем по размеру и возвращаем топ N
        files.sort(key=lambda x: x["size"], reverse=True)
        return files[:count]
    
    def generate_report(self, include_large_files: bool = True) -> str:
        """Сгенерировать отчет об использовании места"""
        report = []
        report.append("=" * 60)
        report.append("ОТЧЕТ ОБ ИСПОЛЬЗОВАНИИ МЕСТА НА ДИСКЕ")
        report.append("=" * 60)
        report.append(f"Время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Информация о диске
        disk_check = self.check_disk_space()
        disk_usage = disk_check["disk_usage"]
        
        report.append("ИСПОЛЬЗОВАНИЕ ДИСКА:")
        report.append(f"  Общий размер: {self.format_size(disk_usage['total'])}")
        report.append(f"  Использовано: {self.format_size(disk_usage['used'])} ({disk_usage['used_percent']:.1f}%)")
        report.append(f"  Свободно: {self.format_size(disk_usage['free'])} ({disk_usage['free_percent']:.1f}%)")
        report.append(f"  Статус: {disk_check['status']}")
        report.append("")
        
        # Использование сервисом
        service_usage = self.get_service_usage()
        report.append("ИСПОЛЬЗОВАНИЕ СЕРВИСОМ:")
        for name, info in service_usage.items():
            if name != "total":
                status = "✓" if info["exists"] else "✗"
                report.append(f"  {status} {name}: {info['size_formatted']} ({info['path']})")
        
        report.append(f"  ИТОГО: {service_usage['total']['size_formatted']}")
        report.append("")
        
        # Самые большие файлы
        if include_large_files:
            report.append("САМЫЕ БОЛЬШИЕ ФАЙЛЫ:")
            for name, path in self.monitored_dirs.items():
                if path.exists():
                    large_files = self.get_largest_files(path, 5)
                    if large_files:
                        report.append(f"  {name.upper()}:")
                        for file_info in large_files:
                            size_str = self.format_size(file_info["size"])
                            mod_time = file_info["modified"].strftime("%Y-%m-%d %H:%M")
                            file_name = Path(file_info["path"]).name
                            report.append(f"    {file_name} - {size_str} - {mod_time}")
        
        report.append("")
        report.append("=" * 60)
        
        return "\n".join(report)
    
    def check_and_alert(self, warning_threshold: float = 80.0, 
                       critical_threshold: float = 90.0,
                       service_max_size: int = None) -> bool:
        """Проверить место и выдать предупреждения"""
        alerts = []
        
        # Проверка общего места на диске
        disk_check = self.check_disk_space(warning_threshold, critical_threshold)
        if disk_check["status"] != "OK":
            alerts.append(f"Диск: {disk_check['status']} - {disk_check['disk_usage']['used_percent']:.1f}% использовано")
        
        # Проверка размера сервиса
        if service_max_size:
            service_usage = self.get_service_usage()
            service_size = service_usage["total"]["size"]
            service_size_gb = service_size / (1024**3)
            max_size_gb = service_max_size / (1024**3)
            
            if service_size > service_max_size:
                alerts.append(f"Сервис: ПРЕВЫШЕН ЛИМИТ - {service_size_gb:.1f}GB / {max_size_gb:.1f}GB")
            elif service_size > service_max_size * 0.8:
                alerts.append(f"Сервис: ПРИБЛИЖАЕТСЯ К ЛИМИТУ - {service_size_gb:.1f}GB / {max_size_gb:.1f}GB")
        
        # Вывод предупреждений
        if alerts:
            self.logger.warning("ПРЕДУПРЕЖДЕНИЯ О МЕСТЕ НА ДИСКЕ:")
            for alert in alerts:
                self.logger.warning(f"  - {alert}")
            return True
        else:
            self.logger.info("Использование места в норме")
            return False
    
    def run_monitoring(self, warning_threshold: float = 80.0,
                      critical_threshold: float = 90.0,
                      service_max_gb: float = 3.0,
                      generate_report: bool = True,
                      alert_only: bool = False):
        """Запуск мониторинга"""
        service_max_bytes = int(service_max_gb * 1024**3)
        
        if generate_report and not alert_only:
            report = self.generate_report()
            print(report)
            self.logger.info("Отчет сгенерирован")
        
        # Проверка и предупреждения
        has_alerts = self.check_and_alert(
            warning_threshold, 
            critical_threshold, 
            service_max_bytes
        )
        
        return has_alerts

def main():
    parser = argparse.ArgumentParser(description="Мониторинг размера диска bot_service")
    parser.add_argument("--warning", type=float, default=80.0,
                       help="Порог предупреждения для диска (процент)")
    parser.add_argument("--critical", type=float, default=90.0,
                       help="Критический порог для диска (процент)")
    parser.add_argument("--service-limit", type=float, default=3.0,
                       help="Максимальный размер сервиса в GB")
    parser.add_argument("--no-report", action="store_true",
                       help="Не генерировать подробный отчет")
    parser.add_argument("--alert-only", action="store_true",
                       help="Только проверить и выдать предупреждения")
    parser.add_argument("--service", default="bot_service",
                       help="Имя сервиса")
    
    args = parser.parse_args()
    
    # Создаем монитор
    monitor = DiskMonitor(args.service)
    
    # Запускаем мониторинг
    has_alerts = monitor.run_monitoring(
        warning_threshold=args.warning,
        critical_threshold=args.critical,
        service_max_gb=args.service_limit,
        generate_report=not args.no_report,
        alert_only=args.alert_only
    )
    
    # Возвращаем код выхода
    sys.exit(1 if has_alerts else 0)

if __name__ == "__main__":
    main()
