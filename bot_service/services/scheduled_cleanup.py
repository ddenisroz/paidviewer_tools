# services/scheduled_cleanup.py
import logging
import schedule
import time
import threading
from datetime import datetime
from sqlalchemy.orm import Session

from core.database import get_db
from services.database_cleanup_service import DatabaseCleanupService
from services.tts_manager import get_tts_manager

logger = logging.getLogger(__name__)

class ScheduledCleanupService:
    """Сервис для автоматической очистки базы данных по расписанию"""
    
    def __init__(self):
        self.running = False
        self.cleanup_thread = None
        
    def start_scheduled_cleanup(self):
        """Запускает автоматическую очистку по расписанию"""
        if self.running:
            logger.warning("Scheduled cleanup is already running")
            return
        
        self.running = True
        
        # Настраиваем расписание
        schedule.every().day.at("02:00").do(self._daily_cleanup)  # Каждый день в 2:00
        schedule.every().sunday.at("03:00").do(self._weekly_cleanup)  # Каждое воскресенье в 3:00
        
        # Запускаем в отдельном потоке
        self.cleanup_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.cleanup_thread.start()
        
        logger.info("Scheduled cleanup service started")
    
    def stop_scheduled_cleanup(self):
        """Останавливает автоматическую очистку"""
        self.running = False
        schedule.clear()
        logger.info("Scheduled cleanup service stopped")
    
    def _run_scheduler(self):
        """Запускает планировщик в отдельном потоке"""
        while self.running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Проверяем каждую минуту
            except Exception as e:
                logger.error(f"Error in scheduled cleanup: {e}")
                time.sleep(300)  # При ошибке ждем 5 минут
    
    def _daily_cleanup(self):
        """Ежедневная очистка базы данных"""
        try:
            logger.info("Starting daily database cleanup...")
            
            db = next(get_db())
            cleanup_service = DatabaseCleanupService(db)
            
            # Получаем статистику до очистки
            stats_before = cleanup_service.get_database_stats()
            
            # Выполняем очистку
            cleanup_stats = cleanup_service.cleanup_old_data()
            
            # Синхронизируем счетчики сообщений
            sync_stats = cleanup_service.sync_user_message_counts()
            
            # Очищаем старые WAV файлы базовой TTS
            try:
                tts_manager = get_tts_manager()
                tts_manager.cleanup_old_files()
                logger.info("TTS audio files cleanup completed")
            except Exception as e:
                logger.error(f"Error cleaning TTS audio files: {e}")
            
            # Получаем статистику после очистки
            stats_after = cleanup_service.get_database_stats()
            
            logger.info(f"Daily cleanup completed:")
            logger.info(f"  Messages deleted: {cleanup_stats.get('messages_deleted', 0)}")
            logger.info(f"  Analyses deleted: {cleanup_stats.get('analyses_deleted', 0)}")
            logger.info(f"  Users synced: {sync_stats.get('users_updated', 0)}")
            logger.info(f"  Discrepancies fixed: {sync_stats.get('total_discrepancies', 0)}")
            logger.info(f"  Total messages before: {stats_before.get('total_chat_messages', 0)}")
            logger.info(f"  Total messages after: {stats_after.get('total_chat_messages', 0)}")
            logger.info(f"  Estimated DB size: {stats_after.get('estimated_db_size_mb', 0)} MB")
            
        except Exception as e:
            logger.error(f"Error in daily cleanup: {e}")
    
    def _weekly_cleanup(self):
        """Еженедельная глубокая очистка базы данных"""
        try:
            logger.info("Starting weekly deep database cleanup...")
            
            db = next(get_db())
            cleanup_service = DatabaseCleanupService(db)
            
            # Выполняем полную оптимизацию
            optimization_result = cleanup_service.optimize_database()
            
            # Очищаем старые WAV файлы базовой TTS (еженедельно)
            try:
                tts_manager = get_tts_manager()
                tts_manager.cleanup_old_files()
                logger.info("TTS audio files cleanup completed (weekly)")
            except Exception as e:
                logger.error(f"Error cleaning TTS audio files (weekly): {e}")
            
            logger.info(f"Weekly cleanup completed:")
            logger.info(f"  Optimization result: {optimization_result}")
            
        except Exception as e:
            logger.error(f"Error in weekly cleanup: {e}")
    
    def run_manual_cleanup(self) -> dict:
        """Запускает ручную очистку базы данных"""
        try:
            logger.info("Starting manual database cleanup...")
            
            db = next(get_db())
            cleanup_service = DatabaseCleanupService(db)
            
            # Получаем статистику до очистки
            stats_before = cleanup_service.get_database_stats()
            
            # Выполняем очистку
            cleanup_stats = cleanup_service.cleanup_old_data()
            
            # Получаем статистику после очистки
            stats_after = cleanup_service.get_database_stats()
            
            result = {
                "success": True,
                "stats_before": stats_before,
                "stats_after": stats_after,
                "cleanup_stats": cleanup_stats,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Manual cleanup completed: {cleanup_stats}")
            return result
            
        except Exception as e:
            logger.error(f"Error in manual cleanup: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

# Глобальный экземпляр сервиса
scheduled_cleanup_service = ScheduledCleanupService()
