"""
Общий OAuth handler для унификации логики авторизации между платформами
"""
import logging
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from core.database import User, UserSession, UserToken
from core.session_manager import session_manager
from constants import (
    Platform, ErrorMessages, SuccessMessages, 
    FRONTEND_REDIRECTS, SESSION_MAX_AGE_SECONDS,
    HTTP_STATUS
)
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class OAuthUserData:
    """Структура данных пользователя, полученных от OAuth провайдера"""
    platform_user_id: str
    avatar_url: Optional[str]
    access_token: str
    refresh_token: Optional[str]
    expires_at: Optional[datetime]
    scopes: Optional[list]
    username: Optional[str] = None
    channel_name: Optional[str] = None  # Для VK Live - имя канала отдельно от username

@dataclass
class OAuthResult:
    """Результат OAuth авторизации"""
    user: User
    session_id: Optional[str]
    is_new_session: bool
    redirect_url: str

class OAuthHandler:
    """Универсальный обработчик OAuth для всех платформ"""
    
    def __init__(self):
        self.connection_manager = None
        # Импортируем connection_manager только при необходимости для избежания циклических импортов
    
    def _get_connection_manager(self):
        """Ленивая загрузка connection_manager"""
        if self.connection_manager is None:
            from core.connection_manager import get_connection_manager
            connection_manager = get_connection_manager()
            self.connection_manager = connection_manager
        return self.connection_manager
    
    async def handle_oauth_callback(
        self,
        request: Request,
        db: Session,
        platform: str,
        user_data: OAuthUserData,
        current_user: Optional[Dict] = None,
        auto_connect_bot: bool = True
    ) -> OAuthResult:
        """
        Общая логика обработки OAuth callback для любой платформы
        
        Args:
            request: FastAPI Request объект
            db: Database session
            platform: Название платформы (twitch, vk, etc.)
            user_data: Данные пользователя от OAuth провайдера
            current_user: Текущий авторизованный пользователь (для linking)
            auto_connect_bot: Автоматически подключать бота после авторизации
            
        Returns:
            OAuthResult с информацией о пользователе и редиректе
        """
        try:
            # Определяем сценарий: новый вход или привязка аккаунта
            unified_user = None
            is_linking = current_user is not None
            guest_session = None  # Инициализируем переменную
            
            # Централизованная проверка отпечатков платформ
            platform_fingerprint = f"{platform}:{user_data.platform_user_id}"
            logger.info(f"Checking platform fingerprint: {platform_fingerprint}")
            
            # Ищем существующие токены этой платформы
            existing_tokens = db.query(UserToken).filter(
                UserToken.platform == platform,
                UserToken.platform_user_id == user_data.platform_user_id
            ).all()
            
            # Инициализируем переменные
            existing_token = None
            current_user_id = current_user.get('id') if current_user else None
            
            # Ищем активную гостевую сессию
            guest_session = db.query(UserSession).filter(
                UserSession.user_id == -1,
                UserSession.is_active == True
            ).first()
            
            # === СТРОГАЯ ЛОГИКА ЗАМЕЩЕНИЯ СЕССИЙ БЕЗ ДУБЛИРОВАНИЯ ===
            
            # 1. ПРОВЕРЯЕМ: Есть ли активная сессия для этого канала?
            # Для Twitch используем username вместо ID
            channel_name = user_data.username.lower() if user_data.username else user_data.platform_user_id.lower()
            from sqlalchemy import text
            active_session = db.query(UserSession).filter(
                UserSession.is_active == True,
                text("JSON_EXTRACT(device_info, '$.monitored_channel') = :channel")
            ).params(channel=channel_name).first()
            
            if active_session:
                logger.info(f"Found active session {active_session.session_id} for channel {channel_name}")
                
                # Если активная сессия принадлежит гостю (user_id = -1)
                if active_session.user_id == -1:
                    logger.info(f"Active session is guest session, converting to authenticated")
                    
                    # Конвертируем гостевую сессию в авторизованную
                    unified_user = session_manager.convert_guest_to_authenticated(
                        guest_session_id=active_session.session_id,
                        platform=platform,
                        platform_user_id=user_data.platform_user_id,
                        avatar_url=user_data.avatar_url,
                        access_token=user_data.access_token,
                        refresh_token=user_data.refresh_token,
                        expires_at=user_data.expires_at,
                        scopes=user_data.scopes,
                        username=getattr(user_data, 'username', None)
                    )
                    
                # Если активная сессия принадлежит авторизованному пользователю
                else:
                    existing_user = db.query(User).filter(User.id == active_session.user_id).first()
                    
                    if is_linking and current_user and existing_user.id != current_user['id']:
                        # Сценарий: пользователь пытается привязать платформу, которая уже обслуживает канал
                        logger.warning(f"Channel {channel_name} already served by user {existing_user.id}, replacing session")
                        
                        # Завершаем старую сессию
                        active_session.is_active = False
                        active_session.ended_at = datetime.utcnow()
                        
                        # Создаем новую сессию для текущего пользователя
                        device_info = {
                            "user_agent": request.headers.get("user-agent"),
                            "ip": getattr(request.client, 'host', 'unknown'),
                            "monitored_channel": channel_name,
                            "platform": platform,
                            "replaced_session": active_session.session_id
                        }
                        
                        new_session_id = session_manager.create_session(
                            user_id=current_user['id'],
                            device_info=device_info
                        )
                        
                        # Объединяем аккаунты если нужно
                        if existing_user.id != current_user['id']:
                            session_manager._merge_user_accounts(existing_user.id, current_user['id'], db)
                            db.delete(existing_user)
                        
                        unified_user = db.query(User).filter(User.id == current_user['id']).first()
                        logger.info(f"Replaced session for channel {channel_name}")
                        
                    else:
                        # Обновляем токены существующего пользователя
                        logger.info(f"Updating tokens for existing user {existing_user.id}")
                        unified_user = existing_user
                        
                        # Обновляем токены
                        existing_token = db.query(UserToken).filter(
                            UserToken.user_id == existing_user.id,
                            UserToken.platform == platform
                        ).first()
                        
                        if existing_token:
                            existing_token.access_token = user_data.access_token
                            existing_token.refresh_token = user_data.refresh_token
                            existing_token.expires_at = user_data.expires_at
                            existing_token.scopes = user_data.scopes
                            existing_token.avatar_url = user_data.avatar_url
                        else:
                            # Создаем новый токен
                            session_manager.save_user_tokens(
                                user_id=existing_user.id,
                                platform=platform,
                                platform_user_id=user_data.platform_user_id,
                                avatar_url=user_data.avatar_url,
                                access_token=user_data.access_token,
                                refresh_token=user_data.refresh_token,
                                expires_at=user_data.expires_at,
                                scopes=user_data.scopes
                            )
                        
                        # Обновляем username
                        if platform == "twitch" and hasattr(user_data, 'username'):
                            unified_user.twitch_username = user_data.username
                        elif platform == "vk" and hasattr(user_data, 'username') and user_data.username:
                            # Для VK сохраняем channel_name (ник канала для подключения бота)
                            unified_user.vk_channel_name = user_data.username
                            # Также сохраняем в vk_username для обратной совместимости
                            unified_user.vk_username = user_data.username
                            logger.info(f"Updated VK channel_name: {user_data.username}")
                        
                        db.commit()
                        logger.info(f"Updated {platform} tokens for user {unified_user.id}")
            
            # 2. НЕТ АКТИВНОЙ СЕССИИ - создаем новую
            else:
                if is_linking and current_user:
                    # Привязка к существующему пользователю
                    logger.info(f"Linking {platform} to existing user {current_user['id']}")
                    unified_user = db.query(User).filter(User.id == current_user['id']).first()
                    
                    if not unified_user:
                        raise HTTPException(
                            status_code=HTTP_STATUS.BAD_REQUEST, 
                            detail=ErrorMessages.USER_NOT_FOUND
                        )
                    
                    # Сохраняем токены
                    session_manager.save_user_tokens(
                        user_id=unified_user.id,
                        platform=platform,
                        platform_user_id=user_data.platform_user_id,
                        avatar_url=user_data.avatar_url,
                        access_token=user_data.access_token,
                        refresh_token=user_data.refresh_token,
                        expires_at=user_data.expires_at,
                        scopes=user_data.scopes
                    )
                    
                    # Обновляем username
                    if platform == "twitch" and hasattr(user_data, 'username'):
                        unified_user.twitch_username = user_data.username
                    elif platform == "vk" and hasattr(user_data, 'username') and user_data.username:
                        # Для VK сохраняем channel_name (ник канала для подключения бота)
                        unified_user.vk_channel_name = user_data.username
                        # Также сохраняем в vk_username для обратной совместимости
                        unified_user.vk_username = user_data.username
                        logger.info(f"Updated VK channel_name: {user_data.username}")
                    
                    # 🔐 БЕЗОПАСНОСТЬ: Добавляем платформу в текущую сессию
                    session_id_from_cookie = request.cookies.get('session_id')
                    if session_id_from_cookie:
                        session_manager.link_platform_to_session(session_id_from_cookie, platform, db)
                    else:
                        logger.warning(f"⚠️ No session_id in cookies, cannot link platform {platform}")
                    
                    db.commit()
                    logger.info(f"Added {platform} integration to user {unified_user.id}")
                    
                else:
                    # Создаем нового пользователя через централизованный сервис
                    logger.info(f"Creating new user for {platform} ID {user_data.platform_user_id}")
                    from core.user_creation_service import user_creation_service
                    
                    unified_user = await user_creation_service.find_or_create_user(
                        db=db,
                        platform=platform,
                        platform_user_id=user_data.platform_user_id,
                        username=user_data.username,
                        avatar_url=user_data.avatar_url,
                        access_token=user_data.access_token,
                        refresh_token=user_data.refresh_token,
                        expires_at=user_data.expires_at,
                        scopes=user_data.scopes,
                        current_user_id=current_user.get('id') if current_user else None,
                        is_admin=False
                    )
            
            if not unified_user:
                raise HTTPException(
                    status_code=HTTP_STATUS.INTERNAL_SERVER_ERROR, 
                    detail=ErrorMessages.USER_CREATION_FAILED
                )
            
            # Сохраняем токены пользователя (save_user_tokens автоматически обновляет существующие или создаёт новые)
            # Пропускаем только если это конвертация гостевой сессии
            if not (guest_session and guest_session.session_id):
                logger.info(f"💾 Saving OAuth tokens for user {unified_user.id}, platform {platform}")
                session_manager.save_user_tokens(
                    user_id=unified_user.id,
                    platform=platform,
                    platform_user_id=user_data.platform_user_id,
                    avatar_url=user_data.avatar_url,
                    access_token=user_data.access_token,
                    refresh_token=user_data.refresh_token,
                    expires_at=user_data.expires_at,
                    scopes=user_data.scopes
                )
                logger.info(f"✅ OAuth tokens saved for user {unified_user.id}, platform {platform}")
                
                # Сохраняем username в соответствующее поле пользователя
                if platform == "twitch" and hasattr(user_data, 'username'):
                    logger.info(f"Saving Twitch username: {user_data.username}")
                    unified_user.twitch_username = user_data.username
                elif platform == "vk" and hasattr(user_data, 'username') and user_data.username:
                    # Для VK сохраняем channel_name (ник канала для подключения бота)
                    logger.info(f"Saving VK channel_name: {user_data.username}")
                    unified_user.vk_channel_name = user_data.username
                    # Также сохраняем в vk_username для обратной совместимости
                    unified_user.vk_username = user_data.username
                
                db.commit()
                logger.info(f"User {unified_user.id} updated with {platform} username: {getattr(unified_user, f'{platform}_username', 'None')}")
            
            # Определяем нужно ли создавать новую сессию
            session_id = None
            is_new_session = False
            
            if not is_linking:
                # Для нового входа создаем сессию
                is_new_session = True
                
                if guest_session and hasattr(guest_session, 'session_id'):
                    # Используем существующую сессию (уже обновленную в convert_guest_to_authenticated)
                    session_id = guest_session.session_id
                    logger.info(f"Using existing converted session: {session_id}")
                elif existing_token:
                    # ВАЖНО: При входе с нового устройства завершаем ВСЕ старые сессии пользователя
                    logger.info(f"🔒 New login detected for user {unified_user.id}. Terminating ALL old sessions...")
                    session_manager.terminate_user_sessions(unified_user.id, "new_device_login", db)
                    logger.info(f"✅ All old sessions terminated. Creating new session...")
                    
                    # Создаем новую сессию для существующего пользователя
                    # Для Twitch используем username вместо ID для monitored_channel
                    monitored_channel = user_data.username.lower() if user_data.username else user_data.platform_user_id.lower()
                    device_info = {
                        "user_agent": request.headers.get("user-agent"), 
                        "ip": getattr(request.client, 'host', 'unknown'),
                        "monitored_channel": monitored_channel,
                        "platform": platform
                    }
                    session_id = session_manager.create_session(
                        user_id=unified_user.id,
                        device_info=device_info
                    )
                    logger.info(f"✅ New session created: {session_id}")
                else:
                    # Завершаем ВСЕ предыдущие сессии пользователя (принцип одной активной сессии)
                    logger.info(f"🔒 New user login. Terminating all sessions for user {unified_user.id}...")
                    session_manager.terminate_user_sessions(unified_user.id, "new_login", db)
                    
                    # Создаем новую сессию
                    # Для Twitch используем username вместо ID для monitored_channel
                    monitored_channel = user_data.username.lower() if user_data.username else user_data.platform_user_id.lower()
                    device_info = {
                        "user_agent": request.headers.get("user-agent"), 
                        "ip": getattr(request.client, 'host', 'unknown'),
                        "monitored_channel": monitored_channel,
                        "platform": platform
                    }
                    logger.info(f"Creating session with device_info: {device_info}")
                    session_id = session_manager.create_session(
                        user_id=unified_user.id,
                        device_info=device_info
                    )
                
                # Уведомляем connection_manager о новой активной сессии
                try:
                    from core.connection_manager import get_connection_manager
                    connection_manager = get_connection_manager()
                    # Для Twitch используем username вместо ID
                    channel_identifier = user_data.username if user_data.username else user_data.platform_user_id
                    connection_manager.add_active_session(channel_identifier, session_id)
                except Exception as e:
                    logger.error(f"Error notifying connection_manager about new session: {e}")
                
                # Устанавливаем channel_name в UserSettings для автоматического подключения бота
                await self._setup_user_channel_settings(db, unified_user.id, platform, user_data)
                
                # Автоматически подключаем бота если требуется
                if auto_connect_bot:
                    logger.info(f"🤖 [AUTO-CONNECT] Starting auto-connect bot for platform={platform}")
                    # Для Twitch используем username вместо ID
                    channel_identifier = user_data.username if user_data.username else user_data.platform_user_id
                    logger.info(f"🤖 [AUTO-CONNECT] Channel identifier: {channel_identifier}")
                    await self._auto_connect_bot(platform, channel_identifier)
                    logger.info(f"🤖 [AUTO-CONNECT] Auto-connect completed for {platform}:{channel_identifier}")
                else:
                    logger.info(f"ℹ️ Auto-connect disabled for {platform}")
            
            # Определяем URL для редиректа
            redirect_url = self._get_redirect_url(platform, is_linking, is_new_session)
            
            return OAuthResult(
                user=unified_user,
                session_id=session_id,
                is_new_session=is_new_session,
                redirect_url=redirect_url
            )
            
        except HTTPException:
            # Перебрасываем HTTP исключения как есть
            raise
        except Exception as e:
            logger.error(f"{platform.title()} auth error: {e}", exc_info=True)
            raise HTTPException(
                status_code=HTTP_STATUS.INTERNAL_SERVER_ERROR, 
                detail=f"Internal server error during {platform} authentication"
            )
    
    def create_oauth_response(self, oauth_result: OAuthResult) -> RedirectResponse:
        """
        Создает RedirectResponse с правильными cookies
        
        Args:
            oauth_result: Результат OAuth авторизации
            
        Returns:
            RedirectResponse с установленными cookies
        """
        response = RedirectResponse(url=oauth_result.redirect_url)
        
        if oauth_result.session_id:
            response.set_cookie(
                key="session_id", 
                value=oauth_result.session_id, 
                httponly=True,
                secure=False,  # В продакшене должно быть True
                samesite="lax",
                path="/",  # Явно указываем путь
                max_age=SESSION_MAX_AGE_SECONDS
            )
        
        return response
    

    def _get_redirect_url(self, platform: str, is_linking: bool, is_new_session: bool) -> str:
        """
        Определяет URL для редиректа на основе сценария авторизации
        """
        if is_linking:
            # Привязка аккаунта - всегда редирект в дашборд с уведомлением
            return f"{FRONTEND_REDIRECTS['dashboard']}?auth_link={platform}&success=1"
        else:
            # Новый вход - редирект в дашборд
            return f"{FRONTEND_REDIRECTS['dashboard']}?auth={platform}&success=1"
    
    async def _auto_connect_bot(self, platform: str, channel_name: str) -> None:
        """
        Автоматическое подключение бота к каналу после авторизации
        
        Args:
            platform: Название платформы
            channel_name: Имя канала
        """
        try:
            from core.connection_manager import get_connection_manager
            connection_manager = get_connection_manager()
            
            logger.info(f"🤖 Attempting auto-connect for {platform} bot to channel {channel_name}")
            
            # Проверяем, есть ли активные сессии для этого канала
            has_sessions = connection_manager.is_channel_active(channel_name)
            logger.info(f"🔍 Active sessions for {channel_name}: {has_sessions}")
            
            # УБИРАЕМ проверку активных сессий - подключаем бота всегда после OAuth
            # if not has_sessions:
            #     logger.info(f"❌ No active sessions for channel {channel_name}, skipping bot connection")
            #     return
            
            if platform == Platform.TWITCH:
                logger.info(f"🎮 Connecting Twitch bot to {channel_name}")
                await self._connect_twitch_bot(channel_name)
            elif platform == Platform.VK:
                logger.info(f"📺 Connecting VK Live bot to {channel_name}")
                await self._connect_vk_bot(channel_name)
            else:
                logger.warning(f"⚠️ Auto-connect not implemented for platform: {platform}")
                
        except Exception as e:
            logger.error(f"❌ Error auto-connecting {platform} bot to {channel_name}: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Не прерываем авторизацию из-за ошибки бота
    
    async def _connect_twitch_bot(self, channel_name: str) -> None:
        """Подключение Twitch бота"""
        try:
            # Импортируем глобальные переменные
            from main import bot_instance
            
            if bot_instance:
                logger.info(f"🔗 Bot instance exists, attempting to join channel: {channel_name}")
                success = await bot_instance.join_channel(channel_name)
                if success:
                    logger.info(f"✅ Twitch bot successfully connected to {channel_name} via OAuth")
                else:
                    logger.warning(f"❌ Failed to connect Twitch bot to {channel_name} via OAuth")
            else:
                logger.error("❌ Twitch bot instance not found. Bot was not created at startup.")
                    
        except Exception as e:
            logger.error(f"❌ Error connecting Twitch bot during OAuth: {e}")
    
    async def _connect_vk_bot(self, channel_name: str) -> None:
        """Подключение VK Live бота к каналу пользователя после OAuth"""
        try:
            # Импортируем глобальные переменные
            import main
            
            if not main.vk_live_bot_instance:
                logger.error("❌ VK Live bot instance not found! Bot should be initialized at startup.")
                return
            
            logger.info(f"🔗 VK bot instance exists, attempting to connect to channel: {channel_name}")
            
            # Подключаемся к каналу пользователя через HTTP polling
            success = await main.vk_live_bot_instance.connect_to_channel(channel_name)
            
            if success:
                logger.info(f"✅ VK Live bot successfully connected to {channel_name} via OAuth")
            else:
                logger.warning(f"❌ Failed to connect VK Live bot to {channel_name} via OAuth")
                
        except Exception as e:
            logger.error(f"Error connecting VK Live bot: {e}")

    async def _setup_user_channel_settings(self, db: Session, user_id: int, platform: str, user_data: OAuthUserData) -> None:
        """Настройка channel_name в UserSettings для автоматического подключения бота"""
        try:
            from core.database import UserSettings
            
            # Получаем или создаем настройки пользователя
            settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
            if not settings:
                settings = UserSettings(
                    user_id=user_id,
                    chat_enabled=True  # Чат включен по умолчанию
                )
                db.add(settings)
                db.flush()  # Получаем ID без коммита
            
            # Устанавливаем channel_name в зависимости от платформы
            if platform == "twitch":
                # Для Twitch используем username (логин канала)
                channel_name = user_data.username.lower()
                settings.channel_name = channel_name
                logger.info(f"✅ Set Twitch channel_name: {channel_name}")
            elif platform == "vk":
                # Для VK Live используем platform_user_id
                channel_name = user_data.platform_user_id.lower()
                settings.vk_channel_name = channel_name
                logger.info(f"✅ Set VK channel_name: {channel_name}")
            
            db.commit()
            logger.info(f"✅ UserSettings updated for user {user_id}, platform {platform}")
            
        except Exception as e:
            logger.error(f"Error setting up user channel settings: {e}")
            db.rollback()

# Глобальный экземпляр OAuth handler
oauth_handler = OAuthHandler()
