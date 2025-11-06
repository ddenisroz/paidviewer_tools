"""
Сервис для автоматического обновления токенов платформ
"""
import logging
import httpx
import os
import aiohttp
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from core.database import get_db, UserToken
from core.token_encryption import encrypt_token, decrypt_token
from core.datetime_utils import utcnow_naive
from core.retry_utils import retry_async

logger = logging.getLogger('token_refresh')

class TokenRefreshService:
    """Сервис для обновления access tokens используя refresh tokens"""
    
    @staticmethod
    async def refresh_if_needed(user_id: int, platform: str, db: Optional[Session] = None) -> bool:
        """
        Проверить и обновить токен если истекает в течение 7 дней
        
        Args:
            user_id: ID пользователя
            platform: Платформа ('twitch', 'vk', 'donationalerts')
            db: Database session (опционально)
            
        Returns:
            bool: True если токен валиден или успешно обновлен, False если ошибка
        """
        should_close_db = False
        if db is None:
            db = next(get_db())
            should_close_db = True
            
        try:
            token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == platform
            ).first()
            
            if not token:
                logger.warning(f"No token found for user {user_id} platform {platform}")
                return False
            
            # Проверяем срок действия (обновляем за 7 дней до истечения)
            if token.expires_at:
                time_left = token.expires_at - utcnow_naive()
                days_left = time_left.days
                
                if days_left < 7:
                    logger.info(f"🔄 Token expires in {days_left} days, refreshing for user {user_id}...")
                    return await TokenRefreshService._refresh_token(token, db)
                else:
                    logger.debug(f"✓ Token valid for {days_left} more days")
                    return True
            else:
                # Если expires_at не установлен - считаем токен валидным
                logger.debug(f"Token has no expiration date, assuming valid")
                return True
                
        except Exception as e:
            logger.error(f"Error checking token expiration: {e}", exc_info=True)
            return False
        finally:
            if should_close_db:
                db.close()
    
    @staticmethod
    async def refresh_on_401(user_id: int, platform: str, db: Optional[Session] = None) -> bool:
        """
        Обновить токен после получения 401 ошибки
        
        Args:
            user_id: ID пользователя
            platform: Платформа
            db: Database session (опционально)
            
        Returns:
            bool: True если токен успешно обновлен
        """
        should_close_db = False
        if db is None:
            db = next(get_db())
            should_close_db = True
            
        try:
            token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == platform
            ).first()
            
            if not token:
                logger.error(f"No token found for user {user_id} platform {platform}")
                return False
            
            logger.info(f"🔄 Refreshing token after 401 error for user {user_id}")
            return await TokenRefreshService._refresh_token(token, db)
            
        finally:
            if should_close_db:
                db.close()
    
    @staticmethod
    async def _refresh_token(token: UserToken, db: Session) -> bool:
        """
        Обновить токен используя refresh_token
        
        Args:
            token: UserToken объект
            db: Database session
            
        Returns:
            bool: True если успешно обновлен
        """
        if token.platform == 'twitch':
            return await TokenRefreshService._refresh_twitch(token, db)
        elif token.platform == 'vk':
            return await TokenRefreshService._refresh_vk(token, db)
        elif token.platform == 'donationalerts':
            return await TokenRefreshService._refresh_donationalerts(token, db)
        else:
            logger.error(f"Unknown platform: {token.platform}")
            return False
    
    @staticmethod
    async def _refresh_twitch(token: UserToken, db: Session) -> bool:
        """Обновить Twitch токен"""
        try:
            if not token.refresh_token:
                logger.error(f"No refresh token for Twitch user {token.user_id}")
                return False
            
            # Расшифровываем refresh_token
            refresh_token = decrypt_token(token.refresh_token)
            
            client_id = os.getenv("TWITCH_CLIENT_ID")
            client_secret = os.getenv("TWITCH_CLIENT_SECRET")
            
            if not client_id or not client_secret:
                logger.error("Twitch credentials not configured")
                return False
            
            # Запрос к Twitch OAuth с retry
            async def _do_refresh():
                async with httpx.AsyncClient(timeout=15.0) as client:
                    return await client.post(
                        "https://id.twitch.tv/oauth2/token",
                        data={
                            "client_id": client_id,
                            "client_secret": client_secret,
                            "grant_type": "refresh_token",
                            "refresh_token": refresh_token
                        }
                    )
            
            logger.info(f"📡 Requesting new Twitch token for user {token.user_id}")
            response = await retry_async(
                _do_refresh,
                max_attempts=3,
                initial_delay=2.0,
                retry_on=(httpx.NetworkError, httpx.TimeoutException, aiohttp.ClientError)
            )
            
            if not response:
                logger.error("❌ Failed to refresh Twitch token after retries")
                return False
            
            if response.status_code == 200:
                data = response.json()
                
                # Обновляем токены в БД
                token.access_token = encrypt_token(data["access_token"])
                token.refresh_token = encrypt_token(data["refresh_token"])
                token.expires_at = utcnow_naive() + timedelta(seconds=data["expires_in"])
                token.updated_at = utcnow_naive()
                
                db.commit()
                
                logger.info(f"✅ Twitch token refreshed for user {token.user_id}")
                logger.info(f"   New expiration: {token.expires_at}")
                return True
                
            elif response.status_code == 400:
                error_data = response.json()
                logger.error(f"❌ Failed to refresh Twitch token: {error_data}")
                
                # Если refresh token недействителен - удаляем его
                if error_data.get("message") == "Invalid refresh token":
                    logger.error(f"Refresh token invalid, user needs to re-authenticate")
                    token.refresh_token = None
                    db.commit()
                
                return False
            else:
                logger.error(f"❌ Failed to refresh token: {response.status_code} - {response.text}")
                return False
                    
        except Exception as e:
            logger.error(f"Error refreshing Twitch token: {e}", exc_info=True)
            return False
    
    @staticmethod
    async def _refresh_vk(token: UserToken, db: Session) -> bool:
        """Обновить VK Live токен"""
        try:
            if not token.refresh_token:
                logger.error(f"No refresh token for VK user {token.user_id}")
                return False
            
            # Расшифровываем refresh_token
            refresh_token = decrypt_token(token.refresh_token)
            
            client_id = os.getenv("VK_CLIENT_ID")
            client_secret = os.getenv("VK_CLIENT_SECRET")
            redirect_uri = os.getenv("VK_REDIRECT_URI", "http://localhost:8000/auth/vk/callback")
            
            if not client_id or not client_secret:
                logger.error("VK credentials not configured")
                return False
            
            # Создаем Basic Auth заголовок согласно документации VK Live
            import base64
            credentials = f"{client_id}:{client_secret}"
            auth_header = base64.b64encode(credentials.encode()).decode()
            
            # Запрос к VK Live OAuth с retry
            async def _do_refresh():
                async with httpx.AsyncClient(timeout=15.0) as client:
                    return await client.post(
                        "https://api.live.vkvideo.ru/oauth/server/token",
                        headers={
                            "Authorization": f"Basic {auth_header}",
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        data={
                            "grant_type": "refresh_token",
                            "refresh_token": refresh_token,
                            "redirect_uri": redirect_uri
                        }
                    )
            
            logger.info(f"📡 Requesting new VK Live token for user {token.user_id}")
            response = await retry_async(
                _do_refresh,
                max_attempts=3,
                initial_delay=2.0,
                retry_on=(httpx.NetworkError, httpx.TimeoutException, aiohttp.ClientError)
            )
            
            if not response:
                logger.error("❌ Failed to refresh VK token after retries")
                return False
            
            if response.status_code == 200:
                data = response.json()
                
                # Обновляем токены в БД
                token.access_token = encrypt_token(data["access_token"])
                token.refresh_token = encrypt_token(data["refresh_token"])
                token.expires_at = utcnow_naive() + timedelta(seconds=data["expires_in"])
                token.updated_at = utcnow_naive()
                
                db.commit()
                
                logger.info(f"✅ VK Live token refreshed for user {token.user_id}")
                return True
            else:
                logger.error(f"❌ Failed to refresh VK token: {response.status_code}")
                return False
                    
        except Exception as e:
            logger.error(f"Error refreshing VK token: {e}", exc_info=True)
            return False
    
    @staticmethod
    async def _refresh_donationalerts(token: UserToken, db: Session) -> bool:
        """Обновить DonationAlerts токен"""
        try:
            if not token.refresh_token:
                logger.error(f"No refresh token for DA user {token.user_id}")
                return False
            
            refresh_token = decrypt_token(token.refresh_token)
            
            client_id = os.getenv("DONATIONALERTS_CLIENT_ID")
            client_secret = os.getenv("DONATIONALERTS_CLIENT_SECRET")
            
            if not client_id or not client_secret:
                logger.error("DonationAlerts credentials not configured")
                return False
            
            # Запрос к DonationAlerts OAuth с retry
            async def _do_refresh():
                async with httpx.AsyncClient(timeout=15.0) as client:
                    return await client.post(
                        "https://www.donationalerts.com/oauth/token",
                        data={
                            "client_id": client_id,
                            "client_secret": client_secret,
                            "grant_type": "refresh_token",
                            "refresh_token": refresh_token
                        }
                    )
            
            logger.info(f"📡 Requesting new DonationAlerts token for user {token.user_id}")
            response = await retry_async(
                _do_refresh,
                max_attempts=3,
                initial_delay=2.0,
                retry_on=(httpx.NetworkError, httpx.TimeoutException, aiohttp.ClientError)
            )
            
            if not response:
                logger.error("❌ Failed to refresh DonationAlerts token after retries")
                return False
            
            if response.status_code == 200:
                data = response.json()
                
                token.access_token = encrypt_token(data["access_token"])
                token.refresh_token = encrypt_token(data["refresh_token"])
                token.expires_at = utcnow_naive() + timedelta(seconds=data["expires_in"])
                token.updated_at = utcnow_naive()
                
                db.commit()
                
                logger.info(f"✅ DonationAlerts token refreshed for user {token.user_id}")
                return True
            else:
                logger.error(f"❌ Failed to refresh DA token: {response.status_code}")
                return False
                    
        except Exception as e:
            logger.error(f"Error refreshing DonationAlerts token: {e}", exc_info=True)
            return False

# Глобальный экземпляр сервиса
token_refresh_service = TokenRefreshService()

