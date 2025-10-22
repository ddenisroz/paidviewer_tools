# bot_service/core/auth_handlers.py
"""Обработчики аутентификации"""
from __future__ import annotations
import os
import logging
from fastapi import HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from core.database import get_db, User, UserToken
from core.datetime_utils import utcnow_naive
from auth.auth import get_current_user
from services.user_identity_service import UserIdentityService, UserType
from auth.oauth_handler import oauth_handler, OAuthUserData
from api.twitch_api import TwitchAPI
from core.connection_manager import get_connection_manager

logger = logging.getLogger(__name__)

class AuthHandlers:
    """Класс для обработки аутентификации"""
    
    def __init__(self):
        connection_manager = get_connection_manager()
        self.twitch_api = TwitchAPI(connection_manager)
    
    async def twitch_login(self):
        """Twitch OAuth login"""
        client_id = os.getenv("TWITCH_CLIENT_ID")
        from constants import DEFAULT_BACKEND_URL
        redirect_uri = f"{os.getenv('BACKEND_URL', DEFAULT_BACKEND_URL)}/auth/twitch/callback"
        scope = "user:read:email channel:manage:broadcast"
        
        auth_url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
        return RedirectResponse(url=auth_url)
    
    async def api_twitch_login(self):
        """API endpoint для Twitch login"""
        client_id = os.getenv("TWITCH_CLIENT_ID")
        from constants import DEFAULT_BACKEND_URL
        redirect_uri = f"{os.getenv('BACKEND_URL', DEFAULT_BACKEND_URL)}/auth/twitch/callback"
        scope = "user:read:email channel:manage:broadcast"
        
        auth_url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
        return {"auth_url": auth_url}
    
    async def api_twitch_auth(self):
        """API endpoint для Twitch auth"""
        client_id = os.getenv("TWITCH_CLIENT_ID")
        from constants import DEFAULT_BACKEND_URL
        redirect_uri = f"{os.getenv('BACKEND_URL', DEFAULT_BACKEND_URL)}/auth/twitch/callback"
        scope = "user:read:email channel:manage:broadcast"
        
        auth_url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
        return {"auth_url": auth_url}
    
    async def twitch_callback(self, code: str, request: Request, db: Session = Depends(get_db)):
        """Twitch OAuth callback"""
        try:
            logger.info(f"Twitch callback - code: {code[:10]}...")
            
            # Получаем текущую сессию (если есть)
            session_id = request.cookies.get("session_id")
            current_user_from_session = None
            if session_id:
                from core.session_manager import session_manager
                session_data = session_manager.validate_session(session_id)
                if session_data:
                    current_user_from_session = session_data
                    logger.info(f"Found existing session for user_id: {session_data.get('user_id')}")
            
            # Получаем токен доступа
            logger.info("Getting access token from Twitch...")
            token_data = await self.twitch_api.get_user_access_token(code)
            
            if not token_data:
                raise HTTPException(status_code=400, detail="Failed to get access token")
            
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            scopes = token_data.get("scopes", [])  # Получаем scopes из token_data
            
            logger.info(f"📋 Twitch scopes received: {scopes}")
            
            if not access_token:
                raise HTTPException(status_code=400, detail="Failed to get access token")
            
            # Получаем информацию о пользователе
            logger.info("Getting user data from Twitch...")
            user_data = await self.twitch_api.get_user_from_token(access_token)
            
            if not user_data:
                logger.error("Failed to get user data from Twitch")
                raise HTTPException(status_code=400, detail="Failed to get user info")
            
            twitch_user_id = user_data.get("id")
            twitch_username = user_data.get("display_name")
            
            logger.info(f"Twitch user data: id={twitch_user_id}, username={twitch_username}")
            
            if not twitch_user_id:
                logger.error("No user ID in Twitch response")
                raise HTTPException(status_code=400, detail="Failed to get user info")
            
            # Используем централизованный сервис создания пользователей
            from core.user_creation_service import user_creation_service
            
            # Определяем, это привязка интеграции или новый вход
            is_linking_integration = False
            current_user_id = None
            if current_user_from_session:
                existing_user_id = current_user_from_session.get('user_id')
                if existing_user_id and existing_user_id > 0:  # Не гостевая сессия
                    is_linking_integration = True
                    current_user_id = existing_user_id
                    logger.info(f"🔗 Linking Twitch account to existing user_id: {existing_user_id}")
            
            # Создаем или находим пользователя с включением scopes
            user = await user_creation_service.find_or_create_user(
                db=db,
                platform="twitch",
                platform_user_id=twitch_user_id,
                username=twitch_username,
                avatar_url=user_data.get("profile_image_url"),
                access_token=access_token,
                refresh_token=refresh_token,
                scopes=scopes,
                current_user_id=current_user_id,
                is_admin=False
            )
            
            user_id = user.id
            logger.info(f"✅ User resolved: ID={user_id}, twitch_username={user.twitch_username}")
            
            # КРИТИЧНО: Создаем UserSettings если его нет
            from core.database import UserSettings
            existing_settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
            if not existing_settings:
                logger.info(f"🆕 Creating UserSettings for user {user_id}")
                user_settings = UserSettings(
                    user_id=user_id,
                    channel_name=twitch_username.lower(),
                    chat_enabled=True
                )
                db.add(user_settings)
                db.commit()
                logger.info(f"✅ UserSettings created for {twitch_username}")
                
                # Подключаем бота к каналу пользователя
                try:
                    from main import bot_instance
                    if bot_instance:
                        import asyncio
                        # Проверяем что бот не уже подключен к этому каналу
                        if not bot_instance.is_connected_to_channel(twitch_username.lower()):
                            asyncio.create_task(bot_instance.join_channel(twitch_username.lower()))
                            logger.info(f"🔌 Bot joining channel: {twitch_username.lower()}")
                        else:
                            logger.info(f"✅ Bot already connected to channel: {twitch_username.lower()}")
                except Exception as e:
                    logger.warning(f"Could not connect bot to channel on login: {e}")
            
            # Управление сессиями
            from core.session_manager import session_manager
            
            if is_linking_integration:
                # Если это привязка второй платформы - НЕ завершаем старые сессии, используем текущую
                logger.info(f"🔗 Integration linking - using current session")
                session_id = request.cookies.get("session_id")
                if not session_id:
                    # Если по какой-то причине cookie нет - создаем новую сессию
                    logger.warning(f"No session cookie found during integration linking, creating new session")
                    device_info = {
                        "user_agent": request.headers.get("user-agent"),
                        "ip": getattr(request.client, 'host', 'unknown'),
                        "monitored_channel": twitch_username.lower(),  # Используем username, а не ID
                        "platform": "twitch"
                    }
                    session_id = session_manager.create_session(user_id, device_info=device_info)
                    
                    # Уведомляем connection_manager о новой активной сессии
                    try:
                        from core.connection_manager import get_connection_manager
                        connection_manager = get_connection_manager()
                        connection_manager.add_active_session(twitch_username.lower(), session_id, "twitch")
                        logger.info(f"✅ Connection manager notified about linking session for {twitch_username}")
                    except Exception as e:
                        logger.error(f"Error notifying connection_manager: {e}")
            else:
                # Если это новый вход - завершаем ВСЕ старые сессии (принцип одной активной сессии)
                logger.info(f"🔒 New login detected for user {user_id}. Terminating ALL old sessions...")
                session_manager.terminate_user_sessions(user_id, "new_login", db)
                logger.info(f"✅ All old sessions terminated. Creating new session...")
                
                # Создаем новую сессию для пользователя с правильным device_info
                device_info = {
                    "user_agent": request.headers.get("user-agent"),
                    "ip": getattr(request.client, 'host', 'unknown'),
                    "monitored_channel": twitch_username.lower(),  # Используем username, а не ID
                    "platform": "twitch"
                }
                session_id = session_manager.create_session(user_id, device_info=device_info)
                logger.info(f"✅ New session created: {session_id}")
                
                # Уведомляем connection_manager о новой активной сессии
                try:
                    from core.connection_manager import get_connection_manager
                    connection_manager = get_connection_manager()
                    connection_manager.add_active_session(twitch_username.lower(), session_id, "twitch")
                    logger.info(f"✅ Connection manager notified about new session for {twitch_username}")
                except Exception as e:
                    logger.error(f"Error notifying connection_manager: {e}")
            
            # Создаем ответ с httpOnly cookie
            from fastapi.responses import RedirectResponse
            from constants import DEFAULT_FRONTEND_URL
            frontend_url = os.getenv("FRONTEND_URL", DEFAULT_FRONTEND_URL)
            
            # Используем 302 вместо 307 для лучшей совместимости с cookies
            response = RedirectResponse(url=f"{frontend_url}/dashboard", status_code=302)
            
            # Явно удаляем старую cookie перед установкой новой
            response.delete_cookie(key="session_id", path="/")
            
            # Устанавливаем новую cookie
            # httpOnly=False для development чтобы JavaScript мог читать cookie
            # В production нужно будет использовать httpOnly=True с правильным HTTPS
            response.set_cookie(
                key="session_id",
                value=session_id,
                httponly=False,  # False для development (cross-origin cookies)
                secure=False,  # False для HTTP localhost
                samesite="lax",  # Lax позволяет cookies при navigation
                max_age=2592000,  # 30 дней
                path="/"  # Важно: устанавливаем путь для всего сайта
                # domain НЕ указываем - пусть браузер сам определит
            )
            
            logger.info(f"Twitch callback completed successfully, redirecting to dashboard")
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in Twitch callback: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")
    
    # VK OAuth теперь полностью обрабатывается через auth/vk_auth.py роутер
    # Методы vk_login() и vk_callback() удалены
    
    async def logout(self, current_user: dict = Depends(get_current_user)):
        """Logout пользователя - удаляет ВСЕ токены и завершает все сессии"""
        from fastapi.responses import JSONResponse
        from core.session_manager import session_manager
        
        # Валидируем данные пользователя
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        user_type = UserIdentityService.get_user_type(current_user)
        user_id = current_user.get("id")
        
        if user_id:
            # Для авторизованных пользователей - удаляем ВСЕ токены
            if user_type == UserType.AUTHENTICATED and user_id > 0:
                logger.info(f"🗑️ Logout: Deleting ALL tokens for user {user_id}")
                session_manager.clear_all_user_tokens(user_id)
                logger.info(f"✅ Tokens deleted. User {user_id} will need to re-authenticate")
            
            # Завершаем все сессии пользователя
            logger.info(f"🗑️ Logout: Terminating all sessions for user {user_id}")
            from core.database import get_db
            db = next(get_db())
            try:
                session_manager.terminate_user_sessions(user_id, "user_logout", db)
                logger.info(f"✅ All sessions terminated for user {user_id}")
            except Exception as e:
                logger.error(f"Error terminating sessions during logout: {e}")
            finally:
                db.close()
        
        # Создаем ответ
        is_guest = user_type == UserType.GUEST
        response = JSONResponse(content={
            "success": True, 
            "message": "Logged out successfully",
            "tokens_deleted": not is_guest
        })
        
        # Добавляем CORS заголовки
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRFToken"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        # Очищаем httpOnly cookie
        response.delete_cookie(
            key="session_id",
            httponly=True,
            samesite="lax"
        )
        
        logger.info(f"👋 User {user_id} logged out successfully")
        return response

# Создаем экземпляр для использования
auth_handlers = AuthHandlers()
