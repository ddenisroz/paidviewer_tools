# bot_service/twitch_api.py
import os
import time
import aiohttp
import logging
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from core.connection_manager import ConnectionManager
from core.token_utils import get_user_token_from_db
from core.database import User
from core.session_manager import session_manager

# Загружаем .env файл
# Получаем путь к директории bot_service
current_dir = os.path.dirname(os.path.abspath(__file__))
bot_service_dir = os.path.dirname(current_dir)
env_path = os.path.join(bot_service_dir, '.env')

# Загружаем .env файл из правильной директории
load_dotenv(env_path)

logger = logging.getLogger(__name__)

# --- Environment Variables ---
from constants import DEFAULT_BACKEND_URL
BACKEND_URL = os.getenv("BACKEND_URL", DEFAULT_BACKEND_URL)

# Проверяем загрузку переменных окружения
logger.info(f"[SEARCH] Looking for .env file at: {env_path}")
logger.info(f"[SEARCH] .env file exists: {os.path.exists(env_path)}")
logger.info(f"[SEARCH] Environment check - TWITCH_CLIENT_ID loaded: {bool(os.getenv('TWITCH_CLIENT_ID'))}")
logger.info(f"[SEARCH] Environment check - TWITCH_CLIENT_SECRET loaded: {bool(os.getenv('TWITCH_CLIENT_SECRET'))}")
logger.info(f"[SEARCH] Environment check - TWITCH_BOT_TOKEN loaded: {bool(os.getenv('TWITCH_BOT_TOKEN'))}")

