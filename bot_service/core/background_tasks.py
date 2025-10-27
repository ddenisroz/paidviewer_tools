# bot_service/core/background_tasks.py
"""Фоновые задачи"""
import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from core.database import get_db, User, UserSession
from core.connection_manager import get_connection_manager

logger = logging.getLogger(__name__)

class BackgroundTasks:
    """Класс для управления фоновыми задачами"""
    
    def __init__(self):
        self.tasks = []
    
    async def cleanup_old_chat_messages(self):
        """
        Автоматическая очистка сообщений чата по лимитам
        
        Удаляет ТОЛЬКО самые старые сообщения при превышении лимитов:
        - MAX_CHAT_MESSAGES_PER_USER: 3000 на пользователя (default)
        - MAX_TOTAL_CHAT_MESSAGES: 100000 всего (default)
        
        НЕ удаляет по возрасту! Только по количеству.
        Параметр CHAT_MESSAGES_RETENTION_DAYS используется только для статистики.
        """
        while True:
            await asyncio.sleep(3600)  # Проверяем каждый час
            
            try:
                db = next(get_db())
                try:
                    from services.database_cleanup_service import DatabaseCleanupService
                    
                    cleanup_service = DatabaseCleanupService(db)
                    
                    # Получаем статистику до очистки
                    stats_before = cleanup_service.get_database_stats()
                    total_before = stats_before.get('total_chat_messages', 0)
                    
                    # Очищаем старые данные
                    cleanup_stats = cleanup_service.cleanup_old_data()
                    
                    deleted_count = cleanup_stats.get('messages_deleted', 0)
                    
                    if deleted_count > 0:
                        logger.info(f"🗑️ [CHAT CLEANUP] Deleted {deleted_count} old messages (total before: {total_before})")
                    else:
                        logger.debug("✅ [CHAT CLEANUP] No messages to delete - all within limits")
                    
                except Exception as e:
                    logger.error(f"❌ [CHAT CLEANUP] Error in cleanup_old_chat_messages: {e}")
                finally:
                    db.close()
                    
            except Exception as e:
                logger.error(f"❌ [CHAT CLEANUP] Critical error in cleanup task: {e}")
                await asyncio.sleep(300)  # При ошибке повторить через 5 минут
    
    async def cleanup_expired_sessions(self):
        """Очистка истекших сессий"""
        while True:
            await asyncio.sleep(300)  # Каждые 5 минут
            try:
                db = next(get_db())
                
                # Удаляем сессии старше 24 часов
                expired_time = datetime.utcnow() - timedelta(hours=24)
                expired_sessions = db.query(UserSession).filter(
                    UserSession.created_at < expired_time
                ).all()
                
                for session in expired_sessions:
                    db.delete(session)
                
                db.commit()
                db.close()
                
                if expired_sessions:
                    logger.info(f"Cleaned up {len(expired_sessions)} expired sessions")
                
            except Exception as e:
                logger.error(f"Error in cleanup_expired_sessions: {e}")
            finally:
                if db:
                    db.close()
    
    async def refresh_vk_bot_token(self):
        """Автоматическое обновление VK Live bot token каждые 50 минут (до истечения в 60 минут)"""
        import os
        import base64
        import httpx
        
        while True:
            try:
                # Ждем 50 минут перед обновлением токена (ClientCredentials token живет 3600 сек = 60 минут)
                await asyncio.sleep(50 * 60)
                
                vk_client_id = os.getenv("VK_CLIENT_ID")
                vk_client_secret = os.getenv("VK_CLIENT_SECRET")
                
                if not vk_client_id or not vk_client_secret:
                    logger.debug("VK_CLIENT_ID or VK_CLIENT_SECRET not configured, skipping token refresh")
                    continue
                
                logger.info("🔄 [VK TOKEN] Starting automatic token refresh...")
                
                try:
                    # Подготавливаем Basic Auth
                    credentials = f"{vk_client_id}:{vk_client_secret}"
                    base64_credentials = base64.b64encode(credentials.encode()).decode()
                    
                    headers = {
                        "Authorization": f"Basic {base64_credentials}",
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                    
                    payload = {
                        "grant_type": "client_credentials"
                    }
                    
                    async with httpx.AsyncClient(timeout=10.0, trust_env=False) as client:
                        token_response = await client.post(
                            "https://api.live.vkvideo.ru/oauth/server/token",
                            data=payload,
                            headers=headers
                        )
                        
                        if token_response.status_code == 200:
                            token_data = token_response.json()
                            vk_access_token = token_data.get("access_token")
                            expires_in = token_data.get("expires_in", 3600)
                            
                            if vk_access_token:
                                # Сохраняем новый токен в переменную окружения
                                os.environ["VK_LIVE_USER_TOKEN"] = vk_access_token
                                logger.info(f"✅ [VK TOKEN] Token refreshed successfully (expires in {expires_in} seconds)")
                            else:
                                logger.error("❌ [VK TOKEN] No access_token in response")
                        else:
                            logger.error(f"❌ [VK TOKEN] Token refresh failed: {token_response.status_code} - {token_response.text}")
                
                except Exception as e:
                    logger.error(f"❌ [VK TOKEN] Error during token refresh: {e}")
                    
            except Exception as e:
                logger.error(f"❌ [VK TOKEN] Error in refresh_vk_bot_token loop: {e}")
                await asyncio.sleep(60)  # Если ошибка, ждем минуту перед повтором
    
    async def cleanup_task(self):
        """Фоновая задача для очистки неактивных каналов и клиентов (как в оригинале)"""
        while True:
            try:
                await asyncio.sleep(60)  # Проверяем каждую минуту
                connection_manager = get_connection_manager()
                await connection_manager.cleanup_inactive_channels()
                await connection_manager.cleanup_inactive_clients()
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")
    
    async def cleanup_deleted_accounts(self):
        """
        Окончательное удаление аккаунтов через 30 дней после soft delete
        
        GDPR compliance: "right to be forgotten" - окончательное удаление через 30 дней
        """
        while True:
            await asyncio.sleep(86400)  # Проверяем раз в день (24 часа)
            
            try:
                db = next(get_db())
                try:
                    from datetime import datetime, timedelta
                    
                    # Находим пользователей удалённых более 30 дней назад
                    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
                    
                    deleted_users = db.query(User).filter(
                        User.is_blocked == True,
                        User.blocked_reason == "account_deleted",
                        User.blocked_at < thirty_days_ago
                    ).all()
                    
                    if deleted_users:
                        logger.info(f"🗑️ [CLEANUP] Found {len(deleted_users)} accounts to permanently delete (>30 days)")
                        
                        for user in deleted_users:
                            try:
                                user_id = user.id
                                username = user.twitch_username or user.vk_username or f"user_{user_id}"
                                blocked_date = user.blocked_at
                                
                                # ОКОНЧАТЕЛЬНОЕ удаление (hard delete)
                                db.delete(user)
                                db.commit()
                                
                                logger.info(f"✅ [CLEANUP] Permanently deleted user {user_id} ({username}) - deleted on {blocked_date}")
                                
                            except Exception as e:
                                logger.error(f"❌ [CLEANUP] Error deleting user {user.id}: {e}")
                                db.rollback()
                    else:
                        logger.debug("🗑️ [CLEANUP] No accounts to permanently delete")
                        
                except Exception as e:
                    logger.error(f"❌ [CLEANUP] Error in cleanup_deleted_accounts: {e}")
                finally:
                    db.close()
                    
            except Exception as e:
                logger.error(f"❌ [CLEANUP] Critical error in cleanup task: {e}")
                await asyncio.sleep(3600)  # При ошибке повторить через час
    
    async def refresh_user_oauth_tokens(self):
        """
        Проактивное обновление OAuth токенов пользователей
        Проверяет каждые 2 часа и обновляет токены, которые истекут в течение 1 часа
        
        Twitch токены: живут 4 часа
        VK токены: живут 30 дней
        
        Проверка каждые 2 часа гарантирует что Twitch токены (4ч) будут обновлены вовремя
        """
        from core.database import SessionLocal, UserToken
        from core.datetime_utils import utcnow_naive
        from api.vk_api import VKLiveAPI
        from api.twitch_api import TwitchAPI
        
        while True:
            try:
                await asyncio.sleep(7200)  # Проверяем каждые 2 часа (2 * 60 * 60)
                
                logger.info("🔄 [TOKEN REFRESH] Checking for expiring user OAuth tokens...")
                
                db = SessionLocal()
                try:
                    # Находим токены которые истекут в течение следующего часа
                    threshold = utcnow_naive() + timedelta(hours=1)
                    
                    expiring_tokens = db.query(UserToken).filter(
                        UserToken.expires_at.isnot(None),
                        UserToken.expires_at <= threshold,
                        UserToken.refresh_token.isnot(None)
                    ).all()
                    
                    if not expiring_tokens:
                        logger.debug("✅ [TOKEN REFRESH] No expiring tokens found")
                    else:
                        logger.info(f"⚠️ [TOKEN REFRESH] Found {len(expiring_tokens)} expiring tokens")
                    
                    for token in expiring_tokens:
                        try:
                            logger.info(f"🔄 [TOKEN REFRESH] Refreshing {token.platform} token for user {token.user_id}")
                            
                            if token.platform == 'vk':
                                vk_api = VKLiveAPI()
                                new_token = await vk_api._refresh_user_token(token.user_id)
                                
                                if new_token:
                                    logger.info(f"✅ [TOKEN REFRESH] Successfully refreshed VK token for user {token.user_id}")
                                else:
                                    logger.error(f"❌ [TOKEN REFRESH] Failed to refresh VK token for user {token.user_id}")
                            
                            elif token.platform == 'twitch':
                                connection_manager = get_connection_manager()
                                twitch_api = TwitchAPI(connection_manager)
                                success = await twitch_api._refresh_user_token(token.user_id)
                                
                                if success:
                                    logger.info(f"✅ [TOKEN REFRESH] Successfully refreshed Twitch token for user {token.user_id}")
                                else:
                                    logger.error(f"❌ [TOKEN REFRESH] Failed to refresh Twitch token for user {token.user_id}")
                            
                            # Небольшая пауза между обновлениями
                            await asyncio.sleep(1)
                            
                        except Exception as e:
                            logger.error(f"❌ [TOKEN REFRESH] Error refreshing token for user {token.user_id}: {e}")
                            continue
                    
                finally:
                    db.close()
                    
            except Exception as e:
                logger.error(f"❌ [TOKEN REFRESH] Error in token refresh task: {e}")
                await asyncio.sleep(60)  # При ошибке повторить через минуту
    
    async def start_all_tasks(self):
        """Запуск всех фоновых задач"""
        self.tasks = [
            asyncio.create_task(self.cleanup_old_chat_messages()),      # Очистка истории чата (каждый час)
            asyncio.create_task(self.cleanup_expired_sessions()),       # Очистка истекших сессий (каждые 5 минут)
            asyncio.create_task(self.refresh_vk_bot_token()),          # Обновление VK bot токена (каждые 50 минут)
            asyncio.create_task(self.refresh_user_oauth_tokens()),     # Обновление OAuth токенов (каждые 2 часа)
            asyncio.create_task(self.cleanup_task()),                  # Очистка неактивных каналов (каждую минуту)
            asyncio.create_task(self.cleanup_deleted_accounts())       # Окончательное удаление аккаунтов (каждые 24 часа)
        ]
        
        logger.info("✅ [BACKGROUND] Started 6 background tasks:")
        logger.info("   - cleanup_old_chat_messages (every 1 hour)")
        logger.info("   - cleanup_expired_sessions (every 5 minutes)")
        logger.info("   - refresh_vk_bot_token (every 50 minutes)")
        logger.info("   - refresh_user_oauth_tokens (every 2 hours)")
        logger.info("   - cleanup_task (every 1 minute)")
        logger.info("   - cleanup_deleted_accounts (every 24 hours)")
    
    async def stop_all_tasks(self):
        """Остановка всех фоновых задач"""
        for task in self.tasks:
            task.cancel()
        
        await asyncio.gather(*self.tasks, return_exceptions=True)
        logger.info("Background tasks stopped")

# Создаем экземпляр для использования
background_tasks = BackgroundTasks()
