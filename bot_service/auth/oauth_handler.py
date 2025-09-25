"""
Общий OAuth handler для унификации логики авторизации между платформами
"""
import logging
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from core.database import User
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
    platform_display_name: str
    avatar_url: Optional[str]
    access_token: str
    refresh_token: Optional[str]
    expires_at: Optional[datetime]
    scopes: Optional[list]

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
            self.connection_manager = get_connection_manager()
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
            
            if is_linking:
                # Сценарий привязки: пользователь уже авторизован
                logger.info(f"User {current_user['id']} is linking their {platform} account.")
                unified_user = db.query(User).filter(User.id == current_user['id']).first()
                
                if not unified_user:
                    raise HTTPException(
                        status_code=HTTP_STATUS.BAD_REQUEST, 
                        detail=ErrorMessages.USER_NOT_FOUND
                    )
            else:
                # Сценарий нового входа или существующего пользователя
                logger.info(f"New login or existing user for {platform} ID {user_data.platform_user_id}.")
                unified_user = session_manager.create_or_get_user_by_platform(
                    platform=platform,
                    platform_user_id=user_data.platform_user_id,
                    platform_display_name=user_data.platform_display_name,
                    avatar_url=user_data.avatar_url,
                    db=db
                )
            
            if not unified_user:
                raise HTTPException(
                    status_code=HTTP_STATUS.INTERNAL_SERVER_ERROR, 
                    detail=ErrorMessages.USER_CREATION_FAILED
                )
            
            # Сохраняем токены пользователя
            session_manager.save_user_tokens(
                user_id=unified_user.id,
                platform=platform,
                platform_user_id=user_data.platform_user_id,
                platform_display_name=user_data.platform_display_name,
                avatar_url=user_data.avatar_url,
                access_token=user_data.access_token,
                refresh_token=user_data.refresh_token,
                expires_at=user_data.expires_at,
                scopes=user_data.scopes
            )
            
            # Определяем нужно ли создавать новую сессию
            session_id = None
            is_new_session = False
            
            if not is_linking:
                # Для нового входа создаем сессию
                is_new_session = True
                
                # Завершаем предыдущие сессии для этого канала
                session_manager.terminate_all_sessions_for_channel(
                    channel_name=user_data.platform_display_name.lower(),
                    reason=f"new_{platform}_login"
                )
                
                # Создаем новую сессию
                session_id = session_manager.create_session(
                    user_id=unified_user.id,
                    device_info={
                        "user_agent": request.headers.get("user-agent"), 
                        "ip": getattr(request.client, 'host', 'unknown'),
                        "guest_channel": user_data.platform_display_name.lower()
                    }
                )
                
                # Уведомляем connection_manager о новой активной сессии
                try:
                    connection_manager = self._get_connection_manager()
                    connection_manager.add_active_session(user_data.platform_display_name, session_id)
                except Exception as e:
                    logger.error(f"Error notifying connection_manager about new session: {e}")
                
                # Автоматически подключаем бота если требуется
                if auto_connect_bot:
                    await self._auto_connect_bot(platform, user_data.platform_display_name)
            
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
            connection_manager = self._get_connection_manager()
            
            logger.info(f"🤖 Attempting auto-connect for {platform} bot to channel {channel_name}")
            
            # Проверяем, есть ли активные сессии для этого канала
            has_sessions = connection_manager.has_active_sessions(channel_name)
            logger.info(f"🔍 Active sessions for {channel_name}: {has_sessions}")
            
            if not has_sessions:
                logger.info(f"❌ No active sessions for channel {channel_name}, skipping bot connection")
                return
            
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
        """Подключение VK Live бота"""
        try:
            import os
            from bots.vk_live_bot import VKLiveBot
            
            # Импортируем глобальные переменные
            from main import vk_live_bot_instance, vk_live_bot_task
            import main
            
            vk_token = os.getenv("VK_LIVE_USER_TOKEN")
            if not vk_token:
                logger.warning("VK_LIVE_USER_TOKEN not configured, skipping auto-connect")
                return
            
            if not main.vk_live_bot_instance:
                logger.info("Creating new VK Live bot instance for auto-connect...")
                connection_manager = self._get_connection_manager()
                main.vk_live_bot_instance = VKLiveBot(vk_token, connection_manager)
                
                import asyncio
                main.vk_live_bot_task = asyncio.create_task(main.vk_live_bot_instance.start_bot())
                await asyncio.sleep(2)  # Ждем подключения
                
                logger.info(f"VK Live bot successfully auto-connected to {channel_name}")
            else:
                logger.info(f"VK Live bot already running for {channel_name}")
                
        except Exception as e:
            logger.error(f"Error connecting VK Live bot: {e}")

# Глобальный экземпляр OAuth handler
oauth_handler = OAuthHandler()
