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

    def create_or_get_user_by_platform(self, platform: str, platform_user_id: str, platform_display_name: str, avatar_url: str, db: Session) -> User:
        """Находит пользователя по ID платформы или создает нового, если он не найден."""
        logger.info(f"🔍 Looking for existing user with {platform} ID: {platform_user_id}")
        
        # СНАЧАЛА ищем по токенам (если есть активные токены)
        token = db.query(UserToken).filter(
            UserToken.platform == platform,
            UserToken.platform_user_id == platform_user_id
        ).first()

        if token:
            logger.info(f"✅ Found existing token for {platform} user {platform_user_id}")
            # Получаем пользователя по user_id
            user = db.query(User).filter(User.id == token.user_id).first()
            if user:
                logger.info(f"✅ Found existing user (ID: {user.id}) for {platform} user {platform_display_name}")
                return user
            else:
                logger.warning(f"⚠️ Token found but user ID {token.user_id} doesn't exist - will search by platform_user_id")
        else:
            logger.info(f"❌ No existing token found for {platform} user {platform_user_id}")
        
        # ЕСЛИ токенов нет, ищем пользователя по всем историческим токенам
        # Это позволяет найти пользователя даже после логаута (когда токены удалены)
        logger.info(f"🔍 Searching for user by {platform} platform_user_id in token history...")
        
        # Ищем любые записи токенов с таким platform_user_id (даже удаленные)
        # На самом деле, токены удаляются полностью, поэтому нужна другая стратегия
        
        # УЛУЧШЕННЫЙ ПОИСК: Ищем пользователя, который мог входить через другие платформы
        logger.info(f"🔍 Advanced search for user {platform_display_name}")
        
        # Стратегия 1: Ищем по известным маппингам display_name
        # Например, если Twitch = "yourchy", то VK может быть "Денис Р#1209004"
        known_mappings = {
            "yourchy": ["yourchy", "denisR", "денис р", "zavtra_zavod"],  # Различные варианты имени
            "ttsbottester": ["ttsbottester", "tts bot tester"],
            "payedviewer": ["payedviewer", "payed viewer"]
        }
        
        current_name_lower = platform_display_name.lower().strip()
        for main_name, variants in known_mappings.items():
            if current_name_lower in [v.lower() for v in variants] or main_name.lower() == current_name_lower:
                # Ищем пользователя с любым из этих имен
                for variant in variants:
                    existing_user = db.query(User).filter(User.display_name.ilike(f"%{variant}%")).first()
                    if existing_user:
                        logger.info(f"✅ Found existing user (ID: {existing_user.id}) by name mapping: {existing_user.display_name} -> {platform_display_name}")
                        return existing_user
        
        # Стратегия 2: Ищем пользователей, которые имеют токены с админскими именами
        if current_name_lower in ["yourchy", "payedviewer"]:
            admin_user = db.query(User).filter(User.is_admin == True).first()
            if admin_user:
                logger.info(f"✅ Found existing admin user (ID: {admin_user.id}) for admin name: {platform_display_name}")
                return admin_user
        
        # Если не найден, ищем по точному display_name (старая логика)
        existing_user = db.query(User).filter(User.display_name == platform_display_name).first()
        
        if existing_user:
            logger.info(f"✅ Found existing user (ID: {existing_user.id}) by display_name: {platform_display_name}")
            return existing_user
        
        # Создаем нового пользователя
        logger.info(f"🆕 Creating a new unified user for {platform} user {platform_display_name}")
        
        # Проверяем, должен ли пользователь быть админом
        import os
        admin_users = os.getenv("ADMIN_USERS", "").lower().split(",")
        
        # Очищаем список админов от пробелов
        admin_users = [admin.strip() for admin in admin_users if admin.strip()]
        
        # Гибкая проверка админских прав
        current_name = platform_display_name.lower().strip()
        is_admin = False
        
        for admin_name in admin_users:
            # Точное совпадение
            if current_name == admin_name:
                is_admin = True
                break
            # Частичное совпадение (если display_name содержит admin имя)
            if admin_name in current_name or current_name in admin_name:
                is_admin = True
                break
        
        logger.info(f"Admin check: platform_display_name='{platform_display_name}', platform='{platform}', admin_users={admin_users}, is_admin={is_admin}")
        
        new_user = User(display_name=platform_display_name, is_admin=is_admin)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        if is_admin:
            logger.info(f"✅ Created new admin user with ID: {new_user.id}")
        else:
            logger.info(f"✅ Created new user with ID: {new_user.id}")
        return new_user

    def save_user_tokens(self, user_id: int, platform: str, platform_user_id: str, 
                        platform_display_name: str, avatar_url: str, access_token: str, 
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
                existing_token.platform_display_name = platform_display_name
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
                    platform_display_name=platform_display_name,
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
                    "guest_channel": channel_name,
                    "guest_platform": platform
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
                    session.device_info.get("guest_channel") == channel_name):
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
                    session.device_info.get("guest_channel") == channel_name):
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
                logger.info(f"🗑️ Removing {token.platform} token for {token.platform_display_name}")
            
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
                logger.info(f"🗑️ Removing {token.platform} token for {token.platform_display_name}")
            
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
                    channel_name = session.device_info.get("guest_channel")
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
            
            if datetime.utcnow() - session.last_activity > self.session_timeout:
                self.terminate_session(session_id, "timeout")
                return None
            
            session.last_activity = datetime.utcnow()
            db.commit()
            
            user = db.query(User).filter_by(id=session.user_id).first()
            if not user:
                return None
            
            integrations = db.query(UserToken).filter_by(user_id=user.id).all()
            
            return {
                "user_id": user.id,
                "id": user.id, 
                "username": user.display_name,  # Добавляем username
                "display_name": user.display_name,
                "is_admin": user.is_admin,
                "integrations": {
                    token.platform: {
                        "platform_user_id": token.platform_user_id,
                        "display_name": token.platform_display_name,
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
                logger.info(f"🗑️ Removing {token.platform} token for {token.platform_display_name}")
            
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
                "platform_display_name": token.platform_display_name,
                "avatar_url": token.avatar_url,
                "scopes": token.scopes or []
            }
        finally:
            db.close()

    def save_user_tokens(self, user_id: int, platform: str, platform_user_id: str, 
                         platform_display_name: str, avatar_url: str, access_token: str,
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
                token.platform_display_name = platform_display_name
                token.avatar_url = avatar_url
                token.scopes = scopes
                token.updated_at = datetime.utcnow()
            else:
                # Создаем
                token = UserToken(
                    user_id=user_id,
                    platform=platform,
                    platform_user_id=platform_user_id,
                    platform_display_name=platform_display_name,
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
