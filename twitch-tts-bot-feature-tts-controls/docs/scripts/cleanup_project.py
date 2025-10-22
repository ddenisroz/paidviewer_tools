#!/usr/bin/env python3
"""
🧹 Автоматическая очистка проекта от мусора
Удаляет временные файлы, старые логи и бэкапы
"""

import os
import sys
import shutil
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Tuple

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ProjectCleaner:
    """Класс для автоматической очистки проекта"""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.dry_run = False
        self.stats = {
            'files_deleted': 0,
            'dirs_deleted': 0,
            'space_freed': 0
        }
    
    def clean_python_cache(self):
        """Очистка Python кэшей"""
        logger.info("🐍 Очистка Python кэшей...")
        
        patterns = ['__pycache__', '*.pyc', '*.pyo', '*.pyd']
        
        for pattern in patterns:
            if '*' in pattern:
                # Это файлы с расширением
                for file_path in self.project_root.rglob(pattern):
                    self._delete_file(file_path)
            else:
                # Это директории
                for dir_path in self.project_root.rglob(pattern):
                    if dir_path.is_dir():
                        self._delete_directory(dir_path)
    
    def clean_node_cache(self):
        """Очистка Node.js кэшей"""
        logger.info("📦 Очистка Node.js кэшей...")
        
        node_cache_paths = [
            self.project_root / 'frontend' / 'node_modules' / '.cache',
            self.project_root / 'node_modules' / '.cache',
            self.project_root / 'frontend' / '.next',
            self.project_root / 'frontend' / 'dist'
        ]
        
        for cache_path in node_cache_paths:
            if cache_path.exists():
                self._delete_directory(cache_path)
    
    def clean_temp_audio(self):
        """Очистка временных аудио файлов"""
        logger.info("🎵 Очистка временных аудио файлов...")
        
        temp_audio_paths = [
            self.project_root / 'tts_service' / 'audio' / 'temp',
            self.project_root / 'tts_service' / 'audio' / 'cache',
            self.project_root / 'tts_service' / 'audio' / 'test'
        ]
        
        cutoff_time = datetime.now() - timedelta(days=1)
        
        for temp_path in temp_audio_paths:
            if not temp_path.exists():
                continue
            
            for file_path in temp_path.glob('*'):
                if file_path.is_file():
                    # Удаляем файлы старше 1 дня
                    if datetime.fromtimestamp(file_path.stat().st_mtime) < cutoff_time:
                        self._delete_file(file_path)
    
    def clean_old_logs(self, days_to_keep: int = 30):
        """Очистка старых логов"""
        logger.info(f"📋 Очистка логов старше {days_to_keep} дней...")
        
        log_dirs = [
            self.project_root / 'bot_service' / 'logs',
            self.project_root / 'tts_service' / 'logs'
        ]
        
        cutoff_time = datetime.now() - timedelta(days=days_to_keep)
        
        for log_dir in log_dirs:
            if not log_dir.exists():
                continue
            
            for file_path in log_dir.rglob('*.log'):
                if file_path.is_file():
                    # Сохраняем error логи
                    if 'error' in file_path.name.lower():
                        continue
                    
                    if datetime.fromtimestamp(file_path.stat().st_mtime) < cutoff_time:
                        self._delete_file(file_path)
    
    def clean_old_backups(self, days_to_keep: int = 7, keep_count: int = 5):
        """Очистка старых бэкапов"""
        logger.info(f"💾 Очистка бэкапов старше {days_to_keep} дней (оставляем последние {keep_count})...")
        
        backup_dirs = [
            self.project_root / 'bot_service' / 'backups',
            self.project_root / 'tts_service' / 'backups'
        ]
        
        cutoff_time = datetime.now() - timedelta(days=days_to_keep)
        
        for backup_dir in backup_dirs:
            if not backup_dir.exists():
                continue
            
            # Обрабатываем каждую поддиректорию (database, config, logs, etc.)
            for subdir in backup_dir.iterdir():
                if not subdir.is_dir():
                    continue
                
                # Получаем все файлы бэкапов, сортированные по времени
                backup_files = sorted(
                    [f for f in subdir.glob('*') if f.is_file()],
                    key=lambda x: x.stat().st_mtime,
                    reverse=True
                )
                
                # Оставляем последние keep_count файлов
                files_to_keep = backup_files[:keep_count]
                
                for file_path in backup_files:
                    # Оставляем последние файлы
                    if file_path in files_to_keep:
                        continue
                    
                    # Удаляем старые файлы
                    if datetime.fromtimestamp(file_path.stat().st_mtime) < cutoff_time:
                        self._delete_file(file_path)
    
    def clean_test_files(self):
        """Очистка временных тестовых файлов"""
        logger.info("🧪 Очистка временных тестовых файлов...")
        
        test_patterns = [
            'test_*.py',
            '*_test.py',
            'check_*.py',
            'temp_*.py',
            'tmp_*.py'
        ]
        
        # Исключаем директории с настоящими тестами
        exclude_dirs = {'tests', 'test'}
        
        for pattern in test_patterns:
            for file_path in self.project_root.rglob(pattern):
                # Пропускаем файлы в директориях tests
                if any(part in exclude_dirs for part in file_path.parts):
                    continue
                
                if file_path.is_file():
                    # Проверяем, что это действительно временный файл
                    # (можно добавить дополнительные проверки)
                    self._delete_file(file_path)
    
    def clean_os_files(self):
        """Очистка OS-специфичных файлов"""
        logger.info("💻 Очистка OS файлов...")
        
        os_files = ['.DS_Store', 'Thumbs.db', 'desktop.ini']
        
        for os_file in os_files:
            for file_path in self.project_root.rglob(os_file):
                if file_path.is_file():
                    self._delete_file(file_path)
    
    def clean_monitoring_files(self):
        """Очистка старых файлов мониторинга"""
        logger.info("📊 Очистка старых файлов мониторинга...")
        
        monitoring_dirs = [
            self.project_root / 'bot_service' / 'logs' / 'monitoring',
            self.project_root / 'tts_service' / 'logs' / 'monitoring'
        ]
        
        cutoff_time = datetime.now() - timedelta(days=7)
        
        for monitoring_dir in monitoring_dirs:
            if not monitoring_dir.exists():
                continue
            
            for file_path in monitoring_dir.glob('*.json'):
                if datetime.fromtimestamp(file_path.stat().st_mtime) < cutoff_time:
                    self._delete_file(file_path)
    
    def _delete_file(self, file_path: Path):
        """Удалить файл"""
        try:
            if self.dry_run:
                logger.info(f"[DRY RUN] Would delete file: {file_path}")
                return
            
            file_size = file_path.stat().st_size
            file_path.unlink()
            
            self.stats['files_deleted'] += 1
            self.stats['space_freed'] += file_size
            
            logger.debug(f"Deleted file: {file_path} ({file_size} bytes)")
            
        except Exception as e:
            logger.error(f"Error deleting file {file_path}: {e}")
    
    def _delete_directory(self, dir_path: Path):
        """Удалить директорию"""
        try:
            if self.dry_run:
                logger.info(f"[DRY RUN] Would delete directory: {dir_path}")
                return
            
            # Подсчитываем размер директории
            dir_size = sum(f.stat().st_size for f in dir_path.rglob('*') if f.is_file())
            
            shutil.rmtree(dir_path)
            
            self.stats['dirs_deleted'] += 1
            self.stats['space_freed'] += dir_size
            
            logger.debug(f"Deleted directory: {dir_path} ({dir_size} bytes)")
            
        except Exception as e:
            logger.error(f"Error deleting directory {dir_path}: {e}")
    
    def print_stats(self):
        """Вывести статистику очистки"""
        logger.info("\n" + "="*60)
        logger.info("📊 Статистика очистки:")
        logger.info(f"  Удалено файлов: {self.stats['files_deleted']}")
        logger.info(f"  Удалено директорий: {self.stats['dirs_deleted']}")
        logger.info(f"  Освобождено места: {self._format_size(self.stats['space_freed'])}")
        logger.info("="*60)
    
    @staticmethod
    def _format_size(size: int) -> str:
        """Форматирование размера в читаемый вид"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.2f} {unit}"
            size /= 1024.0
        return f"{size:.2f} TB"
    
    def run_full_cleanup(self, dry_run: bool = False):
        """Запустить полную очистку проекта"""
        self.dry_run = dry_run
        
        if dry_run:
            logger.info("🔍 Режим DRY RUN - файлы не будут удалены\n")
        else:
            logger.info("🧹 Начинаю очистку проекта...\n")
        
        # Запускаем все методы очистки
        self.clean_python_cache()
        self.clean_node_cache()
        self.clean_temp_audio()
        self.clean_old_logs(days_to_keep=30)
        self.clean_old_backups(days_to_keep=7, keep_count=5)
        self.clean_test_files()
        self.clean_os_files()
        self.clean_monitoring_files()
        
        self.print_stats()
        
        if dry_run:
            logger.info("\n💡 Запустите без флага --dry-run чтобы удалить файлы")
        else:
            logger.info("\n✅ Очистка завершена!")


def main():
    """Главная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Автоматическая очистка проекта')
    parser.add_argument('--dry-run', action='store_true', help='Режим просмотра без удаления')
    parser.add_argument('--logs-days', type=int, default=30, help='Дни хранения логов (по умолчанию: 30)')
    parser.add_argument('--backup-days', type=int, default=7, help='Дни хранения бэкапов (по умолчанию: 7)')
    parser.add_argument('--backup-keep', type=int, default=5, help='Количество последних бэкапов (по умолчанию: 5)')
    
    args = parser.parse_args()
    
    # Определяем корень проекта
    project_root = Path(__file__).parent.resolve()
    
    cleaner = ProjectCleaner(project_root)
    cleaner.run_full_cleanup(dry_run=args.dry_run)


if __name__ == '__main__':
    main()