# --- Twitch API Client ---
class TwitchAPI:
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.client_id = os.getenv("TWITCH_CLIENT_ID")
        self.client_secret = os.getenv("TWITCH_CLIENT_SECRET")
        self.base_url = "https://api.twitch.tv/helix"
        self._access_token = None
        self._token_expires_at = 0

    async def get_app_access_token(self) -> str:
        """Получить access token для приложения"""
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token

        # Проверяем наличие обязательных параметров
        if not self.client_id:
            logger.error("TWITCH_CLIENT_ID is not set in environment variables")
            raise Exception("TWITCH_CLIENT_ID is not configured")
        
        if not self.client_secret:
            logger.error("TWITCH_CLIENT_SECRET is not set in environment variables")
            raise Exception("TWITCH_CLIENT_SECRET is not configured")

        async with aiohttp.ClientSession() as session:
            url = "https://id.twitch.tv/oauth2/token"
            
            # Используем FormData для правильного кодирования
            form_data = aiohttp.FormData()
            form_data.add_field('client_id', self.client_id)
            form_data.add_field('client_secret', self.client_secret)
            form_data.add_field('grant_type', 'client_credentials')
            
            async with session.post(url, data=form_data) as response:
                if response.status == 200:
                    try:
                        result = await response.json()
                        self._access_token = result["access_token"]
                        self._token_expires_at = time.time() + result["expires_in"] - 60  # 60 секунд запас
                        logger.info("[OK] Twitch app access token refreshed successfully")
                        return self._access_token
                    except Exception as e:
                        logger.error(f"[ERROR] Error parsing Twitch OAuth2 response: {e}")
                        raise Exception("Failed to parse Twitch access token response")
                else:
                    response_text = await response.text()
                    logger.error(f"[ERROR] Failed to get Twitch app access token: {response.status}")
                    logger.error(f"[ERROR] Error response: {response_text}")
                    raise Exception(f"Failed to get Twitch access token: {response.status} - {response_text}")

    async def get_user_info(self, username: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о пользователе Twitch"""
        token = await self.get_app_access_token()
        
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {token}"
            }
            
            url = f"{self.base_url}/users"
            params = {"login": username}
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data["data"]:
                        return data["data"][0]
                else:
                    logger.error(f"Failed to get user info for {username}: {response.status}")
                return None

    async def get_stream_info(self, username: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о стриме"""
        token = await self.get_app_access_token()
        
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {token}"
            }
            
            url = f"{self.base_url}/streams"
            params = {"user_login": username}
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"Stream data for {username}: {data}")
                    if data["data"]:
                        logger.info(f"Stream is online: {data['data'][0]}")
                        return data["data"][0]
                    else:
                        logger.info(f"Stream is offline for {username}")
                else:
                    logger.debug(f"Failed to get stream info for {username}: {response.status}")
                return None

    async def get_channel_info(self, username: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о канале (для офлайн стримов)"""
        # Сначала получаем user_id по username
        user_info = await self.get_user_info(username)
        if not user_info:
            logger.error(f"Failed to get user info for {username}")
            return None
            
        user_id = user_info["id"]
        token = await self.get_app_access_token()
        
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {token}"
            }
            
            url = f"{self.base_url}/channels"
            params = {"broadcaster_id": user_id}
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"Channel data for {username}: {data}")
                    if data["data"]:
                        return data["data"][0]
                else:
                    logger.error(f"Failed to get channel info for {username}: {response.status}")
                    response_text = await response.text()
                    logger.error(f"Response: {response_text}")
                return None

    async def get_channel_info_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о канале по user_id"""
        token = await self.get_app_access_token()
        
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {token}"
            }
            
            url = f"{self.base_url}/channels"
            params = {"broadcaster_id": user_id}
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data["data"]:
                        return data["data"][0]
                else:
                    logger.error(f"Failed to get channel info for user_id {user_id}: {response.status}")
                return None

    async def get_stream_info_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о стриме по user_id"""
        token = await self.get_app_access_token()
        
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {token}"
            }
            
            url = f"{self.base_url}/streams"
            params = {"user_id": user_id}
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data["data"]:
                        return data["data"][0]
                else:
                    logger.debug(f"Failed to get stream info for user_id {user_id}: {response.status}")
                return None

    async def search_categories(self, query: str) -> List[Dict[str, Any]]:
        """Поиск категорий Twitch"""
        # Если запрос пустой, возвращаем пустой список
        if not query or query.strip() == "":
            return []
            
        # Проверяем кэш
        cache_key = f"categories_{query}"
        cached = self.connection_manager.get_twitch_cache(cache_key)
        if cached:
            return cached

        token = await self.get_app_access_token()
        
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {token}"
            }
            
            url = f"{self.base_url}/search/categories"
            params = {"query": query.strip(), "first": 20}
            
            logger.debug(f"Twitch API Request: GET {url}")
            logger.debug(f"Headers: {{'Client-ID': '{self.client_id}', 'Authorization': 'Bearer ...'}}")
            logger.debug(f"Params: {params}")

            async with session.get(url, headers=headers, params=params) as response:
                response_text = await response.text()
                logger.debug(f"Twitch API Response Status: {response.status}")
                logger.debug(f"Twitch API Response Body: {response_text}")

                if response.status == 200:
                    try:
                        data = await response.json(content_type=None) # Ignore content type
                        categories = data.get("data", [])
                        logger.info(f"Found {len(categories)} categories for query '{query}'")
                        
                        # Добавляем обложки для категорий
                        for category in categories:
                            if 'box_art_url' in category:
                                category['box_art_url'] = category['box_art_url'].replace('{width}x{height}', '285x380')
                        
                        self.connection_manager.update_twitch_cache(cache_key, categories)
                        return categories
                    except Exception as e:
                        logger.error(f"Error parsing Twitch API JSON response: {e}")
                        logger.error(f"Raw response was: {response_text}")
                        return []
                else:
                    logger.error(f"Failed to search categories: {response.status}")
                    logger.error(f"Response: {response_text}")
                    return []

    async def update_stream_title(self, user_id: int, title: str) -> bool:
        """Обновить название стрима"""
        tokens = get_user_token_from_db(user_id, "twitch")
        if not tokens or not tokens.get("access_token"):
            logger.error(f"No Twitch access token found for unified user {user_id}")
            return False
        
        # Проверяем наличие необходимых прав в токене
        if "channel:manage:broadcast" not in tokens.get("scopes", []):
            logger.error(f"User {user_id} does not have 'channel:manage:broadcast' scope for updating stream title.")
            return False
            
        access_token = tokens["access_token"]
        
        platform_user_id = tokens.get("platform_user_id")
        if not platform_user_id:
            logger.error(f"Could not find platform_user_id for unified user {user_id}")
            return False

        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            url = f"{self.base_url}/channels?broadcaster_id={platform_user_id}"
            data = {"title": title}
            
            async with session.patch(url, headers=headers, json=data) as response:
                if response.status == 204:
                    logger.info(f"Stream title updated for user {user_id}")
                    return True
                elif response.status == 401:
                    error_text = await response.text()
                    logger.error(f"Twitch token expired for user {user_id}: {response.status} - {error_text}")
                    # Попробуем обновить токен
                    try:
                        await self._refresh_user_token(user_id)
                        logger.info(f"Attempting to refresh Twitch token for user {user_id}")
                        return False  # Возвращаем False, чтобы пользователь переавторизовался
                    except Exception as refresh_error:
                        logger.error(f"Failed to refresh Twitch token for user {user_id}: {refresh_error}")
                        return False
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to update stream title for user {user_id}: {response.status} - {error_text}")
                    logger.error(f"Request URL: {url}")
                    logger.error(f"Request data: {data}")
                    logger.error(f"Request headers: {headers}")
                    return False

    async def update_stream_category(self, user_id: int, category_id: str) -> bool:
        """Обновить категорию стрима"""
        logger.info(f"🎮 [TWITCH API] Updating category for user {user_id} to category_id={category_id}")
        
        # Получаем токен пользователя (используем тот же метод что и update_stream_title)
        tokens = get_user_token_from_db(user_id, "twitch")
        if not tokens or not tokens.get("access_token"):
            logger.error(f"❌ [TWITCH API] No Twitch access token found for unified user {user_id}")
            return False
        
        # Проверяем наличие необходимых прав в токене
        if "channel:manage:broadcast" not in tokens.get("scopes", []):
            logger.error(f"❌ [TWITCH API] User {user_id} does not have 'channel:manage:broadcast' scope for updating category.")
            return False
            
        access_token = tokens["access_token"]
        platform_user_id = tokens.get("platform_user_id")
        
        if not platform_user_id:
            logger.error(f"❌ [TWITCH API] Could not find platform_user_id for unified user {user_id}")
            return False
        
        logger.info(f"✅ [TWITCH API] Got access token and platform_user_id={platform_user_id} for user {user_id}")

        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            url = f"{self.base_url}/channels?broadcaster_id={platform_user_id}"
            data = {"game_id": category_id}
            
            logger.info(f"🎮 [TWITCH API] Sending PATCH request:")
            logger.info(f"   URL: {url}")
            logger.info(f"   Data: {data}")
            
            async with session.patch(url, headers=headers, json=data) as response:
                logger.info(f"🎮 [TWITCH API] Response status: {response.status}")
                
                if response.status == 204:
                    logger.info(f"✅ [TWITCH API] Stream category updated successfully for user {user_id}")
                    return True
                elif response.status == 401:
                    error_text = await response.text()
                    logger.error(f"❌ [TWITCH API] Token expired for user {user_id}: {response.status} - {error_text}")
                    # Попробуем обновить токен
                    try:
                        await self._refresh_user_token(user_id)
                        logger.info(f"🔄 [TWITCH API] Attempting to refresh Twitch token for user {user_id}")
                        return False  # Возвращаем False, чтобы пользователь переавторизовался
                    except Exception as refresh_error:
                        logger.error(f"❌ [TWITCH API] Failed to refresh Twitch token for user {user_id}: {refresh_error}")
                        return False
                else:
                    error_text = await response.text()
                    logger.error(f"❌ [TWITCH API] Failed to update stream category for user {user_id}: {response.status}")
                    logger.error(f"   Response: {error_text}")
                    logger.error(f"   Request URL: {url}")
                    logger.error(f"   Request data: {data}")
                    logger.error(f"   Headers: Client-ID={self.client_id[:10]}..., Authorization=Bearer {access_token[:10]}...")
                    return False

    async def _refresh_user_token(self, user_id: int) -> bool:
        """Обновить токен пользователя Twitch"""
        try:
            tokens = get_user_token_from_db(user_id, "twitch")
            if not tokens or not tokens.get("refresh_token"):
                logger.warning(f"No refresh token found for user {user_id}")
                return False
            
            refresh_token = tokens["refresh_token"]
            
            async with aiohttp.ClientSession() as session:
                url = "https://id.twitch.tv/oauth2/token"
                data = {
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret
                }
                
                async with session.post(url, data=data) as response:
                    if response.status == 200:
                        token_data = await response.json()
                        new_access_token = token_data["access_token"]
                        new_refresh_token = token_data.get("refresh_token", refresh_token)
                        expires_in = token_data.get("expires_in", 3600)
                        
                        # Логируем реальное время жизни токена
                        logger.info(f"🔐 [TWITCH REFRESH] Token expires_in: {expires_in} seconds ({expires_in / 3600:.1f} hours)")
                        
                        # Обновляем токены в базе данных
                        from core.datetime_utils import utcnow_naive
                        from datetime import timedelta
                        expires_at = utcnow_naive() + timedelta(seconds=expires_in)
                        
                        session_manager.save_user_tokens(
                            user_id=user_id,
                            platform="twitch",
                            platform_user_id=tokens.get("platform_user_id", ""),
                            avatar_url=tokens.get("avatar_url"),
                            access_token=new_access_token,
                            refresh_token=new_refresh_token,
                            expires_at=expires_at,
                            scopes=tokens.get("scopes", [])
                        )
                        
                        # 🔥 Инвалидируем кеш после обновления токена
                        from core.token_validation_cache import token_validation_cache
                        token_validation_cache.invalidate(user_id, "twitch")
                        
                        logger.info(f"Twitch token refreshed for user {user_id}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Twitch token refresh failed: {response.status} - {error_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error refreshing Twitch token for user {user_id}: {e}")
            return False

    async def get_user_access_token(self, code: str) -> Optional[Dict[str, Any]]:
        """Получить access token пользователя по коду авторизации"""
        async with aiohttp.ClientSession() as session:
            url = "https://id.twitch.tv/oauth2/token"
            
            # Используем FormData для правильного кодирования
            form_data = aiohttp.FormData()
            form_data.add_field('client_id', self.client_id)
            form_data.add_field('client_secret', self.client_secret)
            form_data.add_field('code', code)
            form_data.add_field('grant_type', 'authorization_code')
            form_data.add_field('redirect_uri', f"{BACKEND_URL}/auth/twitch/callback")
            
            logger.info(f"[SEARCH] Twitch OAuth request: {url}")
            logger.info(f"[SEARCH] Request data: client_id={self.client_id}, code={code[:10]}..., redirect_uri={BACKEND_URL}/auth/twitch/callback")
            
            async with session.post(url, data=form_data) as response:
                response_text = await response.text()
                logger.info(f"[SEARCH] Twitch OAuth response: {response.status}")
                logger.info(f"[SEARCH] Response text: {response_text}")
                
                if response.status == 200:
                    token_data = await response.json()
                    # Парсим scopes из response - Twitch может возвращать их как строку или список
                    scope_data = token_data.get("scope", "")
                    
                    # Обрабатываем оба типа: строка или список
                    if isinstance(scope_data, list):
                        scopes = scope_data
                    elif isinstance(scope_data, str):
                        scopes = [s.strip() for s in scope_data.split()] if scope_data else []
                    else:
                        scopes = []
                    
                    # Добавляем scopes в результат
                    token_data["scopes"] = scopes
                    logger.info(f"[SEARCH] Parsed scopes: {scopes}")
                    
                    return token_data
                else:
                    logger.error(f"Failed to get user access token: {response.status}")
                    logger.error(f"Error response: {response_text}")
                    return None

    async def get_user_from_token(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о пользователе по access token"""
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}"
            }
            
            url = f"{self.base_url}/users"
            
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if data["data"]:
                        return data["data"][0]
                else:
                    logger.error(f"Failed to get user from token: {response.status}")
                return None

    async def get_category_info(self, game_id: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о категории по game_id"""
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {await self.get_app_access_token()}"
            }
            
            url = f"{self.base_url}/games"
            params = {"id": game_id}
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data["data"]:
                        return data["data"][0]
                else:
                    logger.error(f"Failed to get category info: {response.status}")
                return None

    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о пользователе по user_id"""
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {await self.get_app_access_token()}"
            }
            
            url = f"{self.base_url}/users"
            params = {"id": user_id}
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data["data"]:
                        return data["data"][0]
                else:
                    logger.error(f"Failed to get user by ID: {response.status}")
                return None

    async def get_user_by_username(self, username: str, access_token: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о пользователе по username"""
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}"
            }
            
            url = f"{self.base_url}/users"
            params = {"login": username}
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data["data"]:
                        return data["data"][0]
                else:
                    logger.error(f"Failed to get user by username {username}: {response.status}")
                return None

    async def add_channel_moderator(self, broadcaster_id: str, user_id: str, access_token: str) -> bool:
        """Добавить модератора на канал"""
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            url = f"{self.base_url}/moderation/moderators"
            params = {
                "broadcaster_id": broadcaster_id,
                "user_id": user_id
            }
            
            async with session.post(url, headers=headers, params=params) as response:
                if response.status == 204:
                    logger.info(f"[OK] Added moderator {user_id} to channel {broadcaster_id}")
                    return True
                else:
                    text = await response.text()
                    logger.error(f"Failed to add moderator: {response.status} - {text}")
                    return False

    async def remove_channel_moderator(self, broadcaster_id: str, user_id: str, access_token: str) -> bool:
        """Удалить модератора с канала"""
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}"
            }
            
            url = f"{self.base_url}/moderation/moderators"
            params = {
                "broadcaster_id": broadcaster_id,
                "user_id": user_id
            }
            
            async with session.delete(url, headers=headers, params=params) as response:
                if response.status == 204:
                    logger.info(f"[OK] Removed moderator {user_id} from channel {broadcaster_id}")
                    return True
                else:
                    text = await response.text()
                    logger.error(f"Failed to remove moderator: {response.status} - {text}")
                    return False

    async def add_channel_vip(self, broadcaster_id: str, user_id: str, access_token: str) -> bool:
        """Добавить VIP на канал"""
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            url = f"{self.base_url}/channels/vips"
            params = {
                "broadcaster_id": broadcaster_id,
                "user_id": user_id
            }
            
            async with session.post(url, headers=headers, params=params) as response:
                if response.status == 204:
                    logger.info(f"[OK] Added VIP {user_id} to channel {broadcaster_id}")
                    return True
                else:
                    text = await response.text()
                    logger.error(f"Failed to add VIP: {response.status} - {text}")
                    return False

    async def remove_channel_vip(self, broadcaster_id: str, user_id: str, access_token: str) -> bool:
        """Удалить VIP с канала"""
        async with aiohttp.ClientSession() as session:
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}"
            }
            
            url = f"{self.base_url}/channels/vips"
            params = {
                "broadcaster_id": broadcaster_id,
                "user_id": user_id
            }
            
            async with session.delete(url, headers=headers, params=params) as response:
                if response.status == 204:
                    logger.info(f"[OK] Removed VIP {user_id} from channel {broadcaster_id}")
                    return True
                else:
                    text = await response.text()
                    logger.error(f"Failed to remove VIP: {response.status} - {text}")
                    return False
    
    # === CHANNEL POINTS (CUSTOM REWARDS) METHODS ===
    
    async def get_custom_rewards(self, broadcaster_id: str, access_token: str, only_manageable: bool = False) -> Optional[List[Dict[str, Any]]]:
        """Получить список кастомных наград канала"""
        try:
            url = f"{self.base_url}/channel_points/custom_rewards"
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "broadcaster_id": broadcaster_id,
                "only_manageable_rewards": str(only_manageable).lower()
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"Got Twitch custom rewards for broadcaster {broadcaster_id}")
                        return data.get("data", [])
                    else:
                        error_text = await response.text()
                        logger.error(f"Twitch get rewards error: {response.status} - {error_text}")
                        # Выбрасываем исключение с информацией об ошибке для правильной обработки на верхнем уровне
                        if response.status == 403:
                            try:
                                import json
                                error_data = json.loads(error_text)
                                error_message = error_data.get("message", error_text)
                                raise ValueError(f"403:{error_message}")
                            except (json.JSONDecodeError, ValueError):
                                # Если не удалось распарсить JSON, используем дефолтное сообщение
                                raise ValueError(f"403:The broadcaster must have partner or affiliate status.")
                        return None
        except ValueError as e:
            # Пробрасываем ValueError дальше с информацией об ошибке
            raise
        except Exception as e:
            logger.error(f"Error getting Twitch custom rewards: {e}")
            return None
    
    async def create_custom_reward(self, broadcaster_id: str, access_token: str, reward_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Создать кастомную награду"""
        try:
            url = f"{self.base_url}/channel_points/custom_rewards"
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {"broadcaster_id": broadcaster_id}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, params=params, json=reward_data) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"Created Twitch custom reward: {reward_data.get('title')}")
                        return data.get("data", [{}])[0] if data.get("data") else None
                    else:
                        error_text = await response.text()
                        logger.error(f"Twitch create reward error: {response.status} - {error_text}")
                        return None
        except Exception as e:
            logger.error(f"Error creating Twitch custom reward: {e}")
            return None
    
    async def update_custom_reward(self, broadcaster_id: str, reward_id: str, access_token: str, reward_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Обновить кастомную награду"""
        try:
            url = f"{self.base_url}/channel_points/custom_rewards"
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "broadcaster_id": broadcaster_id,
                "id": reward_id
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.patch(url, headers=headers, params=params, json=reward_data) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"Updated Twitch custom reward: {reward_id}")
                        return data.get("data", [{}])[0] if data.get("data") else None
                    else:
                        error_text = await response.text()
                        logger.error(f"Twitch update reward error: {response.status} - {error_text}")
                        return None
        except Exception as e:
            logger.error(f"Error updating Twitch custom reward: {e}")
            return None
    
    async def delete_custom_reward(self, broadcaster_id: str, reward_id: str, access_token: str) -> bool:
        """Удалить кастомную награду"""
        try:
            url = f"{self.base_url}/channel_points/custom_rewards"
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}"
            }
            params = {
                "broadcaster_id": broadcaster_id,
                "id": reward_id
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.delete(url, headers=headers, params=params) as response:
                    if response.status == 204:
                        logger.info(f"Deleted Twitch custom reward: {reward_id}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Twitch delete reward error: {response.status} - {error_text}")
                        return False
        except Exception as e:
            logger.error(f"Error deleting Twitch custom reward: {e}")
            return False
    
    async def get_custom_reward_redemptions(
        self, 
        broadcaster_id: str, 
        reward_id: str, 
        access_token: str, 
        status: Optional[str] = None,
        sort: str = "OLDEST",
        first: int = 20
    ) -> Optional[Dict[str, Any]]:
        """Получить список использований награды"""
        try:
            url = f"{self.base_url}/channel_points/custom_rewards/redemptions"
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}"
            }
            params = {
                "broadcaster_id": broadcaster_id,
                "reward_id": reward_id,
                "sort": sort,
                "first": first
            }
            
            if status:
                params["status"] = status  # UNFULFILLED, FULFILLED, CANCELED
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data
                    else:
                        error_text = await response.text()
                        logger.error(f"Twitch get redemptions error: {response.status} - {error_text}")
                        return None
        except Exception as e:
            logger.error(f"Error getting Twitch reward redemptions: {e}")
            return None
    
    async def update_redemption_status(
        self, 
        broadcaster_id: str, 
        reward_id: str, 
        redemption_id: str, 
        access_token: str, 
        status: str
    ) -> bool:
        """Обновить статус использования награды (FULFILLED или CANCELED)"""
        try:
            url = f"{self.base_url}/channel_points/custom_rewards/redemptions"
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "broadcaster_id": broadcaster_id,
                "reward_id": reward_id,
                "id": redemption_id
            }
            body = {"status": status}  # FULFILLED or CANCELED
            
            async with aiohttp.ClientSession() as session:
                async with session.patch(url, headers=headers, params=params, json=body) as response:
                    if response.status == 200:
                        logger.info(f"Updated Twitch redemption {redemption_id} to {status}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Twitch update redemption error: {response.status} - {error_text}")
                        return False
        except Exception as e:
            logger.error(f"Error updating Twitch redemption: {e}")
            return False
    
    async def timeout_user(
        self, 
        user_id: int, 
        channel_name: str, 
        target_username: str,
        duration_seconds: int = 600,
        reason: str = "Заглушен модератором",
        db: Session = None
    ) -> bool:
        """
        Применить timeout к пользователю в Twitch чате
        
        Требует scope: moderator:manage:banned_users
        """
        try:
            # Получаем токен пользователя (стримера)
            tokens = get_user_token_from_db(user_id, 'twitch')
            if not tokens or not tokens.get('access_token'):
                logger.error(f"[TWITCH TIMEOUT] No access token for user {user_id}")
                return False
            
            access_token = tokens['access_token']
            
            # Получаем broadcaster_id (platform_user_id стримера)
            if not db:
                from core.database import get_db
                db = next(get_db())
                should_close = True
            else:
                should_close = False
            
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if not user or not user.twitch_username:
                    logger.error(f"[TWITCH TIMEOUT] No twitch_username for user {user_id}")
                    return False
                
                # Получаем broadcaster_id через API
                broadcaster_data = await self.get_user_by_username(user.twitch_username)
                if not broadcaster_data:
                    logger.error(f"[TWITCH TIMEOUT] Could not fetch broadcaster_id for {user.twitch_username}")
                    return False
                
                broadcaster_id = str(broadcaster_data['id'])
            finally:
                if should_close:
                    db.close()
            
            # Получаем user_id целевого пользователя
            target_user_data = await self.get_user_by_username(target_username)
            if not target_user_data:
                logger.error(f"[TWITCH TIMEOUT] Target user {target_username} not found")
                return False
            
            target_user_id = target_user_data['id']
            
            # Применяем timeout через Twitch API
            url = f"{self.base_url}/moderation/bans"
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "broadcaster_id": broadcaster_id,
                "moderator_id": broadcaster_id  # Стример как модератор
            }
            body = {
                "data": {
                    "user_id": target_user_id,
                    "duration": duration_seconds,
                    "reason": reason
                }
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, params=params, json=body) as response:
                    if response.status == 200:
                        logger.info(f"✅ [TWITCH TIMEOUT] User {target_username} timed out for {duration_seconds}s")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ [TWITCH TIMEOUT] Failed: {response.status} - {error_text}")
                        return False
            
        except Exception as e:
            logger.error(f"❌ [TWITCH TIMEOUT] Error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    async def untimeout_user(
        self, 
        user_id: int, 
        channel_name: str, 
        target_username: str,
        db: Session = None
    ) -> bool:
        """
        Снять timeout с пользователя в Twitch чате
        
        Требует scope: moderator:manage:banned_users
        """
        try:
            # Получаем токен пользователя (стримера)
            tokens = get_user_token_from_db(user_id, 'twitch')
            if not tokens or not tokens.get('access_token'):
                logger.error(f"[TWITCH UNTIMEOUT] No access token for user {user_id}")
                return False
            
            access_token = tokens['access_token']
            
            # Получаем broadcaster_id
            if not db:
                from core.database import get_db
                db = next(get_db())
                should_close = True
            else:
                should_close = False
            
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if not user or not user.twitch_username:
                    logger.error(f"[TWITCH UNTIMEOUT] No twitch_username for user {user_id}")
                    return False
                
                # Получаем broadcaster_id через API
                broadcaster_data = await self.get_user_by_username(user.twitch_username)
                if not broadcaster_data:
                    logger.error(f"[TWITCH UNTIMEOUT] Could not fetch broadcaster_id for {user.twitch_username}")
                    return False
                
                broadcaster_id = str(broadcaster_data['id'])
            finally:
                if should_close:
                    db.close()
            
            # Получаем user_id целевого пользователя
            target_user_data = await self.get_user_by_username(target_username)
            if not target_user_data:
                logger.error(f"[TWITCH UNTIMEOUT] Target user {target_username} not found")
                return False
            
            target_user_id = target_user_data['id']
            
            # Снимаем timeout через Twitch API (DELETE /moderation/bans)
            url = f"{self.base_url}/moderation/bans"
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {access_token}"
            }
            params = {
                "broadcaster_id": broadcaster_id,
                "moderator_id": broadcaster_id,
                "user_id": target_user_id
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.delete(url, headers=headers, params=params) as response:
                    if response.status == 204:
                        logger.info(f"✅ [TWITCH UNTIMEOUT] Timeout removed for {target_username}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ [TWITCH UNTIMEOUT] Failed: {response.status} - {error_text}")
                        return False
            
        except Exception as e:
            logger.error(f"❌ [TWITCH UNTIMEOUT] Error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    async def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о пользователе Twitch по username"""
        try:
            # Используем app access token для публичного запроса
            app_token = await self.get_app_access_token()
            if not app_token:
                logger.error("[TWITCH] Failed to get app access token")
                return None
            
            url = f"{self.base_url}/users"
            headers = {
                "Client-ID": self.client_id,
                "Authorization": f"Bearer {app_token}"
            }
            params = {"login": username.lower()}
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        users = data.get('data', [])
                        return users[0] if users else None
                    else:
                        error_text = await response.text()
                        logger.error(f"[TWITCH] Get user by username error: {response.status} - {error_text}")
                        return None
        except Exception as e:
            logger.error(f"[TWITCH] Error getting user by username: {e}")
            return None