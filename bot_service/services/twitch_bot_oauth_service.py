"""
Сервис для управления OAuth токеном Twitch бота с автообновлением.

Вместо упрощенного TMI токена использует полноценный OAuth2 flow,
который предоставляет refresh_token для автоматического обновления.
"""

import logging
import httpx
from datetime import timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from core.config import settings
from core.database import db_session
from models.bot_token import BotToken
from core.token_encryption import encrypt_token, decrypt_token
from core.datetime_utils import utcnow_naive
from core.retry_utils import retry_async

logger = logging.getLogger(__name__)


class TwitchBotOAuthService:
    """Сервис для OAuth авторизации Twitch бота с refresh token"""
    
    # Scopes для бота (минимальные права для чтения чата)
    BOT_SCOPES = [
        'chat:read',      # Чтение сообщений чата
        'chat:edit',      # Отправка сообщений в чат
        'channel:moderate',  # Модерация (опционально)
        'whispers:read',  # Чтение whispers (опционально)
        'whispers:edit'   # Отправка whispers (опционально)
    ]
    
    @staticmethod
    def get_authorization_url(state: str) -> str:
        """
        Получить URL для OAuth авторизации бота.
        
        Args:
            state: CSRF protection token
            
        Returns:
            str: URL для редиректа пользователя
        """
        if not settings.twitch_client_id:
            raise ValueError("TWITCH_CLIENT_ID not configured")
        
        scopes = ' '.join(TwitchBotOAuthService.BOT_SCOPES)
        redirect_uri = f"{settings.backend_url}/auth/twitch/bot/callback"
        
        auth_url = (
            f"https://id.twitch.tv/oauth2/authorize"
            f"?client_id={settings.twitch_client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope={scopes}"
            f"&state={state}"
        )
        
        return auth_url
    
    @staticmethod
    async def exchange_code_for_token(code: str) -> Dict[str, Any]:
        """
        Обменять authorization code на access token и refresh token.
        
        Args:
            code: Authorization code из callback
            
        Returns:
            dict: {
                'access_token': str,
                'refresh_token': str,
                'expires_in': int,
                'scope': list
            }
        """
        if not all([settings.twitch_client_id, settings.twitch_client_secret]):
            raise ValueError("Twitch credentials not configured")
        
        redirect_uri = f"{settings.backend_url}/auth/twitch/bot/callback"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://id.twitch.tv/oauth2/token",
                params={
                    "client_id": settings.twitch_client_id,
                    "client_secret": settings.twitch_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            
            if response.status_code != 200:
                error_body = response.text
                logger.error(f"Failed to exchange code for token: {error_body}")
                raise Exception(f"Token exchange failed: {error_body}")
            
            data = response.json()
            
            logger.info("[OK] [BOT OAUTH] Successfully exchanged code for tokens")
            logger.info(f"[INFO] Token expires in: {data.get('expires_in')} seconds")
            
            return data
    
    @staticmethod
    async def get_bot_user_info(access_token: str) -> Dict[str, Any]:
        """
        Получить информацию о боте через API.
        
        Args:
            access_token: Access token бота
            
        Returns:
            dict: {'id': str, 'login': str, 'display_name': str}
        """
        if not settings.twitch_client_id:
            raise ValueError("TWITCH_CLIENT_ID not configured")
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Client-ID": settings.twitch_client_id
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                "https://api.twitch.tv/helix/users",
                headers=headers
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to get bot user info: {response.text}")
            
            data = response.json()
            user_info = data.get("data", [{}])[0]
            
            return {
                'id': user_info.get('id'),
                'login': user_info.get('login'),
                'display_name': user_info.get('display_name')
            }
    
    @staticmethod
    async def save_bot_token(
        access_token: str,
        refresh_token: str,
        expires_in: int,
        scopes: list,
        bot_user_id: str,
        bot_login: str,
        db: Optional[Session] = None
    ) -> bool:
        """
        Сохранить токен бота в базу данных.
        
        Args:
            access_token: Access token
            refresh_token: Refresh token
            expires_in: Время жизни токена в секундах
            scopes: Список разрешений
            bot_user_id: ID бота на Twitch
            bot_login: Login бота
            db: Database session (опционально)
            
        Returns:
            bool: True если успешно сохранено
        """
        def _save(session_db: Session) -> bool:
            try:
                # Ищем существующий токен бота
                bot_token = session_db.query(BotToken).filter(
                    BotToken.platform == 'twitch'
                ).first()
                
                expires_at = utcnow_naive() + timedelta(seconds=expires_in)
                
                if bot_token:
                    # Обновляем существующий
                    bot_token.access_token = encrypt_token(access_token)
                    bot_token.refresh_token = encrypt_token(refresh_token)
                    bot_token.expires_at = expires_at
                    bot_token.scopes = scopes
                    bot_token.bot_user_id = bot_user_id
                    bot_token.bot_login = bot_login
                    bot_token.updated_at = utcnow_naive()
                    logger.info(f"[UPDATE] Updated Twitch bot token for {bot_login}")
                else:
                    # Создаем новый
                    bot_token = BotToken(
                        platform='twitch',
                        access_token=encrypt_token(access_token),
                        refresh_token=encrypt_token(refresh_token),
                        expires_at=expires_at,
                        scopes=scopes,
                        bot_user_id=bot_user_id,
                        bot_login=bot_login
                    )
                    session_db.add(bot_token)
                    logger.info(f"[CREATE] Created Twitch bot token for {bot_login}")
                
                session_db.commit()
                return True
                
            except Exception as e:
                logger.error(f"Error saving bot token: {e}")
                session_db.rollback()
                return False
        
        if db is not None:
            return _save(db)
        
        with db_session() as new_db:
            return _save(new_db)
    
    @staticmethod
    async def get_bot_token(db: Optional[Session] = None) -> Optional[Dict[str, Any]]:
        """
        Получить токен бота из базы данных.
        
        Returns:
            dict: {
                'access_token': str,
                'refresh_token': str,
                'expires_at': datetime,
                'bot_login': str
            } или None
        """
        def _get(session_db: Session) -> Optional[Dict[str, Any]]:
            bot_token = session_db.query(BotToken).filter(
                BotToken.platform == 'twitch'
            ).first()
            
            if not bot_token:
                return None
            
            return {
                'access_token': decrypt_token(bot_token.access_token),
                'refresh_token': decrypt_token(bot_token.refresh_token) if bot_token.refresh_token else None,
                'expires_at': bot_token.expires_at,
                'bot_login': bot_token.bot_login,
                'bot_user_id': bot_token.bot_user_id
            }
        
        if db is not None:
            return _get(db)
        
        with db_session() as new_db:
            return _get(new_db)
    
    @staticmethod
    async def refresh_bot_token(db: Optional[Session] = None) -> bool:
        """
        Обновить токен бота используя refresh_token.
        
        Returns:
            bool: True если успешно обновлено
        """
        def _refresh(session_db: Session) -> bool:
            try:
                bot_token = session_db.query(BotToken).filter(
                    BotToken.platform == 'twitch'
                ).first()
                
                if not bot_token or not bot_token.refresh_token:
                    logger.error("[ERROR] No bot token or refresh token found")
                    return False
                
                refresh_token = decrypt_token(bot_token.refresh_token)
                
                logger.info("[REFRESH] Refreshing Twitch bot token...")
                
                # Выполняем refresh запрос
                async def _do_refresh():
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        return await client.post(
                            "https://id.twitch.tv/oauth2/token",
                            data={
                                "client_id": settings.twitch_client_id,
                                "client_secret": settings.twitch_client_secret,
                                "grant_type": "refresh_token",
                                "refresh_token": refresh_token
                            }
                        )
                
                import asyncio
                response = asyncio.run(_do_refresh())
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Обновляем токен в БД
                    bot_token.access_token = encrypt_token(data["access_token"])
                    bot_token.refresh_token = encrypt_token(data["refresh_token"])
                    bot_token.expires_at = utcnow_naive() + timedelta(seconds=data["expires_in"])
                    bot_token.updated_at = utcnow_naive()
                    
                    session_db.commit()
                    
                    logger.info(f"[OK] Twitch bot token refreshed for {bot_token.bot_login}")
                    logger.info(f"[INFO] New token expires in: {data['expires_in']} seconds")
                    return True
                
                elif response.status_code == 400:
                    error_data = response.json()
                    logger.error(f"[ERROR] Failed to refresh bot token: {error_data}")
                    
                    if error_data.get("message") == "Invalid refresh token":
                        logger.error("[ERROR] Refresh token is invalid - need to re-authorize bot")
                        bot_token.refresh_token = None
                        session_db.commit()
                    
                    return False
                
                else:
                    logger.error(f"[ERROR] Unexpected response: {response.status_code}")
                    return False
                
            except Exception as e:
                logger.error(f"Error refreshing bot token: {e}")
                session_db.rollback()
                return False
        
        if db is not None:
            return _refresh(db)
        
        with db_session() as new_db:
            return _refresh(new_db)
    
    @staticmethod
    async def refresh_if_needed(db: Optional[Session] = None) -> bool:
        """
        Проверить и обновить токен если истекает в течение 7 дней.
        
        Returns:
            bool: True если токен валиден или успешно обновлен
        """
        def _check_and_refresh(session_db: Session) -> bool:
            bot_token = session_db.query(BotToken).filter(
                BotToken.platform == 'twitch'
            ).first()
            
            if not bot_token:
                logger.warning("[WARN] No Twitch bot token found in database")
                return False
            
            if not bot_token.expires_at:
                logger.debug("[INFO] Bot token has no expiration date")
                return True
            
            days_left = (bot_token.expires_at - utcnow_naive()).days
            
            if days_left >= 7:
                logger.debug(f"[INFO] Bot token valid for {days_left} more days")
                return True
            
            logger.info(f"[REFRESH] Bot token expires in {days_left} days, refreshing...")
            return TwitchBotOAuthService.refresh_bot_token(session_db)
        
        try:
            if db is not None:
                return _check_and_refresh(db)
            
            with db_session() as new_db:
                return _check_and_refresh(new_db)
                
        except Exception as e:
            logger.error(f"Error checking bot token expiration: {e}")
            return False


# Глобальный экземпляр
twitch_bot_oauth_service = TwitchBotOAuthService()
