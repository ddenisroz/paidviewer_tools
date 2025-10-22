# bot_service/twitch_api.py
import os
import time
import aiohttp
import logging
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from core.connection_manager import ConnectionManager
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
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# Проверяем загрузку переменных окружения
logger.info(f"🔍 Looking for .env file at: {env_path}")
logger.info(f"🔍 .env file exists: {os.path.exists(env_path)}")
logger.info(f"🔍 Environment check - TWITCH_CLIENT_ID loaded: {bool(os.getenv('TWITCH_CLIENT_ID'))}")
logger.info(f"🔍 Environment check - TWITCH_CLIENT_SECRET loaded: {bool(os.getenv('TWITCH_CLIENT_SECRET'))}")
logger.info(f"🔍 Environment check - TWITCH_BOT_TOKEN loaded: {bool(os.getenv('TWITCH_BOT_TOKEN'))}")

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
        
        # Дополнительная проверка secret
        logger.info(f"🔍 Client Secret length: {len(self.client_secret)}")
        logger.info(f"🔍 Client Secret contains special chars: {'+' in self.client_secret or '=' in self.client_secret}")
        logger.info(f"🔍 Client Secret starts with: {self.client_secret[:5]}")
        logger.info(f"🔍 Client Secret ends with: {self.client_secret[-5:]}")

        async with aiohttp.ClientSession() as session:
            url = "https://id.twitch.tv/oauth2/token"
            
            # Используем FormData для правильного кодирования
            form_data = aiohttp.FormData()
            form_data.add_field('client_id', self.client_id)
            form_data.add_field('client_secret', self.client_secret)
            form_data.add_field('grant_type', 'client_credentials')
            
            # Детальное логирование для отладки
            logger.info(f"🔍 Twitch OAuth2 Request URL: {url}")
            logger.info(f"🔍 Client ID: {self.client_id}")
            logger.info(f"🔍 Client Secret: {self.client_secret[:8]}...{self.client_secret[-8:] if len(self.client_secret) > 16 else '***'}")
            logger.info(f"🔍 Grant Type: client_credentials")
            
            async with session.post(url, data=form_data) as response:
                response_text = await response.text()
                logger.info(f"🔍 Twitch OAuth2 Response Status: {response.status}")
                logger.info(f"🔍 Twitch OAuth2 Response Body: {response_text}")
                
                if response.status == 200:
                    try:
                        result = await response.json()
                        self._access_token = result["access_token"]
                        self._token_expires_at = time.time() + result["expires_in"] - 60  # 60 секунд запас
                        logger.info("✅ Twitch app access token refreshed successfully")
                        return self._access_token
                    except Exception as e:
                        logger.error(f"❌ Error parsing Twitch OAuth2 response: {e}")
                        logger.error(f"❌ Raw response: {response_text}")
                        raise Exception("Failed to parse Twitch access token response")
                else:
                    logger.error(f"❌ Failed to get Twitch app access token: {response.status}")
                    logger.error(f"❌ Error response: {response_text}")
                    
                    # Попробуем понять причину ошибки
                    if response.status == 400:
                        logger.error("❌ Bad Request - возможно неправильные параметры")
                    elif response.status == 401:
                        logger.error("❌ Unauthorized - возможно неправильный client_id или client_secret")
                    elif response.status == 403:
                        logger.error("❌ Forbidden - возможно приложение не активировано или неправильные права")
                    
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
        tokens = session_manager.get_user_tokens(user_id, "twitch")
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
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to update stream title for user {user_id}: {response.status} - {error_text}")
                    logger.error(f"Request URL: {url}")
                    logger.error(f"Request data: {data}")
                    logger.error(f"Request headers: {headers}")
                    return False

    async def update_stream_category(self, user_id: int, category_id: str) -> bool:
        """Обновить категорию стрима"""
        tokens = session_manager.get_user_tokens(user_id, "twitch")
        if not tokens or not tokens.get("access_token"):
            logger.error(f"No Twitch access token found for unified user {user_id}")
            return False

        # Проверяем наличие необходимых прав в токене
        if "channel:manage:broadcast" not in tokens.get("scopes", []):
            logger.error(f"User {user_id} does not have 'channel:manage:broadcast' scope for updating stream category.")
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
            data = {"game_id": category_id}
            
            async with session.patch(url, headers=headers, json=data) as response:
                if response.status == 204:
                    logger.info(f"Stream category updated for user {user_id}")
                    return True
                else:
                    logger.error(f"Failed to update stream category for user {user_id}: {response.status}")
                    response_text = await response.text()
                    logger.error(f"Response: {response_text}")
                    logger.error(f"Request URL: {url}")
                    logger.error(f"Request data: {data}")
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
            
            logger.info(f"🔍 Twitch OAuth request: {url}")
            logger.info(f"🔍 Request data: client_id={self.client_id}, code={code[:10]}..., redirect_uri={BACKEND_URL}/auth/twitch/callback")
            
            async with session.post(url, data=form_data) as response:
                response_text = await response.text()
                logger.info(f"🔍 Twitch OAuth response: {response.status}")
                logger.info(f"🔍 Response text: {response_text}")
                
                if response.status == 200:
                    return await response.json()
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
                    logger.info(f"✅ Added moderator {user_id} to channel {broadcaster_id}")
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
                    logger.info(f"✅ Removed moderator {user_id} from channel {broadcaster_id}")
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
                    logger.info(f"✅ Added VIP {user_id} to channel {broadcaster_id}")
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
                    logger.info(f"✅ Removed VIP {user_id} from channel {broadcaster_id}")
                    return True
                else:
                    text = await response.text()
                    logger.error(f"Failed to remove VIP: {response.status} - {text}")
                    return False