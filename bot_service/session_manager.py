"""
Менеджер сессий для мультиплатформенной авторизации
"""
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from database import User, UserToken, UserSession, VkGuestVerification, GuestVerification
from database import get_db
import logging

logger = logging.getLogger(__name__)

class SessionManager:
    """Менеджер для управления мультиплатформенными сессиями"""
    
    def __init__(self):
        self.session_timeout = timedelta(hours=24)  # 24 часа бездействия
    
    def create_session(self, user_id: str, platform: str, device_info: Optional[Dict] = None) -> str:
        """
        Создает новую сессию для пользователя
        Завершает все предыдущие сессии этого пользователя
        """
        db = next(get_db())
        try:
            # Завершаем все предыдущие сессии пользователя
            self.terminate_user_sessions(user_id, "new_login")
            
            # Генерируем новый session_id
            session_id = str(uuid.uuid4())
            
            # Создаем новую сессию
            new_session = UserSession(
                user_id=user_id,
                session_id=session_id,
                platform_data={platform: True},
                device_info=device_info or {},
                is_active=True
            )
            
            db.add(new_session)
            
            # Обновляем пользователя
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.session_id = session_id
                user.last_activity = datetime.utcnow()
            
            db.commit()
            
            logger.info(f"Created new session {session_id} for user {user_id} on platform {platform}")
            return session_id
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating session: {e}")
            raise
        finally:
            db.close()
    
    def add_platform_to_session(self, session_id: str, platform: str) -> bool:
        """
        Добавляет платформу к существующей сессии
        """
        db = next(get_db())
        try:
            session = db.query(UserSession).filter(
                UserSession.session_id == session_id,
                UserSession.is_active == True
            ).first()
            
            if not session:
                return False
            
            # Обновляем platform_data
            platform_data = session.platform_data or {}
            platform_data[platform] = True
            session.platform_data = platform_data
            session.last_activity = datetime.utcnow()
            
            db.commit()
            
            logger.info(f"Added platform {platform} to session {session_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error adding platform to session: {e}")
            return False
        finally:
            db.close()
    
    def terminate_user_sessions(self, user_id: str, reason: str = "logout") -> None:
        """
        Завершает все активные сессии пользователя
        """
        db = next(get_db())
        try:
            sessions = db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active == True
            ).all()
            
            for session in sessions:
                session.is_active = False
                logger.info(f"Terminated session {session.session_id} for user {user_id}, reason: {reason}")
            
            # Обновляем пользователя
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.session_id = None
            
            db.commit()
            
            # Отправляем WebSocket уведомления
            if reason in ["new_login", "guest_login"]:
                try:
                    from bot_service.connection_manager import manager
                    import asyncio
                    asyncio.create_task(manager.notify_session_terminated(user_id, reason))
                except Exception as e:
                    logger.error(f"Error sending WebSocket notification: {e}")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error terminating sessions: {e}")
        finally:
            db.close()
    
    def terminate_session(self, session_id: str, reason: str = "logout") -> bool:
        """
        Завершает конкретную сессию
        """
        db = next(get_db())
        try:
            session = db.query(UserSession).filter(
                UserSession.session_id == session_id,
                UserSession.is_active == True
            ).first()
            
            if not session:
                return False
            
            session.is_active = False
            
            # Обновляем пользователя
            user = db.query(User).filter(User.id == session.user_id).first()
            if user and user.session_id == session_id:
                user.session_id = None
            
            db.commit()
            
            logger.info(f"Terminated session {session_id}, reason: {reason}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error terminating session: {e}")
            return False
        finally:
            db.close()
    
    def validate_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Проверяет валидность сессии и возвращает данные пользователя
        """
        db = next(get_db())
        try:
            session = db.query(UserSession).filter(
                UserSession.session_id == session_id,
                UserSession.is_active == True
            ).first()
            
            if not session:
                return None
            
            # Проверяем timeout
            if datetime.utcnow() - session.last_activity > self.session_timeout:
                self.terminate_session(session_id, "timeout")
                return None
            
            # Обновляем last_activity
            session.last_activity = datetime.utcnow()
            db.commit()
            
            # Получаем данные пользователя
            user = db.query(User).filter(User.id == session.user_id).first()
            if not user:
                return None
            
            return {
                "user_id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "platforms": session.platform_data or {},
                "is_admin": user.is_admin,
                "settings": user.settings or {}
            }
            
        except Exception as e:
            logger.error(f"Error validating session: {e}")
            return None
        finally:
            db.close()
    
    def get_user_tokens(self, user_id: str, platform: str) -> Optional[Dict[str, Any]]:
        """
        Получает токены пользователя для конкретной платформы
        """
        db = next(get_db())
        try:
            token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == platform
            ).first()
            
            if not token:
                return None
            
            return {
                "access_token": token.access_token,
                "refresh_token": token.refresh_token,
                "expires_at": token.expires_at
            }
            
        except Exception as e:
            logger.error(f"Error getting user tokens: {e}")
            return None
        finally:
            db.close()
    
    def save_user_tokens(self, user_id: str, platform: str, access_token: str, 
                        refresh_token: Optional[str] = None, expires_at: Optional[datetime] = None) -> bool:
        """
        Сохраняет токены пользователя для конкретной платформы
        """
        db = next(get_db())
        try:
            # Ищем существующий токен
            token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == platform
            ).first()
            
            if token:
                # Обновляем существующий
                token.access_token = access_token
                token.refresh_token = refresh_token
                token.expires_at = expires_at
                token.updated_at = datetime.utcnow()
            else:
                # Создаем новый
                token = UserToken(
                    user_id=user_id,
                    platform=platform,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    expires_at=expires_at
                )
                db.add(token)
            
            db.commit()
            logger.info(f"Saved tokens for user {user_id} on platform {platform}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error saving user tokens: {e}")
            return False
        finally:
            db.close()
    
    def create_guest_session(self, channel_name: str, platform: str) -> str:
        """
        Создает гостевую сессию для канала
        Завершает все предыдущие сессии этого канала
        """
        db = next(get_db())
        try:
            # Завершаем все предыдущие сессии канала
            self.terminate_channel_sessions(channel_name, "guest_login")
            
            # Генерируем новый session_id
            session_id = str(uuid.uuid4())
            
            # Создаем гостевую сессию (user_id = channel_name для гостей)
            new_session = UserSession(
                user_id=channel_name,  # Для гостей используем channel_name как user_id
                session_id=session_id,
                platform_data={platform: True},
                device_info={"is_guest": True, "channel": channel_name},
                is_active=True
            )
            
            db.add(new_session)
            db.commit()
            
            logger.info(f"Created guest session {session_id} for channel {channel_name} on platform {platform}")
            return session_id
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating guest session: {e}")
            raise
        finally:
            db.close()
    
    def terminate_channel_sessions(self, channel_name: str, reason: str = "guest_login") -> None:
        """
        Завершает все активные сессии канала (для гостевых входов)
        """
        db = next(get_db())
        try:
            sessions = db.query(UserSession).filter(
                UserSession.user_id == channel_name,
                UserSession.is_active == True
            ).all()
            
            for session in sessions:
                session.is_active = False
                logger.info(f"Terminated channel session {session.session_id} for {channel_name}, reason: {reason}")
            
            db.commit()
            
            # Отправляем WebSocket уведомления
            if reason == "guest_login":
                try:
                    from bot_service.connection_manager import manager
                    import asyncio
                    asyncio.create_task(manager.notify_guest_session_terminated(channel_name, reason))
                except Exception as e:
                    logger.error(f"Error sending WebSocket notification: {e}")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error terminating channel sessions: {e}")
        finally:
            db.close()

# Глобальный экземпляр менеджера сессий
session_manager = SessionManager()
