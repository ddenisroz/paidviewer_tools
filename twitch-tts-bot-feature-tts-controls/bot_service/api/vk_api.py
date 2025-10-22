"""
VK Live API интеграция. Финальная, отформатированная версия.
"""
import aiohttp
import asyncio
import logging
import time
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from core.session_manager import session_manager

logger = logging.getLogger(__name__)

@dataclass
class RateLimiter:
    """Класс для контроля rate limiting"""
    last_request_time: float = 0
    max_requests_per_second: int = 3

class VKLiveAPI:
    def __init__(self):
        self.live_base_url = "https://apidev.live.vkvideo.ru"
        self.rate_limiter = RateLimiter()
        
    async def _wait_for_rate_limit(self) -> None:
        """Ожидание для соблюдения rate limiting"""
        current_time = time.time()
        time_since_last_request = current_time - self.rate_limiter.last_request_time
        if time_since_last_request < 1.0 / self.rate_limiter.max_requests_per_second:
            wait_time = (1.0 / self.rate_limiter.max_requests_per_second) - time_since_last_request
            await asyncio.sleep(wait_time)
        self.rate_limiter.last_request_time = time.time()
        
    def _get_user_token(self, user_id: str) -> Optional[str]:
        """Получить токен пользователя VK"""
        try:
            tokens = session_manager.get_user_tokens(user_id, "vk")
            if tokens and tokens.get("access_token"):
                token = tokens["access_token"]
                logger.debug(f"Retrieved VK token for user {user_id}")
                return token
            logger.warning(f"No VK token found for user {user_id}")
            return None
        except Exception as e:
            logger.error(f"Error getting VK token for user {user_id}: {e}")
            return None

    async def _refresh_user_token(self, user_id: str) -> Optional[str]:
        """Обновить токен пользователя VK используя refresh_token"""
        try:
            tokens = session_manager.get_user_tokens(user_id, "vk")
            if not tokens or not tokens.get("refresh_token"):
                logger.warning(f"No refresh token found for user {user_id}")
                return None
            
            refresh_token = tokens["refresh_token"]
            client_id = os.getenv("VK_CLIENT_ID")
            client_secret = os.getenv("VK_CLIENT_SECRET")
            
            if not all([client_id, client_secret]):
                logger.error("VK credentials not configured for token refresh")
                return None
            
            # Подготавливаем Basic Auth заголовок
            credentials = f"{client_id}:{client_secret}"
            base64_credentials = base64.b64encode(credentials.encode()).decode()
            
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Basic {base64_credentials}"
            }
            
            payload = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "redirect_uri": f"{os.getenv('BACKEND_URL', 'http://localhost:8000')}/auth/vk/callback"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://api.live.vkvideo.ru/oauth/server/token",
                    data=payload,
                    headers=headers
                ) as response:
                    if response.status == 200:
                        token_data = await response.json()
                        new_access_token = token_data["access_token"]
                        new_refresh_token = token_data.get("refresh_token", refresh_token)
                        expires_in = token_data.get("expires_in", 3600)
                        
                        # Обновляем токены в базе данных
                        from core.datetime_utils import utcnow_naive
                        from datetime import timedelta
                        expires_at = utcnow_naive() + timedelta(seconds=expires_in)
                        
                        session_manager.save_user_tokens(
                            user_id=user_id,
                            platform="vk",
                            platform_user_id=tokens.get("platform_user_id", ""),
                            username=tokens.get("username"),
                            avatar_url=tokens.get("avatar_url"),
                            access_token=new_access_token,
                            refresh_token=new_refresh_token,
                            expires_at=expires_at,
                            scopes=tokens.get("scopes", [])
                        )
                        
                        logger.info(f"VK token refreshed for user {user_id}")
                        return new_access_token
                    else:
                        error_text = await response.text()
                        logger.error(f"VK token refresh failed: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"Error refreshing VK token for user {user_id}: {e}")
            return None

    async def search_categories(self, query: str, user_id: str) -> Optional[List[Dict[str, Any]]]:
        """Поиск категорий VK Live по названию"""
        token = self._get_user_token(user_id)
        if not token:
            logger.error(f"No VK token found for user {user_id}")
            return None
            
        await self._wait_for_rate_limit()
        categories = []
        
        try:
            url = f"{self.live_base_url}/v1/category/search"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                # Ищем в обеих категориях: games и irl (общение, творчество, etc.)
                for cat_type in ["game", "irl"]:
                    params = {
                        "query": query or "a",
                        "type": cat_type,
                        "limit": 25
                    }
                    
                    async with session.get(url, params=params, headers=headers) as response:
                        logger.info(f"VK categories search: {cat_type} - status: {response.status}")
                        if response.status == 200:
                            try:
                                data = await response.json(content_type=None)
                                if not data or not isinstance(data, dict):
                                    logger.warning(f"VK API returned invalid data structure for {cat_type}: {data}")
                                    continue
                                    
                                data_section = data.get("data")
                                if not data_section or not isinstance(data_section, dict):
                                    logger.warning(f"VK API missing 'data' section for {cat_type}: {data}")
                                    continue
                                    
                                cats = data_section.get("categories")
                                if not cats or not isinstance(cats, list):
                                    logger.warning(f"VK API missing or invalid 'categories' for {cat_type}: {cats}")
                                    continue
                                    
                                for cat in cats:
                                    if not cat or not isinstance(cat, dict):
                                        continue
                                        
                                    counters = cat.get("counters") or {}
                                    categories.append({
                                        "id": cat.get("id", ""),
                                        "name": cat.get("title", ""),
                                        "viewers": counters.get("viewers", 0) if isinstance(counters, dict) else 0,
                                        "box_art_url": cat.get("cover_url", ""),
                                    })
                            except Exception as e:
                                logger.error(f"Error parsing VK API JSON response ({cat_type}): {e}")
                                import traceback
                                logger.error(f"Traceback: {traceback.format_exc()}")
                        else:
                            response_text = await response.text()
                            logger.warning(f"VK categories search failed for {cat_type}: {response.status} - {response_text}")
            
            logger.info(f"Found {len(categories)} VK Live categories total for query '{query}'")
            return list({cat['id']: cat for cat in categories}.values())  # Убираем дубликаты
                        
        except Exception as e:
            logger.error(f"Error searching VK Live categories: {e}")
            return None

    async def _get_current_user_info(self, token: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о текущем пользователе через VK Live API."""
        await self._wait_for_rate_limit()
        try:
            async with aiohttp.ClientSession() as session:
                headers = {"Authorization": f"Bearer {token}"}
                url = f"{self.live_base_url}/v1/current_user"
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"Successfully got user info: {data}")
                        if isinstance(data, dict) and "data" in data:
                            return data["data"]
                    else:
                        logger.warning(f"Endpoint /v1/current_user returned {response.status}: {await response.text()}")
        except Exception as e:
            logger.error(f"VK Live API /v1/current_user request failed: {e}")
        return None
    
    async def get_stream_info(self, user_id: str) -> Dict[str, Any]:
        """Получить информацию о стриме, опираясь на статус стрима в ответе /v1/channel."""
        default_offline = {
            "online": False, "title": "Стрим оффлайн", "category": "Общение",
            "viewer_count": 0, "started_at": "", "stream_key": "",
            "description": "", "thumbnail": ""
        }
        try:
            token = self._get_user_token(user_id)
            if not token:
                return default_offline

            user_info = await self._get_current_user_info(token)
            if not (user_info and user_info.get("channel") and user_info["channel"].get("url")):
                logger.warning(f"Could not get channel URL for user {user_id}")
                return default_offline
            
            channel_url = user_info["channel"]["url"]
            
            await self._wait_for_rate_limit()
            async with aiohttp.ClientSession() as session:
                headers = {"Authorization": f"Bearer {token}"}
                url = f"{self.live_base_url}/v1/channel" 
                params = {"channel_url": channel_url}

                async with session.get(url, headers=headers, params=params) as response:
                    if response.status != 200:
                        logger.warning(f"Failed to get channel info for '{channel_url}'. Status: {response.status}, Body: {await response.text()}")
                        return default_offline
                        
                    data = await response.json()
                    logger.info(f"Channel data for '{channel_url}': {data}")

                    if isinstance(data, dict) and "data" in data and "stream" in data["data"]:
                        stream = data["data"].get("stream")
                        if stream and stream.get('status') == 'started':
                            logger.info(f"Stream status for '{channel_url}' is 'started'. Stream is online.")
                            category = stream.get("category", {})
                            return {
                                "online": True, 
                                "title": stream.get("title", "Без названия"),
                                "category": category.get("title", "Без категории") if category else "Без категории",
                                "viewer_count": stream.get("counters", {}).get("viewers", 0),
                                "started_at": stream.get("planned_at", ""),
                                "stream_key": stream.get("id", ""), 
                                "description": stream.get("description", ""), 
                                "thumbnail": stream.get("preview_url", "")
                            }
                        else:
                            stream_status = stream.get('status') if stream else 'no stream object'
                            logger.debug(f"Stream for '{channel_url}' is not active. Status: '{stream_status}'.")
                            
                            # Извлекаем данные офлайн стрима если они есть
                            category_id = None
                            category_name = 'Общение'
                            title = "Стрим оффлайн"
                            description = ""
                            
                            if stream and isinstance(stream, dict):
                                if stream.get("category"):
                                    category_id = stream["category"].get("id")
                                    category_name = stream["category"].get("title", 'Общение')
                                title = stream.get("title", "Стрим оффлайн")
                                description = stream.get("description", "")
                            
                            return {
                                'online': False,
                                'title': title,
                                'category': category_name,
                                'category_id': category_id,
                                'viewer_count': 0,
                                'started_at': '',
                                'stream_key': '',
                                'description': description,
                                'thumbnail': ''
                            }
                    else:
                        logger.warning(f"No 'stream' object in channel data for '{channel_url}'.")
                        return default_offline

        except Exception as e:
            logger.error(f"Error getting VK stream info for {user_id}: {e}")
            return default_offline

    async def _update_stream(self, user_id: str, payload: Dict[str, Any]) -> bool:
        """Вспомогательный метод для обновления данных стрима (JSON)."""
        try:
            token = self._get_user_token(user_id)
            if not token:
                return False

            user_info = await self._get_current_user_info(token)
            if not (user_info and user_info.get("channel") and user_info["channel"].get("url")):
                logger.warning(f"Could not get channel URL for user {user_id} to update.")
                return False

            channel_url = user_info["channel"]["url"]
            
            async with aiohttp.ClientSession() as session:
                headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                
                # ШАГ 1: Получаем текущий активный стрим
                get_url = f"{self.live_base_url}/v1/channel"
                get_params = {"channel_url": channel_url}
                current_stream_data = None
                
                async with session.get(get_url, headers={"Authorization": f"Bearer {token}"}, params=get_params) as response:
                    if response.status == 200:
                        data = await response.json()
                        # Ищем активный стрим в "stream" или "streams"
                        stream_object = data.get("data", {}).get("stream")
                        if stream_object and stream_object.get("status") == "started":
                            current_stream_data = stream_object
                            logger.info("Found active stream in 'stream' object.")
                        else:
                            streams_array = data.get("data", {}).get("streams", [])
                            for s in streams_array:
                                if s.get("status") == "started":
                                    current_stream_data = s
                                    logger.info("Found active stream in 'streams' array.")
                                    break
                
                if not current_stream_data:
                    logger.warning(f"Could not find an active stream for {user_id} to update. Trying to get saved stream data...")
                    # Если стрим оффлайн, попробуем получить сохранённые данные стрима
                    stream_info = await self.get_stream_info(user_id)
                    if stream_info and stream_info.get("category_id"):
                        current_stream_data = {
                            "title": stream_info.get("title", ""),
                            "category": {"id": stream_info["category_id"]}
                        }
                        logger.info(f"Using saved stream data for offline stream: title='{current_stream_data['title']}', category_id='{current_stream_data['category']['id']}'")
                    else:
                        logger.error(f"Cannot update stream for {user_id}: no active stream and no saved category data.")
                        return False
                
                # ШАГ 2: Собираем полный payload, смешивая старые и новые данные
                final_payload = {
                    "title": current_stream_data.get("title", ""),
                    "category": {
                        "id": current_stream_data.get("category", {}).get("id")
                    }
                }

                # Перезаписываем новыми данными из payload
                if "title" in payload:
                    final_payload["title"] = payload["title"]
                if "category" in payload and "id" in payload["category"]:
                    final_payload["category"]["id"] = payload["category"]["id"]

                # Проверка, что ID категории не пустой, т.к. API этого требует
                if not final_payload["category"]["id"]:
                    logger.error(f"Cannot update stream for {user_id} because category ID is missing and no current category found.")
                    return False

                # ШАГ 3: Отправляем запрос на обновление
                await self._wait_for_rate_limit()
                
                post_url = f"{self.live_base_url}/v1/channel/stream/edit"
                post_params = {"channel_url": channel_url}
                post_data = {"stream": final_payload}
                
                logger.info(f"Sending final update payload for {user_id}: {post_data}")
                
                async with session.post(post_url, headers=headers, json=post_data, params=post_params) as response:
                    if response.status == 200:
                        logger.info(f"Successfully updated VK Live stream for user {user_id}")
                        return True
                    else:
                        response_text = await response.text()
                        logger.warning(f"VK Live stream edit for user {user_id} returned {response.status}: {response_text}")
                        return False
        except Exception as e:
            logger.error(f"Error updating stream for user {user_id}: {e}")
            return False

    async def update_stream_title(self, user_id: str, title: str) -> bool:
        """Обновить название стрима VK Live"""
        # Получаем текущую информацию о стриме чтобы сохранить категорию
        current_stream_info = await self.get_stream_info(user_id)
        payload = {"title": title}
        
        # Если есть текущая категория, сохраняем её
        if current_stream_info and current_stream_info.get("category_id"):
            payload["category"] = {"id": current_stream_info["category_id"]}
        
        return await self._update_stream(user_id, payload)

    async def update_stream_category(self, user_id: str, category_id: str) -> bool:
        """Обновить категорию стрима VK Live"""
        return await self._update_stream(user_id, {"category": {"id": category_id}})

    async def get_categories(self, search: str = "", user_id: str = None) -> List[Dict[str, Any]]:
        """Получить список категорий VK Live"""
        categories = []
        try:
            # Получаем токен для авторизации
            token = None
            if user_id:
                token = self._get_user_token(user_id)
            if not token:
                # Берем любой доступный токен для публичного API
                from core.database import UserToken, get_db
                db = next(get_db())
                try:
                    vk_token = db.query(UserToken).filter_by(platform='vk').first()
                    if vk_token:
                        token = vk_token.access_token
                finally:
                    db.close()
            
            if not token:
                logger.warning("No VK token available for categories API")
                return []

            await self._wait_for_rate_limit()
            async with aiohttp.ClientSession() as session:
                url = f"{self.live_base_url}/v1/category/search"
                headers = {"Authorization": f"Bearer {token}"}
                
                async def fetch_cats(cat_type: str):
                    params = {"query": search or "a", "type": cat_type, "limit": 50}
                    logger.info(f"Fetching VK categories: {url} with params: {params}")
                    async with session.get(url, headers=headers, params=params) as response:
                        logger.info(f"VK categories response: status={response.status}")
                        if response.status == 200:
                            data = await response.json()
                            logger.info(f"VK categories data: {data}")
                            if isinstance(data, dict) and "data" in data and "categories" in data["data"]:
                                for cat in data["data"]["categories"]:
                                    categories.append({
                                        "id": cat.get("id", ""), 
                                        "name": cat.get("title", ""),
                                        "viewers": cat.get("counters", {}).get("viewers", 0),
                                        "box_art_url": cat.get("cover_url", ""),
                                    })
                        else:
                            response_text = await response.text()
                            logger.warning(f"VK categories API returned {response.status}: {response_text}")
                
                await asyncio.gather(fetch_cats("game"), fetch_cats("irl"), return_exceptions=True)
            
            logger.info(f"Total VK categories found: {len(categories)}")
            return list({v['id']: v for v in categories}.values())
        except Exception as e:
            logger.error(f"Error getting VK categories: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []

    async def get_viewer_count(self, user_id: str) -> int:
        """Получить количество зрителей VK Live"""
        stream_info = await self.get_stream_info(user_id)
        if stream_info and stream_info.get("online"):
            return stream_info.get("viewer_count", 0)
        return 0
    
    # === CHANNEL POINTS METHODS ===
    
    async def get_channel_points_balance(self, channel_url: str, access_token: str) -> Optional[Dict[str, Any]]:
        """Получить баланс баллов канала"""
        try:
            url = f"{self.base_url}/v1/channel_point"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {"channel_url": channel_url}
            
            async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
                response = await client.get(url, headers=headers, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Got VK channel points balance for {channel_url}")
                    return data.get("data")
                else:
                    logger.error(f"VK channel points balance error: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting VK channel points balance: {e}")
            return None
    
    async def get_channel_rewards(self, channel_url: str, access_token: str) -> Optional[List[Dict[str, Any]]]:
        """Получить список наград канала"""
        try:
            url = f"{self.base_url}/v1/channel_point/rewards"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {"channel_url": channel_url}
            
            async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
                response = await client.get(url, headers=headers, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("data", {}).get("rewards", [])
                else:
                    logger.error(f"VK channel rewards error: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting VK channel rewards: {e}")
            return None
    
    async def create_channel_reward(self, channel_url: str, access_token: str, reward_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Создать награду канала"""
        try:
            url = f"{self.base_url}/v1/channel_point/reward/create"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {"channel_url": channel_url}
            
            body = {"reward": reward_data}
            
            async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
                response = await client.post(url, headers=headers, params=params, json=body, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Created VK channel reward: {reward_data.get('name')}")
                    return data.get("data")
                else:
                    logger.error(f"VK create reward error: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error creating VK channel reward: {e}")
            return None
    
    async def get_reward_demands(self, channel_url: str, access_token: str, limit: int = 20, offset: int = 0) -> Optional[Dict[str, Any]]:
        """Получить список запросов наград"""
        try:
            url = f"{self.base_url}/v1/channel_point/reward/demands"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": channel_url,
                "limit": limit,
                "offset": offset
            }
            
            async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
                response = await client.get(url, headers=headers, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("data")
                else:
                    logger.error(f"VK reward demands error: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting VK reward demands: {e}")
            return None
    
    async def accept_reward_demands(self, channel_url: str, access_token: str, demand_ids: List[int]) -> bool:
        """Принять запросы наград"""
        try:
            url = f"{self.base_url}/v1/channel_point/reward/demand/accept"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {"channel_url": channel_url}
            
            body = {"demands": [{"id": demand_id} for demand_id in demand_ids]}
            
            async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
                response = await client.post(url, headers=headers, params=params, json=body, timeout=10)
                
                if response.status_code == 200:
                    logger.info(f"Accepted VK reward demands: {demand_ids}")
                    return True
                else:
                    logger.error(f"VK accept demands error: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error accepting VK reward demands: {e}")
            return False
    
    async def reject_reward_demands(self, channel_url: str, access_token: str, demand_ids: List[int]) -> bool:
        """Отклонить запросы наград"""
        try:
            url = f"{self.base_url}/v1/channel_point/reward/demand/reject"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {"channel_url": channel_url}
            
            body = {"demands": [{"id": demand_id} for demand_id in demand_ids]}
            
            async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
                response = await client.post(url, headers=headers, params=params, json=body, timeout=10)
                
                if response.status_code == 200:
                    logger.info(f"Rejected VK reward demands: {demand_ids}")
                    return True
                else:
                    logger.error(f"VK reject demands error: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error rejecting VK reward demands: {e}")
            return False

vk_api = VKLiveAPI()
