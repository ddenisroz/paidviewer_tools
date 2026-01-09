# bot_service/integrations/twitch/oauth.py
"""
Twitch OAuth 2.0 Integration.

Отвечает за:
- App Access Token (server-to-server)
- User Access Token (refresh, validate)
"""

import time
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

import aiohttp
from aiohttp import ClientTimeout

from core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class TwitchTokenResponse:
    """Ответ Twitch OAuth."""
    access_token: str
    refresh_token: Optional[str]
    expires_in: int
    scopes: List[str]
    token_type: str = "bearer"


class TwitchOAuth:
    """
    Управление OAuth токенами Twitch.
    
    Поддерживает:
    - App Access Token с автообновлением
    - User Token refresh
    - Token validation
    """
    
    TOKEN_URL = "https://id.twitch.tv/oauth2/token"
    VALIDATE_URL = "https://id.twitch.tv/oauth2/validate"
    TIMEOUT = ClientTimeout(total=15, connect=5)
    
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self._app_token: Optional[str] = None
        self._app_token_expires_at: float = 0
    
    @classmethod
    def from_settings(cls) -> "TwitchOAuth":
        """Создаёт экземпляр из настроек приложения."""
        if not settings.twitch_client_id or not settings.twitch_client_secret:
            raise ValueError("TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set")
        return cls(settings.twitch_client_id, settings.twitch_client_secret)
    
    async def get_app_access_token(self) -> str:
        """
        Получает App Access Token для server-to-server запросов.
        Кэширует токен и обновляет при необходимости.
        """
        if self._app_token and time.time() < self._app_token_expires_at:
            return self._app_token
        
        async with aiohttp.ClientSession(timeout=self.TIMEOUT) as session:
            data = aiohttp.FormData()
            data.add_field('client_id', self.client_id)
            data.add_field('client_secret', self.client_secret)
            data.add_field('grant_type', 'client_credentials')
            
            async with session.post(self.TOKEN_URL, data=data) as response:
                if response.status != 200:
                    text = await response.text()
                    logger.error(f"[TWITCH] App token request failed: {response.status} - {text}")
                    raise Exception(f"Failed to get Twitch app token: {response.status}")
                
                result = await response.json()
                self._app_token = result["access_token"]
                # Обновляем за 60 секунд до истечения
                self._app_token_expires_at = time.time() + result["expires_in"] - 60
                
                logger.info("[TWITCH] App access token refreshed successfully")
                return self._app_token
    
    async def exchange_code(self, code: str, redirect_uri: str) -> TwitchTokenResponse:
        """
        Обменивает authorization code на access token.
        
        Args:
            code: Authorization code из callback
            redirect_uri: Redirect URI, использованный при авторизации
            
        Returns:
            TwitchTokenResponse с токенами
        """
        async with aiohttp.ClientSession(timeout=self.TIMEOUT) as session:
            data = aiohttp.FormData()
            data.add_field('client_id', self.client_id)
            data.add_field('client_secret', self.client_secret)
            data.add_field('code', code)
            data.add_field('grant_type', 'authorization_code')
            data.add_field('redirect_uri', redirect_uri)
            
            async with session.post(self.TOKEN_URL, data=data) as response:
                if response.status != 200:
                    text = await response.text()
                    logger.error(f"[TWITCH] Code exchange failed: {response.status} - {text}")
                    raise Exception(f"Failed to exchange code: {response.status}")
                
                result = await response.json()
                
                # Twitch может вернуть scopes как строку или список
                scope_data = result.get("scope", [])
                if isinstance(scope_data, str):
                    scopes = [s.strip() for s in scope_data.split()] if scope_data else []
                else:
                    scopes = scope_data
                
                return TwitchTokenResponse(
                    access_token=result["access_token"],
                    refresh_token=result.get("refresh_token"),
                    expires_in=result.get("expires_in", 3600),
                    scopes=scopes,
                    token_type=result.get("token_type", "bearer"),
                )
    
    async def refresh_user_token(self, refresh_token: str) -> TwitchTokenResponse:
        """
        Обновляет user access token.
        
        Args:
            refresh_token: Refresh token пользователя
            
        Returns:
            TwitchTokenResponse с новыми токенами
        """
        async with aiohttp.ClientSession(timeout=self.TIMEOUT) as session:
            data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }
            
            async with session.post(self.TOKEN_URL, data=data) as response:
                if response.status != 200:
                    text = await response.text()
                    logger.error(f"[TWITCH] Token refresh failed: {response.status} - {text}")
                    raise Exception(f"Failed to refresh token: {response.status}")
                
                result = await response.json()
                
                scope_data = result.get("scope", [])
                if isinstance(scope_data, str):
                    scopes = [s.strip() for s in scope_data.split()] if scope_data else []
                else:
                    scopes = scope_data
                
                logger.info("[TWITCH] User token refreshed successfully")
                
                return TwitchTokenResponse(
                    access_token=result["access_token"],
                    refresh_token=result.get("refresh_token", refresh_token),
                    expires_in=result.get("expires_in", 3600),
                    scopes=scopes,
                )
    
    async def validate_token(self, access_token: str) -> Optional[Dict[str, Any]]:
        """
        Проверяет валидность токена.
        
        Returns:
            Информация о токене или None если невалидный
        """
        async with aiohttp.ClientSession(timeout=self.TIMEOUT) as session:
            headers = {"Authorization": f"OAuth {access_token}"}
            
            async with session.get(self.VALIDATE_URL, headers=headers) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 401:
                    return None
                else:
                    logger.warning(f"[TWITCH] Token validation unexpected status: {response.status}")
                    return None
