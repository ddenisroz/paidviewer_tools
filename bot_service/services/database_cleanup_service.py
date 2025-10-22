# services/database_cleanup_service.py
import logging
from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from core.database import ChatMessage, PsychologyAnalysis, User
from core.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)

class DatabaseCleanupService:
    """Сервис для очистки старых данных и управления размером базы данных"""
    
    def __init__(self, db: Session):
        self.db = db
        
        # Настройки лимитов (только по лимитам, без очистки по возрасту)
        self.MAX_CHAT_MESSAGES_PER_USER = 3000  # Максимум сообщений на пользователя
        self.MAX_TOTAL_CHAT_MESSAGES = 100000  # Максимум сообщений в чате всего
        self.MAX_PSYCHOLOGY_ANALYSES = 0  # Анализы больше не хранятся в БД
        self.CHAT_MESSAGES_RETENTION_DAYS = 30  # Дни хранения сообщений
        self.PSYCHOLOGY_RETENTION_DAYS = 0  # Анализы не хранятся, установлен в 0
        # Убираем очистку по возрасту - только по лимитам!
        
    def get_database_stats(self) -> Dict[str, Any]:
        """Получает статистику базы данных"""
        try:
            stats = {}
            
            # Статистика сообщений
            total_messages = self.db.query(ChatMessage).count()
            stats['total_chat_messages'] = total_messages
            
            # Статистика по платформам
            twitch_messages = self.db.query(ChatMessage).filter(ChatMessage.platform == 'twitch').count()
            vk_messages = self.db.query(ChatMessage).filter(ChatMessage.platform == 'vk').count()
            stats['twitch_messages'] = twitch_messages
            stats['vk_messages'] = vk_messages
            
            # Анализы больше не хранятся в БД
            stats['total_psychology_analyses'] = 0
            
            # Статистика пользователей
            total_users = self.db.query(User).count()
            stats['total_users'] = total_users
            
            # Размер базы данных (приблизительно)
            stats['estimated_db_size_mb'] = self._estimate_database_size()
            
            # Старые записи
            old_messages = self.db.query(ChatMessage).filter(
                ChatMessage.timestamp < utcnow_naive() - timedelta(days=self.CHAT_MESSAGES_RETENTION_DAYS)
            ).count()
            stats['old_messages_to_cleanup'] = old_messages
            
            old_analyses = self.db.query(PsychologyAnalysis).filter(
                PsychologyAnalysis.analysis_date < utcnow_naive() - timedelta(days=self.PSYCHOLOGY_RETENTION_DAYS)
            ).count()
            stats['old_analyses_to_cleanup'] = old_analyses
            
            # Лимиты
            stats['max_messages_per_user'] = self.MAX_CHAT_MESSAGES_PER_USER
            stats['max_total_messages'] = self.MAX_TOTAL_CHAT_MESSAGES
            
            # Пользователи с превышением лимита
            from sqlalchemy import func
            users_over_limit = self.db.query(
                ChatMessage.user_id,
                func.count(ChatMessage.id).label('message_count')
            ).group_by(ChatMessage.user_id).having(
                func.count(ChatMessage.id) > self.MAX_CHAT_MESSAGES_PER_USER
            ).count()
            stats['users_over_message_limit'] = users_over_limit
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting database stats: {e}", exc_info=True)
            return {}
    
    def cleanup_old_data(self) -> Dict[str, int]:
        """Очищает данные ТОЛЬКО по лимитам (без очистки по возрасту)"""
        try:
            cleanup_stats = {
                'messages_deleted': 0,
                'users_cleaned': 0,
                'cleanup_reason': 'limit_based_only'
            }
            
            # Очистка избыточных сообщений (если превышен общий лимит)
            total_messages = self.db.query(ChatMessage).count()
            if total_messages > self.MAX_TOTAL_CHAT_MESSAGES:
                excess_count = total_messages - self.MAX_TOTAL_CHAT_MESSAGES
                oldest_messages = self.db.query(ChatMessage).order_by(ChatMessage.timestamp.asc()).limit(excess_count)
                oldest_messages.delete(synchronize_session=False)
                cleanup_stats['messages_deleted'] += excess_count
                logger.info(f"🗑️ Deleted {excess_count} excess messages to maintain total limit ({self.MAX_TOTAL_CHAT_MESSAGES})")
            
            # Очистка избыточных сообщений на пользователя (если превышен лимит на пользователя)
            user_cleanup_count = self._cleanup_user_message_limits()
            cleanup_stats['messages_deleted'] += user_cleanup_count
            
            if cleanup_stats['messages_deleted'] == 0:
                logger.info("✅ No messages deleted - all within limits")
            else:
                logger.info(f"✅ Cleanup completed: {cleanup_stats['messages_deleted']} messages deleted (limit-based only)")
            
            self.db.commit()
            return cleanup_stats
            
        except Exception as e:
            logger.error(f"❌ Error cleaning up old data: {e}")
            self.db.rollback()
            return {'messages_deleted': 0, 'users_cleaned': 0, 'error': str(e)}
    
    def optimize_database(self) -> Dict[str, Any]:
        """Оптимизирует базу данных"""
        try:
            # Получаем статистику до оптимизации
            stats_before = self.get_database_stats()
            
            # Выполняем очистку
            cleanup_stats = self.cleanup_old_data()
            
            # Получаем статистику после оптимизации
            stats_after = self.get_database_stats()
            
            return {
                'before': stats_before,
                'after': stats_after,
                'cleanup': cleanup_stats,
                'optimization_date': utcnow_naive().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error optimizing database: {e}")
            return {}
    
    def _estimate_database_size(self) -> float:
        """Оценивает размер базы данных в МБ"""
        try:
            # Примерная оценка размера записи
            avg_message_size = 200  # байт на сообщение
            avg_analysis_size = 500  # байт на анализ
            avg_user_size = 1000  # байт на пользователя
            
            total_messages = self.db.query(ChatMessage).count()
            total_analyses = self.db.query(PsychologyAnalysis).count()
            total_users = self.db.query(User).count()
            
            estimated_bytes = (
                total_messages * avg_message_size +
                total_analyses * avg_analysis_size +
                total_users * avg_user_size
            )
            
            return round(estimated_bytes / (1024 * 1024), 2)
            
        except Exception as e:
            logger.error(f"Error estimating database size: {e}")
            return 0.0
    
    def _cleanup_user_message_limits(self):
        """Очищает избыточные сообщения пользователей (превышающих лимит)"""
        try:
            from sqlalchemy import func
            
            total_deleted = 0
            
            # Находим пользователей с превышением лимита
            user_message_counts = self.db.query(
                ChatMessage.user_id,
                func.count(ChatMessage.id).label('message_count')
            ).group_by(ChatMessage.user_id).having(
                func.count(ChatMessage.id) > self.MAX_CHAT_MESSAGES_PER_USER
            ).all()
            
            for user_id, message_count in user_message_counts:
                excess_count = message_count - self.MAX_CHAT_MESSAGES_PER_USER
                
                # Удаляем самые старые сообщения пользователя
                oldest_messages = self.db.query(ChatMessage).filter(
                    ChatMessage.user_id == user_id
                ).order_by(ChatMessage.timestamp.asc()).limit(excess_count)
                
                deleted_count = oldest_messages.count()
                if deleted_count > 0:
                    oldest_messages.delete(synchronize_session=False)
                    total_deleted += deleted_count
                    logger.info(f"Deleted {deleted_count} excess messages for user {user_id} (limit: {self.MAX_CHAT_MESSAGES_PER_USER})")
            
            return total_deleted
                    
        except Exception as e:
            logger.error(f"Error cleaning up user message limits: {e}")
            return 0
    
    def sync_user_message_counts(self) -> Dict[str, int]:
        """Синхронизирует счетчики сообщений пользователей с реальными данными в базе"""
        try:
            from core.database import UserProgression
            from sqlalchemy import func
            
            sync_stats = {
                'users_updated': 0,
                'total_discrepancies': 0
            }
            
            # Получаем всех пользователей с прогрессией
            progressions = self.db.query(UserProgression).all()
            
            for progression in progressions:
                # Считаем реальное количество сообщений (включая удаленные)
                real_count = self.db.query(ChatMessage).filter(
                    and_(
                        ChatMessage.user_id == progression.user_id,
                        ChatMessage.channel_name == progression.channel_name,
                        ChatMessage.platform == progression.platform
                    )
                ).count()
                
                # Если есть расхождение, обновляем счетчик
                if progression.total_messages != real_count:
                    discrepancy = abs(progression.total_messages - real_count)
                    progression.total_messages = real_count
                    sync_stats['users_updated'] += 1
                    sync_stats['total_discrepancies'] += discrepancy
                    
                    logger.info(f"Synced message count for user {progression.user_id} in {progression.channel_name}: {real_count}")
            
            if sync_stats['users_updated'] > 0:
                self.db.commit()
                logger.info(f"Message count sync completed: {sync_stats}")
            
            return sync_stats
            
        except Exception as e:
            logger.error(f"Error syncing user message counts: {e}")
            self.db.rollback()
            return {}
    
    def get_user_message_count(self, username: str, platform: str) -> int:
        """Получает количество сообщений пользователя"""
        try:
            user = self.db.query(User).filter(User.id == int(username)).first()
            if not user:
                return 0
            
            count = self.db.query(ChatMessage).filter(
                and_(
                    ChatMessage.user_id == user.id,
                    ChatMessage.platform == platform
                )
            ).count()
            
            return count
            
        except Exception as e:
            logger.error(f"Error getting user message count: {e}")
            return 0
    
    def cleanup_user_data(self, username: str, platform: str, keep_days: int = 30) -> int:
        """Очищает старые данные конкретного пользователя"""
        try:
            user = self.db.query(User).filter(User.id == int(username)).first()
            if not user:
                return 0
            
            cutoff_date = utcnow_naive() - timedelta(days=keep_days)
            
            old_messages = self.db.query(ChatMessage).filter(
                and_(
                    ChatMessage.user_id == user.id,
                    ChatMessage.platform == platform,
                    ChatMessage.timestamp < cutoff_date
                )
            )
            
            count = old_messages.count()
            if count > 0:
                old_messages.delete(synchronize_session=False)
                self.db.commit()
                logger.info(f"Cleaned {count} old messages for user {username}")
            
            return count
            
        except Exception as e:
            logger.error(f"Error cleaning user data: {e}")
            self.db.rollback()
            return 0
