"""
Менеджер сессий для мультиплатформенной авторизации
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from core.database import User, UserToken, UserSession
from core.database import get_db
import logging

logger = logging.getLogger(__name__)

class SessionManager:
    """Менеджер для управления мультиплатформенными сессиями на основе единой учетной записи."""
    
    def __init__(self):
        self.session_timeout = timedelta(days=30)  # 30 дней бездействия
        # НЕ разлогиниваем пользователей при:
        # - сворачивании браузера
        # - смене вкладки  
        # - закрытии браузера
        # - потере фокуса окна

    def create_or_get_user_by_platform(self, platform: str, platform_user_id: str, avatar_url: str, db: Session, current_user_id: int = None) -> User:
        """Находит пользователя по ID платформы или создает нового, если он не найден."""
        logger.info(f"🔍 Looking for existing user with {platform} ID: {platform_user_id}")
        
        # Ищем по токенам текущей платформы
        token = db.query(UserToken).filter(
            UserToken.platform == platform,
            UserToken.platform_user_id == platform_user_id
        ).first()

        if token:
            logger.info(f"✅ Found existing token for {platform} user {platform_user_id}")
            # Получаем пользователя по user_id
            user = db.query(User).filter(User.id == token.user_id).first()
            if user:
                logger.info(f"✅ Found existing user (ID: {user.id}) for {platform} user {platform_user_id}")
                return user
            else:
                logger.warning(f"⚠️ Token found but user ID {token.user_id} doesn't exist - creating new user")
        else:
            logger.info(f"❌ No existing token found for {platform} user {platform_user_id}")
            
            # Если есть current_user_id (пользователь подключает интеграцию), добавляем токен к текущему пользователю
            if current_user_id:
                logger.info(f"🔗 User {current_user_id} is connecting {platform} integration - adding token to existing account")
                user = db.query(User).filter(User.id == current_user_id).first()
                if user:
                    logger.info(f"✅ Adding {platform} token to existing user {current_user_id}")
                    return user
                else:
                    logger.warning(f"⚠️ Current user {current_user_id} not found - creating new user")
        
        # Создаем нового пользователя (если токен не найден или пользователь не найден)
        logger.info(f"🆕 Creating a new user for {platform} user {platform_user_id}")
        
        # Проверяем, должен ли пользователь быть админом по platform:user_id
        import os
        admin_users_raw = os.getenv("ADMIN_USERS", "")
        admin_users = [admin.strip() for admin in admin_users_raw.split(",") if admin.strip()]
        
        # Проверяем админские права по platform:user_id
        admin_key = f"{platform}:{platform_user_id}"
        is_admin = admin_key in admin_users
        
        logger.info(f"Admin check: platform='{platform}', platform_user_id='{platform_user_id}', admin_key='{admin_key}', admin_users={admin_users}, is_admin={is_admin}")
        
        new_user = User(is_admin=is_admin)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        if is_admin:
            logger.info(f"✅ Created new admin user with ID: {new_user.id}")
        else:
            logger.info(f"✅ Created new user with ID: {new_user.id}")
        return new_user

    def _merge_user_accounts(self, source_user_id: int, target_user_id: int, db: Session):
        """Объединяет аккаунты пользователей: переносит все данные с source_user_id на target_user_id"""
        logger.info(f"🔄 Merging user {source_user_id} into user {target_user_id}")
        
        try:
            # Переносим все токены
            source_tokens = db.query(UserToken).filter(UserToken.user_id == source_user_id).all()
            for token in source_tokens:
                logger.info(f"  📝 Moving token {token.id} (platform: {token.platform}) from user {source_user_id} to user {target_user_id}")
                token.user_id = target_user_id
            
            # Переносим все сессии
            source_sessions = db.query(UserSession).filter(UserSession.user_id == source_user_id).all()
            for session in source_sessions:
                logger.info(f"  🔄 Moving session {session.id} from user {source_user_id} to user {target_user_id}")
                session.user_id = target_user_id
            
            # Переносим голоса (если есть)
            from core.database import Voice
            source_voices = db.query(Voice).filter(Voice.owner_id == source_user_id).all()
            for voice in source_voices:
                logger.info(f"  🎵 Moving voice {voice.id} from user {source_user_id} to user {target_user_id}")
                voice.owner_id = target_user_id
            
            # Удаляем исходного пользователя
            source_user = db.query(User).filter(User.id == source_user_id).first()
            if source_user:
                db.delete(source_user)
                logger.info(f"  🗑️ Removed source user {source_user_id}")
            
            db.commit()
            logger.info(f"✅ Successfully merged user {source_user_id} into user {target_user_id}")
            
        except Exception as e:
            logger.error(f"❌ Error merging users: {e}")
            db.rollback()
            raise

    def save_user_tokens(self, user_id: int, platform: str, platform_user_id: str, 
                        avatar_url: str = None, access_token: str = None, 
                        refresh_token: str = None, expires_at: datetime = None, scopes: list = None):
        """Сохраняет или обновляет токены пользователя для платформы"""
        db = next(get_db())
        try:
            logger.info(f"💾 Saving tokens for user {user_id}, platform {platform}, platform_user_id {platform_user_id}")
            
            # Ищем существующий токен для этой платформы и пользователя
            existing_token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == platform
            ).first()
            
            if existing_token:
                logger.info(f"🔄 Updating existing token for user {user_id}, platform {platform}")
                # Обновляем существующий токен
                existing_token.platform_user_id = platform_user_id
                existing_token.avatar_url = avatar_url
                existing_token.access_token = access_token
                existing_token.refresh_token = refresh_token
                existing_token.expires_at = expires_at
                existing_token.scopes = scopes
            else:
                logger.info(f"🆕 Creating new token for user {user_id}, platform {platform}")
                # Создаем новый токен
                new_token = UserToken(
                    user_id=user_id,
                    platform=platform,
                    platform_user_id=platform_user_id,
                    avatar_url=avatar_url,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    expires_at=expires_at,
                    scopes=scopes
                )
                db.add(new_token)
            
            db.commit()
            logger.info(f"✅ Successfully saved tokens for user {user_id}, platform {platform}")
            
        except Exception as e:
            logger.error(f"❌ Error saving tokens for user {user_id}: {e}")
            db.rollback()
            raise
        finally:
            db.close()

    def create_session(self, user_id: int, device_info: Optional[Dict] = None) -> str:
        """Создает новую сессию для пользователя, завершая все его предыдущие сессии."""
        db = next(get_db())
        try:
            self.terminate_user_sessions(user_id, "new_login", db)
            
            session_id = str(uuid.uuid4())
            
            new_session = UserSession(
                user_id=user_id,
                session_id=session_id,
                device_info=device_info or {},
                is_active=True
            )
            db.add(new_session)
            db.commit()
            
            logger.info(f"Created new session {session_id} for unified user {user_id}")
            return session_id
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating session for user {user_id}: {e}")
            raise
        finally:
            db.close()

    def create_guest_session(self, channel_name: str, platform: str, device_info: Optional[Dict] = None) -> str:
        """Создает гостевую сессию, завершая все предыдущие гостевые сессии для этого канала."""
        db = next(get_db())
        try:
            # Завершаем все предыдущие гостевые сессии для этого канала
            self.terminate_guest_sessions(channel_name, "new_guest_login", db)
            
            session_id = str(uuid.uuid4())
            
            # Создаем гостевую сессию (используем user_id = -1 для гостей)
            new_session = UserSession(
                user_id=-1,  # Специальный ID для гостевых сессий
                session_id=session_id,
                device_info={
                    **(device_info or {}),
                    "monitored_channel": channel_name,
                    "monitored_platform": platform
                },
                is_active=True
            )
            db.add(new_session)
            db.commit()
            
            logger.info(f"Created new guest session {session_id} for channel {channel_name} on {platform}")
            
            # Уведомляем connection_manager о новой активной сессии
            try:
                from core.connection_manager import get_connection_manager
                connection_manager = get_connection_manager()
                connection_manager.add_active_session(channel_name, session_id)
            except Exception as e:
                logger.error(f"Error notifying connection_manager about new session: {e}")
            
            return session_id
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating guest session for channel {channel_name}: {e}")
            raise
        finally:
            db.close()

    def terminate_guest_sessions(self, channel_name: str, reason: str = "logout", db: Optional[Session] = None) -> None:
        """Завершает все гостевые сессии для указанного канала."""
        close_db = False
        if db is None:
            db = next(get_db())
            close_db = True
        
        try:
            # Находим все гостевые сессии для этого канала
            sessions = db.query(UserSession).filter(
                UserSession.user_id == -1,  # Гостевые сессии
                UserSession.is_active == True
            ).all()
            
            # Фильтруем по каналу в device_info
            guest_sessions = []
            for session in sessions:
                if (session.device_info and 
                    session.device_info.get("monitored_channel") == channel_name):
                    guest_sessions.append(session)
            
            if not guest_sessions:
                return

            for session in guest_sessions:
                session.is_active = False
                logger.info(f"Terminated guest session {session.session_id} for channel {channel_name}, reason: {reason}")
            
            db.commit()
            
            # Отправка WebSocket уведомления о завершении сессии
            if reason in ["new_guest_login", "new_login"]:
                try:
                    import asyncio
                    # Используем локальный импорт для избежания циклических зависимостей
                    asyncio.create_task(self._notify_guest_session_terminated(channel_name, reason))
                except Exception as e:
                    logger.error(f"Error sending WebSocket notification for guest channel {channel_name}: {e}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error terminating guest sessions for channel {channel_name}: {e}")
        finally:
            if close_db:
                db.close()

    def terminate_all_sessions_for_channel(self, channel_name: str, reason: str = "new_login", db: Optional[Session] = None) -> None:
        """Завершает ВСЕ сессии (авторизованные и гостевые) для указанного канала."""
        close_db = False
        if db is None:
            db = next(get_db())
            close_db = True
        
        try:
            # Находим все активные сессии
            all_sessions = db.query(UserSession).filter(
                UserSession.is_active == True
            ).all()
            
            # Фильтруем по каналу в device_info
            channel_sessions = []
            for session in all_sessions:
                if (session.device_info and 
                    session.device_info.get("monitored_channel") == channel_name):
                    channel_sessions.append(session)
            
            if not channel_sessions:
                return

            for session in channel_sessions:
                session.is_active = False
                session_type = "guest" if session.user_id == -1 else "authorized"
                logger.info(f"Terminated {session_type} session {session.session_id} for channel {channel_name}, reason: {reason}")
            
            db.commit()
            
            # Отправка WebSocket уведомлений о завершении сессий
            try:
                import asyncio
                asyncio.create_task(self._notify_all_sessions_terminated_for_channel(channel_name, reason))
            except Exception as e:
                logger.error(f"Error sending WebSocket notification for channel {channel_name}: {e}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error terminating all sessions for channel {channel_name}: {e}")
        finally:
            if close_db:
                db.close()

    def terminate_user_sessions(self, user_id: int, reason: str = "logout", db: Optional[Session] = None) -> None:
        """Завершает все активные сессии указанного пользователя."""
        close_db = False
        if db is None:
            db = next(get_db())
            close_db = True
        
        try:
            sessions = db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active == True
            ).all()
            
            if not sessions:
                return

            for session in sessions:
                session.is_active = False
                logger.info(f"Terminated session {session.session_id} for user {user_id}, reason: {reason}")
            
            db.commit()
            
            # Отправка WebSocket уведомления о завершении сессии
            if reason in ["new_login"]:
                try:
                    from core.connection_manager import ConnectionManager
                    manager = ConnectionManager()
                    import asyncio
                    asyncio.create_task(manager.notify_session_terminated(str(user_id), reason))
                except Exception as e:
                    logger.error(f"Error sending WebSocket notification for user {user_id}: {e}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error terminating sessions for user {user_id}: {e}")
        finally:
            if close_db:
                db.close()

    def clear_user_tokens(self, user_id: int) -> bool:
        """Удаляет все токены интеграций пользователя при logout"""
        db = next(get_db())
        try:
            from core.database import UserToken
            
            # Получаем все токены пользователя перед удалением для логирования
            tokens = db.query(UserToken).filter_by(user_id=user_id).all()
            logger.info(f"🗑️ Clearing {len(tokens)} tokens for user {user_id}")
            
            for token in tokens:
                logger.info(f"🗑️ Removing {token.platform} token for {token.platform_user_id}")
            
            # Удаляем все токены пользователя
            deleted_count = db.query(UserToken).filter_by(user_id=user_id).delete()
            db.commit()
            
            logger.info(f"✅ Successfully removed {deleted_count} tokens for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error clearing tokens for user {user_id}: {e}")
            db.rollback()
            return False
        finally:
            db.close()
            
    def remove_platform_token(self, user_id: int, platform: str) -> bool:
        """Удаляет токены конкретной платформы для пользователя"""
        db = next(get_db())
        try:
            from core.database import UserToken
            
            # Получаем токены платформы перед удалением для логирования
            tokens = db.query(UserToken).filter_by(user_id=user_id, platform=platform).all()
            
            if not tokens:
                logger.warning(f"No {platform} tokens found for user {user_id}")
                return True
            
            logger.info(f"🗑️ Removing {len(tokens)} {platform} tokens for user {user_id}")
            
            for token in tokens:
                logger.info(f"🗑️ Removing {token.platform} token for {token.platform_user_id}")
            
            # Удаляем токены конкретной платформы
            deleted_count = db.query(UserToken).filter_by(user_id=user_id, platform=platform).delete()
            db.commit()
            
            logger.info(f"✅ Successfully removed {deleted_count} {platform} tokens for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error removing {platform} tokens for user {user_id}: {e}")
            db.rollback()
            return False
        finally:
            db.close()

    def terminate_session(self, session_id: str, reason: str = "logout") -> bool:
        """Завершает конкретную сессию по ее ID."""
        db = next(get_db())
        try:
            session = db.query(UserSession).filter_by(session_id=session_id, is_active=True).first()
            if not session:
                return False
            
            session.is_active = False
            db.commit()
            logger.info(f"Terminated session {session_id}, reason: {reason}")
            
            # Уведомляем connection_manager о завершении сессии
            try:
                from core.connection_manager import get_connection_manager
                connection_manager = get_connection_manager()
                
                # Определяем канал из device_info
                if session.device_info:
                    channel_name = session.device_info.get("monitored_channel")
                    if channel_name:
                        connection_manager.remove_active_session(channel_name, session_id)
            except Exception as e:
                logger.error(f"Error notifying connection_manager about session termination: {e}")
            
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error terminating session {session_id}: {e}")
            return False
        finally:
            db.close()

    def validate_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Проверяет валидность сессии и возвращает данные о пользователе и его интеграциях."""
        db = next(get_db())
        try:
            session = db.query(UserSession).filter_by(session_id=session_id, is_active=True).first()
            if not session:
                return None
            
            # Проверяем таймаут только для очень старых сессий (30 дней)
            # НЕ разлогиниваем пользователей при сворачивании браузера, смене вкладки или закрытии браузера
            time_since_activity = datetime.utcnow() - session.last_activity
            if time_since_activity > self.session_timeout:
                logger.info(f"Session {session_id} expired after {time_since_activity.days} days of inactivity")
                self.terminate_session(session_id, "timeout")
                return None
            
            # Обновляем last_activity только если прошло больше 1 часа
            # Это предотвращает постоянные обновления базы данных
            # Сессия остается активной даже после закрытия браузера
            if time_since_activity > timedelta(hours=1):
                session.last_activity = datetime.utcnow()
                db.commit()
                logger.debug(f"Updated last_activity for session {session_id}")
            
            user = db.query(User).filter_by(id=session.user_id).first()
            if not user:
                return None
            
            integrations = db.query(UserToken).filter_by(user_id=user.id).all()
            
            return {
                "user_id": user.id,
                "id": user.id, 
                "is_admin": user.is_admin,
                "is_blocked": user.is_blocked,
                "blocked_reason": user.blocked_reason,
                "blocked_at": user.blocked_at,
                "integrations": {
                    token.platform: {
                        "platform_user_id": token.platform_user_id,
                        "avatar_url": token.avatar_url
                    } for token in integrations
                }
            }
        except Exception as e:
            logger.error(f"Error validating session {session_id}: {e}")
            return None
        finally:
            db.close()

    def clear_all_user_tokens(self, user_id: int) -> bool:
        """Удалить ВСЕ токены пользователя при логауте"""
        db = next(get_db())
        try:
            from core.database import UserToken
            
            # Получаем все токены пользователя перед удалением для логирования
            tokens = db.query(UserToken).filter_by(user_id=user_id).all()
            
            if not tokens:
                logger.info(f"No tokens found for user {user_id} to clear")
                return True
            
            logger.info(f"🗑️ Clearing ALL {len(tokens)} tokens for user {user_id} on logout:")
            
            for token in tokens:
                logger.info(f"🗑️ Removing {token.platform} token for {token.platform_user_id}")
            
            # Удаляем ВСЕ токены пользователя
            deleted_count = db.query(UserToken).filter_by(user_id=user_id).delete()
            db.commit()
            
            logger.info(f"✅ Successfully cleared ALL {deleted_count} tokens for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error clearing all tokens for user {user_id}: {e}")
            db.rollback()
            return False
        finally:
            db.close()

    def get_user_tokens(self, user_id: int, platform: str) -> Optional[Dict[str, Any]]:
        """Получает токены для конкретной платформы по единому ID пользователя."""
        db = next(get_db())
        try:
            token = db.query(UserToken).filter_by(user_id=user_id, platform=platform).first()
            if not token:
                return None
            return {
                "access_token": token.access_token,
                "refresh_token": token.refresh_token,
                "expires_at": token.expires_at,
                "platform_user_id": token.platform_user_id,
                "avatar_url": token.avatar_url,
                "scopes": token.scopes or []
            }
        finally:
            db.close()

    def save_user_tokens(self, user_id: int, platform: str, platform_user_id: str, 
                         avatar_url: str = None, access_token: str = None,
                         refresh_token: Optional[str] = None, expires_at: Optional[datetime] = None,
                         scopes: Optional[List[str]] = None) -> bool:
        """Сохраняет или обновляет токены и данные интеграции для пользователя."""
        db = next(get_db())
        try:
            token = db.query(UserToken).filter_by(user_id=user_id, platform=platform).first()
            
            if token:
                # Обновляем
                token.access_token = access_token
                token.refresh_token = refresh_token
                token.expires_at = expires_at
                token.avatar_url = avatar_url
                token.scopes = scopes
                token.updated_at = datetime.utcnow()
            else:
                # Создаем
                token = UserToken(
                    user_id=user_id,
                    platform=platform,
                    platform_user_id=platform_user_id,
                    avatar_url=avatar_url,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    expires_at=expires_at,
                    scopes=scopes
                )
                db.add(token)
            
            db.commit()
            logger.info(f"Saved tokens for unified user {user_id} on platform {platform}")
            
            # Уведомление фронтенда
            try:
                from core.connection_manager import ConnectionManager
                import asyncio
                manager = ConnectionManager()
                # Отправляем уведомление всем подключенным пользователям
                asyncio.create_task(manager.broadcast(f"Integration update: {platform} connected for user {user_id}"))
            except Exception as e:
                logger.error(f"Error sending WebSocket notification for user {user_id}: {e}")

            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error saving tokens for user {user_id}, platform {platform}: {e}")
            return False
        finally:
            db.close()

    async def _notify_guest_session_terminated(self, channel_name: str, reason: str):
        """Вспомогательный метод для уведомлений"""
        try:
            from core.connection_manager import ConnectionManager
            manager = ConnectionManager()
            await manager.notify_guest_session_terminated(channel_name, reason)
        except Exception as e:
            logger.error(f"Error in _notify_guest_session_terminated: {e}")

    async def _notify_all_sessions_terminated_for_channel(self, channel_name: str, reason: str):
        """Вспомогательный метод для уведомлений"""
        try:
            from core.connection_manager import ConnectionManager
            manager = ConnectionManager()
            await manager.notify_all_sessions_terminated_for_channel(channel_name, reason)
        except Exception as e:
            logger.error(f"Error in _notify_all_sessions_terminated_for_channel: {e}")

session_manager = SessionManager()
