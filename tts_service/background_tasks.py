# tts_service/background_tasks.py
import asyncio
import logging
import time
from pathlib import Path
from tts_service.file_manager import file_manager

logger = logging.getLogger(__name__)

class BackgroundTaskManager:
    def __init__(self):
        self.tasks = []
        self.running = False

    async def start(self):
        """Запуск фоновых задач"""
        if self.running:
            return
        
        self.running = True
        self.tasks = [
            asyncio.create_task(self.cleanup_cache_periodically()),
            asyncio.create_task(self.cleanup_old_files_periodically())
        ]
        logger.info("Background tasks started")

    async def stop(self):
        """Остановка фоновых задач"""
        if not self.running:
            return
        
        self.running = False
        
        for task in self.tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        self.tasks = []
        logger.info("Background tasks stopped")

    async def cleanup_cache_periodically(self):
        """Периодически удаляет старые .wav файлы из папок с разными временами хранения."""
        while self.running:
            try:
                # Очистка временных файлов (1 час)
                file_manager.cleanup_old_files(max_age_hours=1)
                
                # Очистка тестовых файлов (24 часа)
                file_manager.cleanup_old_files(max_age_hours=24)
                
                # Ждем 30 минут до следующей очистки
                await asyncio.sleep(1800)
                
            except Exception as e:
                logger.error(f"Error in cleanup_cache_periodically: {e}")
                await asyncio.sleep(300)  # Ждем 5 минут при ошибке

    async def cleanup_old_files_periodically(self):
        """Периодическая очистка старых файлов"""
        while self.running:
            try:
                # Очистка файлов старше 7 дней
                file_manager.cleanup_old_files(max_age_hours=168)
                
                # Ждем 6 часов до следующей очистки
                await asyncio.sleep(21600)
                
            except Exception as e:
                logger.error(f"Error in cleanup_old_files_periodically: {e}")
                await asyncio.sleep(3600)  # Ждем 1 час при ошибке

    async def cleanup_temp_file_delayed(self, file_path: Path, delay_seconds: int = 300):
        """Удалить временный файл через указанное количество секунд"""
        await asyncio.sleep(delay_seconds)
        file_manager.cleanup_temp_file(file_path)

    async def cleanup_test_file_delayed(self, file_path: Path, delay_seconds: int = 300):
        """Удалить тестовый файл через указанное количество секунд"""
        await asyncio.sleep(delay_seconds)
        file_manager.cleanup_temp_file(file_path)

    async def cleanup_production_file_delayed(self, file_path: Path, delay_seconds: int = 300):
        """Удалить производственный файл через указанное количество секунд (5 минут)"""
        await asyncio.sleep(delay_seconds)
        file_manager.cleanup_temp_file(file_path)

# Глобальный экземпляр
background_task_manager = BackgroundTaskManager()
