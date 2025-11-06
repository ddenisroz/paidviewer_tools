"""
Менеджер сессий для мультиплатформенной авторизации
"""
import uuid
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from core.database import User, UserToken, UserSession, GuestSession
from core.database import get_db
from core.project_paths import PROJECT_ROOT
import logging

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
        logger.info(f"🆕 Creating a new user for {platform} user {platform_user_id}")
        
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
        new_user = User(is_admin=is_admin)
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

    def convert_guest_to_authenticated(self, guest_session_id: str, platform: str, platform_user_id: str, avatar_url: str, access_token: str, refresh_token: str, expires_at: datetime, scopes: list, username: str = None) -> User:
        """Превращает гостевую сессию в авторизованную с переносом настроек"""
        db = next(get_db())
        try:
            # Получаем гостевую сессию из таблицы GuestSession
            guest_session = db.query(GuestSession).filter(
                GuestSession.session_id == guest_session_id,
                GuestSession.is_active == True
            ).first()
            
            if not guest_session:
                raise ValueError(f"Guest session {guest_session_id} not found")
            
            # Создаем нового авторизованного пользователя
            new_user = User(is_admin=False, is_active=True)
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            # Сохраняем токены платформы
            self.save_user_tokens(
                user_id=new_user.id,
                platform=platform,
                platform_user_id=platform_user_id,
                avatar_url=avatar_url,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
                scopes=scopes
            )
            
            # 🔥 Инвалидируем кеш после конвертации гостевой сессии
            from core.token_validation_cache import token_validation_cache
            token_validation_cache.invalidate(new_user.id, platform)
            logger.info(f"🗑️ Token validation cache invalidated for new user {new_user.id}, platform {platform}")
            
            # Сохраняем username
            if platform == "twitch" and username:
                new_user.twitch_username = username
            elif platform == "vk" and username:
                new_user.vk_username = username
            
            # Переносим настройки от гостя (ищем по session_id)
            guest_settings = db.query(UserSettings).filter(UserSettings.session_id == guest_session_id).first()
            if guest_settings:
                new_settings = UserSettings(
                    user_id=new_user.id,
                    chat_enabled=guest_settings.chat_enabled,
                    chat_max_messages=guest_settings.chat_max_messages,
                    chat_show_timestamps=guest_settings.chat_show_timestamps,
                    chat_show_platform=guest_settings.chat_show_platform,
                    chat_show_user_roles=guest_settings.chat_show_user_roles,
                    chat_animation_duration=guest_settings.chat_animation_duration,
                    chat_animation_type=guest_settings.chat_animation_type,
                    obs_width=guest_settings.obs_width,
                    obs_height=guest_settings.obs_height,
                    obs_font_size=guest_settings.obs_font_size,
                    obs_font_color=guest_settings.obs_font_color,
                    obs_background_color=guest_settings.obs_background_color,
                    obs_message_spacing=guest_settings.obs_message_spacing,
                    obs_show_avatars=guest_settings.obs_show_avatars,
                    obs_avatar_size=guest_settings.obs_avatar_size,
                    obs_message_fade_time=guest_settings.obs_message_fade_time,
                    obs_message_display_limit=guest_settings.obs_message_display_limit,
                    obs_text_shadow=guest_settings.obs_text_shadow,
                    obs_border_radius=guest_settings.obs_border_radius,
                    obs_padding=guest_settings.obs_padding,
                    obs_max_width=guest_settings.obs_max_width,
                    obs_text_align=guest_settings.obs_text_align,
                    obs_custom_css=guest_settings.obs_custom_css,
                    combine_titles=guest_settings.combine_titles,
                    combine_categories=guest_settings.combine_categories
                )
                db.add(new_settings)
            
            # Переносим TTS настройки от гостя (ищем по session_id)
            guest_tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.session_id == guest_session_id).first()
            if guest_tts_settings:
                new_tts_settings = TTSUserSettings(
                    user_id=new_user.id,
                    enable_7tv=guest_tts_settings.enable_7tv,
                    enable_twitch=guest_tts_settings.enable_twitch,
                    enable_lexicon_filter=guest_tts_settings.enable_lexicon_filter,
                    enable_custom_lexicon=guest_tts_settings.enable_custom_lexicon
                )
                db.add(new_tts_settings)
            
            # ⚠️ Голоса гостей НЕ переносятся - гости теперь не могут загружать голоса
            # Все их данные ограничиваются индивидуальными настройками через session_id
            
            # ✅ Переносим LocalTTSEndpoint с session_id
            try:
                from core.database import LocalTTSEndpoint
                local_tts = db.query(LocalTTSEndpoint).filter(LocalTTSEndpoint.session_id == guest_session_id).first()
                if local_tts:
                    local_tts.user_id = new_user.id
                    local_tts.session_id = None
                    logger.info(f"✅ Transferred local TTS endpoint config")
            except Exception as e:
                logger.warning(f"Could not transfer local TTS config: {e}")
            
            # ✅ Переносим FilteredWord с session_id
            try:
                from core.database import FilteredWord
                filtered_words = db.query(FilteredWord).filter(FilteredWord.session_id == guest_session_id).all()
                for word in filtered_words:
                    word.user_id = new_user.id
                    word.session_id = None
                if filtered_words:
                    logger.info(f"✅ Transferred {len(filtered_words)} filtered words")
            except Exception as e:
                logger.warning(f"Could not transfer filtered words: {e}")
            
            # ✅ Переносим TTSBlockedUser с session_id
            try:
                from core.database import TTSBlockedUser
                blocked_users = db.query(TTSBlockedUser).filter(TTSBlockedUser.session_id == guest_session_id).all()
                for blocked in blocked_users:
                    blocked.user_id = new_user.id
                    blocked.session_id = None
                if blocked_users:
                    logger.info(f"✅ Transferred {len(blocked_users)} blocked users")
            except Exception as e:
                logger.warning(f"Could not transfer blocked users: {e}")
            
            # ✅ Переносим YouTubeQueue с session_id
            try:
                from core.database import YouTubeQueue
                queue_items = db.query(YouTubeQueue).filter(YouTubeQueue.session_id == guest_session_id).all()
                for item in queue_items:
                    item.user_id = new_user.id
                    item.session_id = None
                if queue_items:
                    logger.info(f"✅ Transferred {len(queue_items)} YouTube queue items")
            except Exception as e:
                logger.warning(f"Could not transfer YouTube queue: {e}")
            
            # ✅ Переносим UserToken (DonationAlerts и др.) с session_id
            try:
                from core.database import UserToken
                tokens = db.query(UserToken).filter(UserToken.session_id == guest_session_id).all()
                for token in tokens:
                    token.user_id = new_user.id
                    token.session_id = None
                if tokens:
                    logger.info(f"✅ Transferred {len(tokens)} tokens (DonationAlerts, etc)")
            except Exception as e:
                logger.warning(f"Could not transfer tokens: {e}")
            
            # ✅ Переносим Drops настройки с session_id
            try:
                from core.database import DropsConfig, DropsReward, UserStreak, DropsHistory, MythicalDropsSession
                # DropsConfig
                drops_configs = db.query(DropsConfig).filter(DropsConfig.session_id == guest_session_id).all()
                for config in drops_configs:
                    config.user_id = new_user.id
                    config.session_id = None
                if drops_configs:
                    logger.info(f"✅ Transferred {len(drops_configs)} Drops configs")
                
                # DropsReward
                drops_rewards = db.query(DropsReward).filter(DropsReward.session_id == guest_session_id).all()
                for reward in drops_rewards:
                    reward.user_id = new_user.id
                    reward.session_id = None
                if drops_rewards:
                    logger.info(f"✅ Transferred {len(drops_rewards)} Drops rewards")
                
                # UserStreak
                user_streaks = db.query(UserStreak).filter(UserStreak.session_id == guest_session_id).all()
                for streak in user_streaks:
                    streak.user_id = new_user.id
                    streak.session_id = None
                if user_streaks:
                    logger.info(f"✅ Transferred {len(user_streaks)} user streaks")
                
                # DropsHistory
                drops_history = db.query(DropsHistory).filter(DropsHistory.session_id == guest_session_id).all()
                for history in drops_history:
                    history.user_id = new_user.id
                    history.session_id = None
                if drops_history:
                    logger.info(f"✅ Transferred {len(drops_history)} Drops history entries")
                
                # MythicalDropsSession
                mythical_sessions = db.query(MythicalDropsSession).filter(MythicalDropsSession.session_id == guest_session_id).all()
                for session in mythical_sessions:
                    session.user_id = new_user.id
                    session.session_id = None
                if mythical_sessions:
                    logger.info(f"✅ Transferred {len(mythical_sessions)} mythical drop sessions")
            except Exception as e:
                logger.warning(f"Could not transfer Drops settings: {e}")
            
            # Завершаем ВСЕ гостевые сессии для этого канала
            channel_name = platform_user_id.lower()
            self.terminate_guest_sessions_for_channel(channel_name, "converted_to_authenticated")
            
            # Обновляем текущую сессию - меняем user_id с -1 на новый ID
            guest_session.user_id = new_user.id
            guest_session.device_info = {
                **guest_session.device_info,
                "converted_from_guest": True,
                "conversion_platform": platform,
                "conversion_timestamp": datetime.utcnow().isoformat()
            }
            
            db.commit()
            
            logger.info(f"✅ Converted guest session {guest_session_id} to authenticated user {new_user.id} with {platform} integration")
            
            return new_user
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error converting guest session to authenticated: {e}")
            raise
        finally:
            db.close()
    
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
    
    def terminate_guest_sessions_for_channel(self, channel_name: str, reason: str = "converted_to_authenticated"):
        """Завершает все гостевые сессии для канала при конвертации в авторизованную"""
        db = next(get_db())
        try:
            # Находим все гостевые сессии для этого канала из таблицы GuestSession
            guest_sessions = db.query(GuestSession).filter(
                GuestSession.channel_name == channel_name,
                GuestSession.is_active == True
            ).all()
            
            for session in guest_sessions:
                session.is_active = False
                logger.info(f"🔴 Terminated guest session {session.session_id} for channel {channel_name}: {reason}")
            
            db.commit()
            logger.info(f"✅ Terminated {len(guest_sessions)} guest sessions for channel {channel_name}")
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error terminating guest sessions: {e}")
            raise
        finally:
            db.close()
    
    def terminate_user_sessions_for_channel(self, user_id: int, channel_name: str, reason: str = "user_logout"):
        """Завершает все сессии пользователя для канала при логауте"""
        db = next(get_db())
        try:
            from sqlalchemy import text
            
            # PostgreSQL использует оператор ->> для извлечения JSON значений
            json_query = "device_info->>'monitored_channel' = :channel"
            
            user_sessions = db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active == True,
                text(json_query)
            ).params(channel=channel_name).all()
            
            for session in user_sessions:
                session.is_active = False
                session.ended_at = datetime.utcnow()
                session.device_info = {
                    **session.device_info,
                    "termination_reason": reason,
                    "terminated_at": datetime.utcnow().isoformat()
                }
                logger.info(f"Terminated user session {session.session_id} for channel {channel_name}: {reason}")
            
            db.commit()
            logger.info(f"Terminated {len(user_sessions)} user sessions for channel {channel_name}")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error terminating user sessions: {e}")
            raise
        finally:
            db.close()

    def save_user_tokens(self, user_id: int, platform: str, platform_user_id: str, 
                        avatar_url: str = None, access_token: str = None, 
                        refresh_token: str = None, expires_at: datetime = None, scopes: list = None):
        """
        Сохраняет или обновляет токены пользователя для платформы.
        Безопасность обеспечивается через is_active флаг и деактивацию при новом логине.
        """
        from core.token_encryption import encrypt_token
        
        db = next(get_db())
        try:
            logger.info(f"[SAVE] Saving tokens for user {user_id}, platform {platform}, platform_user_id {platform_user_id}")
            
            # Шифруем токены перед сохранением
            encrypted_access_token = encrypt_token(access_token) if access_token else None
            encrypted_refresh_token = encrypt_token(refresh_token) if refresh_token else None
            
            # Ищем существующий токен для этой платформы и пользователя
            existing_token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == platform
            ).first()
            
            # Проверяем все токены пользователя для диагностики
            all_user_tokens = db.query(UserToken).filter(UserToken.user_id == user_id).all()
            logger.info(f"[SAVE] User {user_id} currently has {len(all_user_tokens)} tokens in DB:")
            for t in all_user_tokens:
                logger.info(f"   - {t.platform}: platform_user_id={t.platform_user_id}, has_access_token={bool(t.access_token)}, is_active={getattr(t, 'is_active', 'N/A')}")
            
            if existing_token:
                logger.info(f"[REFRESH] Updating existing token for user {user_id}, platform {platform}")
                # Обновляем существующий токен
                existing_token.platform_user_id = platform_user_id
                existing_token.avatar_url = avatar_url
                existing_token.access_token = encrypted_access_token
                existing_token.refresh_token = encrypted_refresh_token
                existing_token.expires_at = expires_at
                existing_token.scopes = scopes
                if hasattr(existing_token, 'is_active'):
                    existing_token.is_active = True  # Активируем токен при повторной авторизации
            else:
                logger.info(f"🆕 Creating new token for user {user_id}, platform {platform}")
                # Создаем новый токен
                new_token = UserToken(
                    user_id=user_id,
                    platform=platform,
                    platform_user_id=platform_user_id,
                    avatar_url=avatar_url,
                    access_token=encrypted_access_token,
                    refresh_token=encrypted_refresh_token,
                    expires_at=expires_at,
                    scopes=scopes
                )
                db.add(new_token)
            
            db.commit()
            logger.info(f"[OK] Successfully saved tokens for user {user_id}, platform {platform}")
            
        except Exception as e:
            logger.error(f"[ERROR] Error saving tokens for user {user_id}: {e}")
            db.rollback()
            raise
        finally:
            db.close()

    def create_session(self, user_id: int, device_info: Optional[Dict] = None) -> str:
        """Создает новую сессию для пользователя, завершая все его предыдущие сессии."""
        logger.info(f"🔧 create_session called for user_id: {user_id}, device_info: {device_info}")
        db = next(get_db())
        try:
            logger.info(f"🔧 Terminating existing sessions for user {user_id}")
            self.terminate_user_sessions(user_id, "new_login", db)
            
            session_id = str(uuid.uuid4())
            logger.info(f"🔧 Generated session_id: {session_id}")
            
            logger.info(f"Creating session {session_id} for user {user_id} with device_info: {device_info}")
            
            # 🔐 БЕЗОПАСНОСТЬ: В сессии доступна только платформа, через которую залогинились
            login_platform = device_info.get('platform') if device_info else None
            if device_info and login_platform:
                device_info['linked_platforms'] = [login_platform]  # Только платформа логина!
                logger.info(f"🔐 Session created with ONLY {login_platform} platform access")
            
            new_session = UserSession(
                user_id=user_id,
                session_id=session_id,
                device_info=device_info or {},
                is_active=True
            )
            logger.info(f"🔧 Created UserSession object: {new_session}")
            
            logger.info(f"🔧 Adding session to database...")
            db.add(new_session)
            logger.info(f"🔧 Committing to database...")
            db.commit()
            logger.info(f"🔧 Database commit successful")
            
            # Обновляем объект из базы данных
            db.refresh(new_session)
            
            # Явно сбрасываем кеш для гарантии свежих данных
            db.expire_all()
            db.commit()
            
            # Проверяем, что сессия действительно создана
            logger.info(f"🔧 Verifying session creation in database...")
            created_session = db.query(UserSession).filter(UserSession.session_id == session_id).first()
            if created_session:
                logger.info(f"✅ Session {session_id} successfully created in database for user {user_id}")
                logger.info(f"✅ Session details: user_id={created_session.user_id}, is_active={created_session.is_active}")
            else:
                logger.error(f"❌ Failed to create session {session_id} in database for user {user_id}")
            
            logger.info(f"Created new session {session_id} for unified user {user_id}")
            return session_id
        except Exception as e:
            logger.error(f"❌ Error creating session for user {user_id}: {e}")
            logger.error(f"❌ Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            db.rollback()
            raise
        finally:
            db.close()
    
    def update_session(self, session_id: int, device_info: Optional[Dict] = None) -> bool:
        """Обновляет существующую сессию новыми данными"""
        logger.info(f"🔄 update_session called for session_id: {session_id}, device_info: {device_info}")
        db = next(get_db())
        try:
            session = db.query(UserSession).filter(UserSession.id == session_id).first()
            if not session:
                logger.warning(f"Session {session_id} not found")
                return False
            
            if device_info:
                session.device_info = device_info
            from datetime import datetime
            session.updated_at = datetime.utcnow()
            
            db.commit()
            logger.info(f"✅ Session {session_id} updated successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error updating session {session_id}: {e}")
            db.rollback()
            return False
        finally:
            db.close()

    def get_user_tokens(self, user_id: int, platform: str) -> Optional[Dict]:
        """Получает токены пользователя с расшифровкой"""
        from core.token_encryption import decrypt_token, is_token_encrypted
        
        db = next(get_db())
        try:
            token_record = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == platform
            ).first()
            
            if not token_record:
                return None
            
            # Расшифровываем токены
            access_token = token_record.access_token
            refresh_token = token_record.refresh_token
            
            # Проверяем, зашифрованы ли токены
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
        finally:
            db.close()

    def create_guest_session(self, channel_name: str, platform: str, device_info: Optional[Dict] = None) -> str:
        """Создает гостевую сессию в отдельной таблице GuestSession, завершая все предыдущие гостевые сессии для этого канала."""
        db = next(get_db())
        try:
            # Завершаем все предыдущие гостевые сессии для этого канала
            self.terminate_guest_sessions(channel_name, "new_guest_login", db)
            
            session_id = str(uuid.uuid4())
            
            # Создаем гостевую сессию в отдельной таблице GuestSession
            new_session = GuestSession(
                session_id=session_id,
                channel_name=channel_name,
                platform=platform,
                device_info=device_info or {},
                is_active=True
            )
            db.add(new_session)
            db.commit()
            
            logger.info(f"✅ Created new guest session {session_id} for channel {channel_name} on {platform}")
            
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
            logger.error(f"❌ Error creating guest session for channel {channel_name}: {e}")
            raise
        finally:
            db.close()

    def terminate_guest_sessions(self, channel_name: str, reason: str = "logout", db: Optional[Session] = None) -> None:
        """Завершает все гостевые сессии для указанного канала из таблицы GuestSession."""
        close_db = False
        if db is None:
            db = next(get_db())
            close_db = True
        
        try:
            # Находим все гостевые сессии для этого канала из таблицы GuestSession
            guest_sessions = db.query(GuestSession).filter(
                GuestSession.channel_name == channel_name,
                GuestSession.is_active == True
            ).all()
            
            if not guest_sessions:
                return

            for session in guest_sessions:
                session_id = session.session_id
                session.is_active = False
                logger.info(f"🔴 Terminated guest session {session_id} for channel {channel_name}, reason: {reason}")
                
                # Очищаем настройки гостя при завершении сессии
                if reason in ["logout", "user_logout", "disconnect"]:
                    try:
                        from core.database import (
                            UserSettings, TTSUserSettings, AudioSettings,
                            LocalTTSEndpoint, FilteredWord, TTSBlockedUser,
                            YouTubeQueue, UserToken, DropsConfig, DropsReward,
                            UserStreak, DropsHistory, MythicalDropsSession
                        )
                        
                        # Удаляем настройки гостя
                        deleted_count = 0
                        deleted_count += db.query(UserSettings).filter(UserSettings.session_id == session_id).delete()
                        deleted_count += db.query(TTSUserSettings).filter(TTSUserSettings.session_id == session_id).delete()
                        deleted_count += db.query(AudioSettings).filter(AudioSettings.session_id == session_id).delete()
                        deleted_count += db.query(LocalTTSEndpoint).filter(LocalTTSEndpoint.session_id == session_id).delete()
                        deleted_count += db.query(FilteredWord).filter(FilteredWord.session_id == session_id).delete()
                        deleted_count += db.query(TTSBlockedUser).filter(TTSBlockedUser.session_id == session_id).delete()
                        deleted_count += db.query(YouTubeQueue).filter(YouTubeQueue.session_id == session_id).delete()
                        deleted_count += db.query(UserToken).filter(UserToken.session_id == session_id).delete()
                        deleted_count += db.query(DropsConfig).filter(DropsConfig.session_id == session_id).delete()
                        deleted_count += db.query(DropsReward).filter(DropsReward.session_id == session_id).delete()
                        deleted_count += db.query(UserStreak).filter(UserStreak.session_id == session_id).delete()
                        deleted_count += db.query(DropsHistory).filter(DropsHistory.session_id == session_id).delete()
                        deleted_count += db.query(MythicalDropsSession).filter(MythicalDropsSession.session_id == session_id).delete()
                        
                        if deleted_count > 0:
                            logger.info(f"🧹 Cleaned up {deleted_count} guest settings records for session {session_id}")
                    except Exception as e:
                        logger.error(f"Error cleaning up guest settings for session {session_id}: {e}")
                        # Не прерываем процесс завершения сессии из-за ошибки очистки
            
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
            # Завершаем гостевые сессии из GuestSession
            guest_sessions = db.query(GuestSession).filter(
                GuestSession.channel_name == channel_name,
                GuestSession.is_active == True
            ).all()
            
            for session in guest_sessions:
                session.is_active = False
                logger.info(f"🔴 Terminated guest session {session.session_id} for channel {channel_name}, reason: {reason}")
            
            # Завершаем авторизованные сессии из UserSession
            all_sessions = db.query(UserSession).filter(
                UserSession.is_active == True
            ).all()
            
            # Фильтруем по каналу в device_info
            channel_sessions = []
            for session in all_sessions:
                if (session.device_info and 
                    session.device_info.get("monitored_channel") == channel_name):
                    channel_sessions.append(session)
            
            for session in channel_sessions:
                session.is_active = False
                logger.info(f"🔴 Terminated authorized session {session.session_id} for channel {channel_name}, reason: {reason}")
            
            db.commit()
            
            total_terminated = len(guest_sessions) + len(channel_sessions)
            logger.info(f"✅ Terminated {total_terminated} sessions ({len(guest_sessions)} guest + {len(channel_sessions)} authorized) for channel {channel_name}")
            
            # Отправка WebSocket уведомлений о завершении сессий
            try:
                import asyncio
                asyncio.create_task(self._notify_all_sessions_terminated_for_channel(channel_name, reason))
            except Exception as e:
                logger.error(f"Error sending WebSocket notification for channel {channel_name}: {e}")
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error terminating all sessions for channel {channel_name}: {e}")
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
            
            # Уведомление о завершении сессии (опционально)
            # WebSocket уведомления обрабатываются через connection_manager
            logger.info(f"Sessions terminated for user {user_id}, reason: {reason}")
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
            logger.info(f"[DELETE] Clearing {len(tokens)} tokens for user {user_id}")
            
            for token in tokens:
                logger.info(f"[DELETE] Removing {token.platform} token for {token.platform_user_id}")
            
            # Удаляем все токены пользователя
            deleted_count = db.query(UserToken).filter_by(user_id=user_id).delete()
            db.commit()
            
            logger.info(f"[OK] Successfully removed {deleted_count} tokens for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"[ERROR] Error clearing tokens for user {user_id}: {e}")
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
            
            logger.info(f"[DELETE] Removing {len(tokens)} {platform} tokens for user {user_id}")
            
            for token in tokens:
                logger.info(f"[DELETE] Removing {token.platform} token for {token.platform_user_id}")
            
            # Удаляем токены конкретной платформы
            deleted_count = db.query(UserToken).filter_by(user_id=user_id, platform=platform).delete()
            db.commit()
            
            logger.info(f"[OK] Successfully removed {deleted_count} {platform} tokens for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"[ERROR] Error removing {platform} tokens for user {user_id}: {e}")
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
        # Валидация session_id
        if not session_id or len(session_id) < 10:
            logger.warning(f"Invalid session_id format: {session_id}")
            return None
            
        db = next(get_db())
        try:
            # ВАЖНО: Обновляем сессию для получения последних данных из БД
            db.expire_all()
            db.commit()
            
            # Сначала проверяем в таблице GuestSession
            guest_session = db.query(GuestSession).filter_by(session_id=session_id, is_active=True).first()
            
            if guest_session:
                # Обновляем last_activity только если прошло больше 1 часа
                time_since_activity = datetime.utcnow() - guest_session.last_activity
                if time_since_activity > timedelta(hours=1):
                    guest_session.last_activity = datetime.utcnow()
                    db.commit()
                
                # Извлекаем платформу из GuestSession
                login_platform = guest_session.platform
                    
                return {
                    "user_id": -1,
                    "id": -1,
                    "session_id": session_id,  # 🔐 БЕЗОПАСНОСТЬ: Добавлен для проверки linked_platforms
                    "is_admin": False,
                    "is_blocked": False,
                    "blocked_reason": None,
                    "blocked_at": None,
                    "integrations": {},
                    "is_guest": True,
                    "device_info": guest_session.device_info,
                    "login_platform": login_platform
                }
            
            # Проверяем в таблице UserSession для авторизованных пользователей
            session = db.query(UserSession).filter_by(session_id=session_id, is_active=True).first()
            
            if not session:
                logger.debug(f"Invalid or inactive session: {session_id[:20]}...")
                return None
            
            # Сессия бесконечна - проверка таймаута отключена
            # Сессия завершается ТОЛЬКО при явном логауте или логине с другого устройства
            # Обновляем last_activity для статистики, но не проверяем таймаут
            time_since_activity = datetime.utcnow() - session.last_activity
            
            # Обновляем last_activity только если прошло больше 1 часа
            # Это предотвращает постоянные обновления базы данных
            # Сессия остается активной даже после закрытия браузера
            if time_since_activity > timedelta(hours=1):
                session.last_activity = datetime.utcnow()
                db.commit()
            
            user = db.query(User).filter_by(id=session.user_id).first()
            if not user:
                logger.warning(f"User not found for session {session_id[:20]}... user_id={session.user_id}")
                return None
            
            # ИНТЕГРАЦИИ НЕ ВКЛЮЧАЕМ В СЕССИЮ - они будут проверяться через API с валидацией токенов
            # Извлекаем платформу из device_info для проверки whitelist
            login_platform = None
            if session.device_info and isinstance(session.device_info, dict):
                login_platform = session.device_info.get('platform')
            
            return {
                "user_id": user.id,
                "id": user.id,
                "session_id": session_id,  # 🔐 БЕЗОПАСНОСТЬ: Добавлен для проверки linked_platforms
                "is_admin": user.is_admin,
                "is_blocked": user.is_blocked,
                "blocked_reason": user.blocked_reason,
                "blocked_at": user.blocked_at,
                "integrations": {},  # Пустые интеграции - проверяются через API
                "login_platform": login_platform  # Платформа, через которую пользователь авторизовался
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
            
            logger.info(f"[DELETE] Clearing ALL {len(tokens)} tokens for user {user_id} on logout:")
            
            for token in tokens:
                logger.info(f"[DELETE] Removing {token.platform} token for {token.platform_user_id}")
            
            # Удаляем ВСЕ токены пользователя
            deleted_count = db.query(UserToken).filter_by(user_id=user_id).delete()
            db.commit()
            
            # Проверяем что токены действительно удалены
            remaining_tokens = db.query(UserToken).filter_by(user_id=user_id).all()
            if remaining_tokens:
                logger.error(f"❌ [LOGOUT ERROR] {len(remaining_tokens)} tokens still remain after deletion for user {user_id}!")
                for token in remaining_tokens:
                    logger.error(f"   - Remaining token: platform={token.platform}, platform_user_id={token.platform_user_id}")
            else:
                logger.info(f"✅ [LOGOUT VERIFIED] All tokens deleted for user {user_id}")
            
            logger.info(f"[OK] Successfully cleared {deleted_count} tokens for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"[ERROR] Error clearing all tokens for user {user_id}: {e}")
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
            
            # Расшифровываем токены
            from core.token_encryption import decrypt_token, is_token_encrypted
            
            access_token = token.access_token
            refresh_token = token.refresh_token
            
            if access_token and is_token_encrypted(access_token):
                access_token = decrypt_token(access_token)
            if refresh_token and is_token_encrypted(refresh_token):
                refresh_token = decrypt_token(refresh_token)
            
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "expires_at": token.expires_at,
                "platform_user_id": token.platform_user_id,
                "avatar_url": token.avatar_url,
                "scopes": token.scopes or []
            }
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

    def cleanup_old_sessions(self, days_old: int = 7) -> int:
        """Удаляет старые неактивные сессии старше указанного количества дней и связанные настройки."""
        db = next(get_db())
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            
            # Находим старые неактивные сессии
            old_sessions = db.query(UserSession).filter(
                UserSession.is_active == False,
                UserSession.last_activity < cutoff_date
            ).all()
            
            count = len(old_sessions)
            if count > 0:
                from core.database import (
                    UserSettings, TTSUserSettings, AudioSettings,
                    LocalTTSEndpoint, FilteredWord, TTSBlockedUser,
                    YouTubeQueue, UserToken, DropsConfig, DropsReward,
                    UserStreak, DropsHistory, MythicalDropsSession
                )
                
                total_settings_deleted = 0
                
                # Удаляем старые сессии и связанные настройки
                for session in old_sessions:
                    session_id = session.session_id
                    is_guest = session.user_id == -1
                    
                    # Для гостевых сессий удаляем все связанные настройки
                    if is_guest:
                        total_settings_deleted += db.query(UserSettings).filter(UserSettings.session_id == session_id).delete()
                        total_settings_deleted += db.query(TTSUserSettings).filter(TTSUserSettings.session_id == session_id).delete()
                        total_settings_deleted += db.query(AudioSettings).filter(AudioSettings.session_id == session_id).delete()
                        total_settings_deleted += db.query(LocalTTSEndpoint).filter(LocalTTSEndpoint.session_id == session_id).delete()
                        total_settings_deleted += db.query(FilteredWord).filter(FilteredWord.session_id == session_id).delete()
                        total_settings_deleted += db.query(TTSBlockedUser).filter(TTSBlockedUser.session_id == session_id).delete()
                        total_settings_deleted += db.query(YouTubeQueue).filter(YouTubeQueue.session_id == session_id).delete()
                        total_settings_deleted += db.query(UserToken).filter(UserToken.session_id == session_id).delete()
                        total_settings_deleted += db.query(DropsConfig).filter(DropsConfig.session_id == session_id).delete()
                        total_settings_deleted += db.query(DropsReward).filter(DropsReward.session_id == session_id).delete()
                        total_settings_deleted += db.query(UserStreak).filter(UserStreak.session_id == session_id).delete()
                        total_settings_deleted += db.query(DropsHistory).filter(DropsHistory.session_id == session_id).delete()
                        total_settings_deleted += db.query(MythicalDropsSession).filter(MythicalDropsSession.session_id == session_id).delete()
                    
                    # Удаляем саму сессию
                    db.delete(session)
                
                db.commit()
                logger.info(f"[BROOM] Cleaned up {count} old inactive sessions (older than {days_old} days)")
                if total_settings_deleted > 0:
                    logger.info(f"[BROOM] Also deleted {total_settings_deleted} associated guest settings records")
            else:
                logger.debug(f"No old sessions to clean up (older than {days_old} days)")
            
            return count
            
        except Exception as e:
            logger.error(f"Error cleaning up old sessions: {e}")
            db.rollback()
            return 0
        finally:
            db.close()

    def get_session_stats(self) -> dict:
        """Возвращает статистику по сессиям."""
        db = next(get_db())
        try:
            total_sessions = db.query(UserSession).count()
            active_sessions = db.query(UserSession).filter(UserSession.is_active == True).count()
            inactive_sessions = total_sessions - active_sessions
            
            # Старые неактивные сессии (старше 7 дней)
            cutoff_date = datetime.utcnow() - timedelta(days=7)
            old_inactive = db.query(UserSession).filter(
                UserSession.is_active == False,
                UserSession.last_activity < cutoff_date
            ).count()
            
            return {
                "total_sessions": total_sessions,
                "active_sessions": active_sessions,
                "inactive_sessions": inactive_sessions,
                "old_inactive_sessions": old_inactive
            }
            
        except Exception as e:
            logger.error(f"Error getting session stats: {e}")
            return {}
        finally:
            db.close()

session_manager = SessionManager()
