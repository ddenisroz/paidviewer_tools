"""
Менеджер сессий для мультиплатформенной авторизации
"""
import uuid
import logging
from datetime import timedelta
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from core.datetime_utils import utcnow_naive
from core.database import (
    User, UserToken, UserSession, UserSettings, TTSUserSettings,
    db_session
)

# NOTE: Guest mode removed - all users must authenticate via OAuth

logger = logging.getLogger(__name__)

class SessionManager:
    """Менеджер для управления мультиплатформенными сессиями на основе единой учетной записи."""

    def __init__(self):
        # Бесконечная сессия - сессия живет до явного логаута или логина с другого устройства
        # Устанавливаем очень большой таймаут (10 лет) для проверки, но фактически сессия бесконечна
        self.session_timeout = timedelta(days=3650)  # 10 лет (практически бесконечно)
        # НЕ разлогиниваем пользователей при:
        # - сворачивании браузера
        # - смене вкладки
        # - закрытии браузера
        # - потере фокуса окна
        # - долгом перерыве в использовании
        # Сессия завершается ТОЛЬКО при:
        # - явном логауте пользователя
        # - логине с другого устройства (все старые сессии завершаются)

    def create_or_get_user_by_platform(self, platform: str, platform_user_id: str, avatar_url: str, db: Session, current_user_id: int = None, username: str = None) -> User:
        """Находит пользователя по ID платформы или создает нового, если он не найден."""
        logger.info(f"[SEARCH] Looking for existing user with {platform} ID: {platform_user_id}")

        # Ищем по токенам текущей платформы
        token = db.query(UserToken).filter(
            UserToken.platform == platform,
            UserToken.platform_user_id == platform_user_id
        ).first()

        if token:
            logger.info(f"[OK] Found existing token for {platform} user {platform_user_id}")
            # Получаем пользователя по user_id
            user = db.query(User).filter(User.id == token.user_id).first()
            if user:
                logger.info(f"[OK] Found existing user (ID: {user.id}) for {platform} user {platform_user_id}")
                # Обновляем username если он передан и еще не установлен
                if username and platform == "twitch" and not user.twitch_username:
                    user.twitch_username = username
                    db.commit()
                    logger.info(f"[UPDATE] Set twitch_username to {username}")
                elif username and platform == "vk" and not user.vk_username:
                    user.vk_username = username
                    db.commit()
                    logger.info(f"[UPDATE] Set vk_username to {username}")
                return user
            else:
                logger.warning(f"[WARN] Token found but user ID {token.user_id} doesn't exist - creating new user")
        else:
            logger.info(f"[ERROR] No existing token found for {platform} user {platform_user_id}")

            # Если есть current_user_id (пользователь подключает интеграцию), добавляем токен к текущему пользователю
            if current_user_id:
                logger.info(f"[CHANNELS] User {current_user_id} is connecting {platform} integration - adding token to existing account")
                user = db.query(User).filter(User.id == current_user_id).first()
                if user:
                    logger.info(f"[OK] Adding {platform} token to existing user {current_user_id}")
                    return user
                else:
                    logger.warning(f"[WARN] Current user {current_user_id} not found - creating new user")

        # Создаем нового пользователя (если токен не найден или пользователь не найден)
        logger.info(f"[NEW] Creating a new user for {platform} user {platform_user_id}")

        # БЕЗОПАСНОСТЬ: Проверяем админские права через базу данных
        # Создаем пользователя как обычного, админские права назначаются отдельно
        is_admin = False

        # Проверяем, есть ли пользователь в таблице админов
        from core.database import AdminUser
        admin_user = db.query(AdminUser).filter(
            AdminUser.platform == platform,
            AdminUser.platform_user_id == platform_user_id
        ).first()

        if admin_user and admin_user.is_active:
            is_admin = True
            logger.info(f"Admin user found in database: {platform}:{platform_user_id}")

        logger.info(f"Creating new user: platform='{platform}', platform_user_id='{platform_user_id}', is_admin={is_admin}")

        # Создаем пользователя с username если он передан
        # Используем role вместо is_admin
        role = 'admin' if is_admin else 'user'
        new_user = User(role=role)
        if username and platform == "twitch":
            new_user.twitch_username = username
        elif username and platform == "vk":
            new_user.vk_username = username

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        if is_admin:
            logger.info(f"[OK] Created new admin user with ID: {new_user.id}")
        else:
            logger.info(f"[OK] Created new user with ID: {new_user.id}")
        return new_user

    def _merge_user_accounts(self, source_user_id: int, target_user_id: int, db: Session):
        """Объединяет два аккаунта: переносит все данные от source к target"""
        try:
            logger.info(f"Merging user {source_user_id} into user {target_user_id}")

            # Получаем пользователей
            source_user = db.query(User).filter(User.id == source_user_id).first()
            target_user = db.query(User).filter(User.id == target_user_id).first()

            if not source_user or not target_user:
                raise ValueError("Source or target user not found")

            # Переносим username'ы если их нет у target
            if not target_user.twitch_username and source_user.twitch_username:
                target_user.twitch_username = source_user.twitch_username
            if not target_user.vk_username and source_user.vk_username:
                target_user.vk_username = source_user.vk_username

            # Переносим токены
            source_tokens = db.query(UserToken).filter(UserToken.user_id == source_user_id).all()
            for token in source_tokens:
                # Проверяем, нет ли уже токена этой платформы у target
                existing_token = db.query(UserToken).filter(
                    UserToken.user_id == target_user_id,
                    UserToken.platform == token.platform
                ).first()

                if not existing_token:
                    # Переносим токен
                    token.user_id = target_user_id
                else:
                    # Обновляем существующий токен
                    existing_token.access_token = token.access_token
                    existing_token.refresh_token = token.refresh_token
                    existing_token.expires_at = token.expires_at
                    existing_token.scopes = token.scopes
                    existing_token.avatar_url = token.avatar_url
                    existing_token.platform_user_id = token.platform_user_id

                    # Удаляем старый токен
                    db.delete(token)

            # Переносим настройки пользователя
            source_settings = db.query(UserSettings).filter(UserSettings.user_id == source_user_id).first()
            target_settings = db.query(UserSettings).filter(UserSettings.user_id == target_user_id).first()

            if source_settings and target_settings:
                # Обновляем настройки target данными из source (приоритет у source)
                for column in UserSettings.__table__.columns:
                    if column.name not in ['id', 'user_id']:
                        source_value = getattr(source_settings, column.name)
                        if source_value is not None:
                            setattr(target_settings, column.name, source_value)

            # Переносим TTS настройки
            source_tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.user_id == source_user_id).first()
            target_tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.user_id == target_user_id).first()

            if source_tts_settings and target_tts_settings:
                # Обновляем TTS настройки target данными из source
                for column in TTSUserSettings.__table__.columns:
                    if column.name not in ['id', 'user_id', 'created_at', 'updated_at']:
                        source_value = getattr(source_tts_settings, column.name)
                        if source_value is not None:
                            setattr(target_tts_settings, column.name, source_value)

            # Обновляем сессии: меняем user_id с source на target
            db.query(UserSession).filter(UserSession.user_id == source_user_id).update({
                UserSession.user_id: target_user_id
            })

            # Переносим другие связанные данные (если есть)
            # Здесь можно добавить перенос команд, голосов, истории и т.д.

            db.commit()
            logger.info(f"Successfully merged user {source_user_id} into user {target_user_id}")

        except Exception as e:
            db.rollback()
            logger.error(f"Error merging user accounts: {e}")
            raise

    def terminate_user_sessions_for_channel(self, user_id: int, channel_name: str, reason: str = "user_logout"):
        """Завершает все сессии пользователя для канала при логауте"""
        from sqlalchemy import text

        with db_session() as db:
            # PostgreSQL использует оператор ->> для извлечения JSON значений
            json_query = "device_info->>'monitored_channel' = :channel"

            user_sessions = db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active,
                text(json_query)
            ).params(channel=channel_name).all()

            for session in user_sessions:
                session.is_active = False
                session.ended_at = utcnow_naive()
                session.device_info = {
                    **session.device_info,
                    "termination_reason": reason,
                    "terminated_at": utcnow_naive().isoformat()
                }
                logger.info(f"Terminated user session {session.session_id} for channel {channel_name}: {reason}")

            logger.info(f"Terminated {len(user_sessions)} user sessions for channel {channel_name}")

    def save_user_tokens(self, user_id: int, platform: str, platform_user_id: str,
                        avatar_url: str = None, access_token: str = None,
                        refresh_token: str = None, expires_at = None,
                        scopes: list = None):
        """
        Сохраняет или обновляет токены пользователя для платформы.
        Используется только полная OAuth авторизация.
        """
        from core.token_encryption import encrypt_token

        logger.info(f"[SAVE] Saving tokens for user {user_id}, platform {platform}")

        # Шифруем токены перед сохранением
        encrypted_access_token = encrypt_token(access_token) if access_token else None
        encrypted_refresh_token = encrypt_token(refresh_token) if refresh_token else None

        with db_session() as db:
            existing_token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == platform
            ).first()

            if existing_token:
                logger.info(f"[REFRESH] Updating existing token for user {user_id}, platform {platform}")
                existing_token.platform_user_id = platform_user_id
                existing_token.avatar_url = avatar_url
                existing_token.access_token = encrypted_access_token
                existing_token.refresh_token = encrypted_refresh_token
                existing_token.expires_at = expires_at
                existing_token.scopes = scopes
                existing_token.auth_type = "full"
                if hasattr(existing_token, 'is_active'):
                    existing_token.is_active = True
            else:
                logger.info(f"[NEW] Creating new token for user {user_id}, platform {platform}")
                new_token = UserToken(
                    user_id=user_id,
                    platform=platform,
                    platform_user_id=platform_user_id,
                    avatar_url=avatar_url,
                    access_token=encrypted_access_token,
                    refresh_token=encrypted_refresh_token,
                    expires_at=expires_at,
                    scopes=scopes,
                    auth_type="full"
                )
                db.add(new_token)

        logger.info(f"[OK] Successfully saved tokens for user {user_id}, platform {platform}")

    def create_session(self, user_id: int, device_info: Optional[Dict] = None) -> str:
        """Создает новую сессию для пользователя, завершая все его предыдущие сессии."""
        logger.info(f"[SESSION] create_session called for user_id: {user_id}")

        session_id = str(uuid.uuid4())

        # SECURITY: В сессии доступна только платформа, через которую залогинились
        if device_info:
            login_platform = device_info.get('platform')
            if login_platform:
                device_info['linked_platforms'] = [login_platform]
                logger.info(f"[SECURITY] Session created with ONLY {login_platform} platform access")

        with db_session() as db:
            self.terminate_user_sessions(user_id, "new_login", db)

            new_session = UserSession(
                user_id=user_id,
                session_id=session_id,
                device_info=device_info or {},
                is_active=True
            )
            db.add(new_session)
            db.flush()
            db.refresh(new_session)

            logger.info(f"[OK] Session {session_id} created for user {user_id}")

        return session_id

    def update_session(self, session_id: int, device_info: Optional[Dict] = None) -> bool:
        """Обновляет существующую сессию новыми данными"""
        try:
            with db_session() as db:
                session = db.query(UserSession).filter(UserSession.id == session_id).first()
                if not session:
                    logger.warning(f"Session {session_id} not found")
                    return False

                if device_info:
                    session.device_info = device_info
                session.updated_at = utcnow_naive()

            logger.info(f"[OK] Session {session_id} updated successfully")
            return True
        except Exception as e:
            logger.error(f"[ERROR] Error updating session {session_id}: {e}")
            return False

    def get_user_tokens(self, user_id: int, platform: str) -> Optional[Dict]:
        """Получает токены пользователя с расшифровкой"""
        from core.token_encryption import decrypt_token, is_token_encrypted

        try:
            with db_session() as db:
                token_record = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == platform
                ).first()

                if not token_record:
                    return None

                # Расшифровываем токены
                access_token = token_record.access_token
                refresh_token = token_record.refresh_token

                if access_token and is_token_encrypted(access_token):
                    access_token = decrypt_token(access_token)

                if refresh_token and is_token_encrypted(refresh_token):
                    refresh_token = decrypt_token(refresh_token)

                return {
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'expires_at': token_record.expires_at,
                    'scopes': token_record.scopes,
                    'platform_user_id': token_record.platform_user_id,
                    'avatar_url': token_record.avatar_url
                }
        except Exception as e:
            logger.error(f"Error getting tokens for user {user_id}, platform {platform}: {e}")
            return None

    def terminate_all_sessions_for_channel(self, channel_name: str, reason: str = "new_login", db: Optional[Session] = None) -> None:
        """Завершает все авторизованные сессии для указанного канала."""
        def _terminate(session_db: Session):
            all_sessions = session_db.query(UserSession).filter(
                UserSession.is_active
            ).all()

            # Фильтруем по каналу в device_info
            channel_sessions = [
                s for s in all_sessions
                if s.device_info and s.device_info.get("monitored_channel") == channel_name
            ]

            for session in channel_sessions:
                session.is_active = False
                logger.info(f"[TERMINATE] Terminated session {session.session_id} for channel {channel_name}, reason: {reason}")

            logger.info(f"[OK] Terminated {len(channel_sessions)} sessions for channel {channel_name}")

            # Отправка WebSocket уведомлений
            try:
                import asyncio
                asyncio.create_task(self._notify_all_sessions_terminated_for_channel(channel_name, reason))
            except Exception as e:
                logger.error(f"Error sending WebSocket notification for channel {channel_name}: {e}")

        if db is not None:
            _terminate(db)
            db.commit()
        else:
            with db_session() as new_db:
                _terminate(new_db)

    def terminate_user_sessions(self, user_id: int, reason: str = "logout", db: Optional[Session] = None) -> None:
        """Завершает все активные сессии указанного пользователя."""
        def _terminate(session_db: Session):
            sessions = session_db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active
            ).all()

            if not sessions:
                return

            for session in sessions:
                session.is_active = False
                logger.info(f"Terminated session {session.session_id} for user {user_id}, reason: {reason}")

            logger.info(f"Sessions terminated for user {user_id}, reason: {reason}")

        if db is not None:
            _terminate(db)
            db.commit()
        else:
            with db_session() as new_db:
                _terminate(new_db)

    def clear_user_tokens(self, user_id: int) -> bool:
        """Удаляет все токены интеграций пользователя при logout"""
        try:
            with db_session() as db:
                tokens = db.query(UserToken).filter_by(user_id=user_id).all()
                logger.info(f"[DELETE] Clearing {len(tokens)} tokens for user {user_id}")

                deleted_count = db.query(UserToken).filter_by(user_id=user_id).delete()

            logger.info(f"[OK] Successfully removed {deleted_count} tokens for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"[ERROR] Error clearing tokens for user {user_id}: {e}")
            return False

    def remove_platform_token(self, user_id: int, platform: str) -> bool:
        """Удаляет токены конкретной платформы для пользователя"""
        try:
            with db_session() as db:
                tokens = db.query(UserToken).filter_by(user_id=user_id, platform=platform).all()

                if not tokens:
                    logger.warning(f"No {platform} tokens found for user {user_id}")
                    return True

                logger.info(f"[DELETE] Removing {len(tokens)} {platform} tokens for user {user_id}")
                deleted_count = db.query(UserToken).filter_by(user_id=user_id, platform=platform).delete()

            logger.info(f"[OK] Successfully removed {deleted_count} {platform} tokens for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"[ERROR] Error removing {platform} tokens for user {user_id}: {e}")
            return False

    def terminate_session(self, session_id: str, reason: str = "logout") -> bool:
        """Завершает конкретную сессию по ее ID."""
        try:
            device_info = None
            with db_session() as db:
                session = db.query(UserSession).filter_by(session_id=session_id, is_active=True).first()
                if not session:
                    return False

                session.is_active = False
                device_info = session.device_info

            logger.info(f"Terminated session {session_id}, reason: {reason}")

            # Уведомляем connection_manager о завершении сессии
            try:
                from core.connection_manager import get_connection_manager
                connection_manager = get_connection_manager()

                if device_info:
                    channel_name = device_info.get("monitored_channel")
                    if channel_name:
                        connection_manager.remove_active_session(channel_name, session_id)
            except Exception as e:
                logger.error(f"Error notifying connection_manager about session termination: {e}")

            return True
        except Exception as e:
            logger.error(f"Error terminating session {session_id}: {e}")
            return False

    def validate_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Проверяет валидность сессии и возвращает данные о пользователе."""
        if not session_id or len(session_id) < 10:
            logger.warning(f"Invalid session_id format: {session_id}")
            return None

        try:
            with db_session() as db:
                session = db.query(UserSession).filter_by(session_id=session_id, is_active=True).first()

                if not session:
                    logger.debug(f"Invalid or inactive session: {session_id[:20]}...")
                    return None

                # Обновляем last_activity только если прошло больше 1 часа
                time_since_activity = utcnow_naive() - session.last_activity
                if time_since_activity > timedelta(hours=1):
                    session.last_activity = utcnow_naive()

                user = db.query(User).filter_by(id=session.user_id).first()
                if not user:
                    logger.warning(f"User not found for session {session_id[:20]}...")
                    return None

                login_platform = None
                if session.device_info and isinstance(session.device_info, dict):
                    login_platform = session.device_info.get('platform')

                return {
                    "user_id": user.id,
                    "id": user.id,
                    "session_id": session_id,
                    "is_admin": user.is_admin,
                    "is_blocked": user.is_blocked,
                    "blocked_reason": user.blocked_reason,
                    "blocked_at": user.blocked_at,
                    "integrations": {},
                    "login_platform": login_platform
                }
        except Exception as e:
            logger.error(f"Error validating session {session_id}: {e}")
            return None

    def clear_all_user_tokens(self, user_id: int) -> bool:
        """Удалить ВСЕ токены пользователя при логауте. Алиас для clear_user_tokens."""
        return self.clear_user_tokens(user_id)

    async def _notify_all_sessions_terminated_for_channel(self, channel_name: str, reason: str):
        """Вспомогательный метод для уведомлений"""
        try:
            from core.connection_manager import ConnectionManager
            manager = ConnectionManager()
            await manager.notify_all_sessions_terminated_for_channel(channel_name, reason)
        except Exception as e:
            logger.error(f"Error in _notify_all_sessions_terminated_for_channel: {e}")

    def cleanup_old_sessions(self, days_old: int = 7) -> int:
        """Удаляет старые неактивные сессии старше указанного количества дней."""
        from core.database import (
            UserSettings, TTSUserSettings, AudioSettings,
            LocalTTSEndpoint, FilteredWord, TTSBlockedUser,
            YouTubeQueue, DropsConfig, DropsReward,
            UserStreak, DropsHistory, MythicalDropsSession,
            UserToken
        )

        # Таблицы для очистки гостевых сессий
        guest_tables = [
            UserSettings, TTSUserSettings, AudioSettings, LocalTTSEndpoint,
            FilteredWord, TTSBlockedUser, YouTubeQueue, UserToken,
            DropsConfig, DropsReward, UserStreak, DropsHistory, MythicalDropsSession
        ]

        try:
            with db_session() as db:
                cutoff_date = utcnow_naive() - timedelta(days=days_old)

                old_sessions = db.query(UserSession).filter(
                    not UserSession.is_active,
                    UserSession.last_activity < cutoff_date
                ).all()

                count = len(old_sessions)
                if count == 0:
                    logger.debug(f"No old sessions to clean up (older than {days_old} days)")
                    return 0

                total_settings_deleted = 0

                for session in old_sessions:
                    # Для гостевых сессий удаляем связанные настройки
                    if session.user_id == -1:
                        for table in guest_tables:
                            if hasattr(table, 'session_id'):
                                total_settings_deleted += db.query(table).filter(
                                    table.session_id == session.session_id
                                ).delete()

                    db.delete(session)

                logger.info(f"[BROOM] Cleaned up {count} old inactive sessions (older than {days_old} days)")
                if total_settings_deleted > 0:
                    logger.info(f"[BROOM] Also deleted {total_settings_deleted} associated guest settings records")

                return count
        except Exception as e:
            logger.error(f"Error cleaning up old sessions: {e}")
            return 0

    def get_session_stats(self) -> dict:
        """Возвращает статистику по сессиям."""
        try:
            with db_session() as db:
                total_sessions = db.query(UserSession).count()
                active_sessions = db.query(UserSession).filter(UserSession.is_active).count()

                cutoff_date = utcnow_naive() - timedelta(days=7)
                old_inactive = db.query(UserSession).filter(
                    not UserSession.is_active,
                    UserSession.last_activity < cutoff_date
                ).count()

                return {
                    "total_sessions": total_sessions,
                    "active_sessions": active_sessions,
                    "inactive_sessions": total_sessions - active_sessions,
                    "old_inactive_sessions": old_inactive
                }
        except Exception as e:
            logger.error(f"Error getting session stats: {e}")
            return {}

session_manager = SessionManager()
