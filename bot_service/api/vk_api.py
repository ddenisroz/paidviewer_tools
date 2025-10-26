"""
VK Live API интеграция. Финальная, отформатированная версия.
"""
import aiohttp
import asyncio
import logging
import time

# Глобальный timeout для VK API запросов (10 секунд)
VK_API_TIMEOUT = aiohttp.ClientTimeout(total=10)
import os
import base64
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from core.token_utils import get_user_token_from_db
from core.token_manager import token_manager
from core.session_manager import session_manager
from constants import DEFAULT_BACKEND_URL

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
        
    def _get_user_token(self, user_id: str, session_id: Optional[str] = None) -> Optional[str]:
        """
        Получить токен пользователя VK через TokenManager.
        
        Args:
            user_id: ID пользователя
            session_id: ID сессии (опционально). Если передан - используется безопасная проверка linked_platforms
        
        Returns:
            Access token или None
        """
        try:
            # 🚀 UNIFIED: Используем TokenManager для единообразного получения токенов
            user_id_int = int(user_id) if isinstance(user_id, str) else user_id
            return token_manager.get_user_token(
                user_id=user_id_int,
                platform="vk",
                session_id=session_id,
                require_session_check=session_id is not None  # Проверяем session только если он передан
            )
        except Exception as e:
            logger.error(f"Error getting VK token for user {user_id}: {e}")
            return None

    async def _refresh_user_token(self, user_id: int) -> Optional[str]:
        """Обновить токен пользователя VK используя refresh_token"""
        try:
            tokens = get_user_token_from_db(user_id, "vk")
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
                "redirect_uri": f"{os.getenv('BACKEND_URL', DEFAULT_BACKEND_URL)}/auth/vk/callback"
            }
            
            async with aiohttp.ClientSession(timeout=VK_API_TIMEOUT) as session:
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
                            avatar_url=tokens.get("avatar_url"),
                            access_token=new_access_token,
                            refresh_token=new_refresh_token,
                            expires_at=expires_at,
                            scopes=tokens.get("scopes", [])
                        )
                        
                        # 🔥 Инвалидируем кеш после обновления токена
                        from core.token_validation_cache import token_validation_cache
                        token_validation_cache.invalidate(user_id, "vk")
                        
                        logger.info(f"VK token refreshed for user {user_id}")
                        return new_access_token
                    else:
                        error_text = await response.text()
                        logger.error(f"VK token refresh failed: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"Error refreshing VK token for user {user_id}: {e}")
            return None

    async def search_categories(self, query: str, user_id: str, session_id: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
        """Поиск категорий VK Live по названию
        
        NOTE: Требует токен стримера (из OAuth). Если стример не авторизован - вернет пустой список.
        """
        token = self._get_user_token(user_id, session_id)
        if not token:
            logger.info(f"User {user_id} has not authorized VK Live via OAuth. Categories unavailable.")
            return []
            
        await self._wait_for_rate_limit()
        categories = []
        
        try:
            url = f"{self.live_base_url}/v1/category/search"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession(timeout=VK_API_TIMEOUT) as session:
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
        """Получить информацию о текущем пользователе через VK Live API.
        
        NOTE: Этот метод требует токен СТРИМЕРА (из OAuth), НЕ токен бота!
        Токен бота (VK_LIVE_USER_TOKEN) предназначен только для работы в чате.
        """
        await self._wait_for_rate_limit()
        try:
            async with aiohttp.ClientSession(timeout=VK_API_TIMEOUT) as session:
                headers = {"Authorization": f"Bearer {token}"}
                url = f"{self.live_base_url}/v1/current_user"
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"✅ Successfully got VK Live user info")
                        if isinstance(data, dict) and "data" in data:
                            return data["data"]
                    elif response.status == 401:
                        # 401 - нормально если используется токен бота вместо стримера
                        logger.debug(f"ℹ️ /v1/current_user returned 401. This is expected if using bot token instead of streamer token.")
                        return None
                    else:
                        logger.warning(f"Endpoint /v1/current_user returned {response.status}: {await response.text()}")
        except Exception as e:
            logger.error(f"VK Live API /v1/current_user request failed: {e}")
        return None
    
    async def get_stream_info(self, user_id: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Получить информацию о стриме, опираясь на статус стрима в ответе /v1/channel."""
        default_offline = {
            "online": False, "title": "Стрим оффлайн", "category": "Общение",
            "viewer_count": 0, "started_at": "", "stream_key": "",
            "description": "", "thumbnail": ""
        }
        try:
            token = self._get_user_token(user_id, session_id)
            if not token:
                logger.info(f"User {user_id} has not authorized VK Live via OAuth. Bot can work in chat, but stream info unavailable.")
                return {
                    **default_offline,
                    "title": "VK Live бот работает (Stream info недоступен)",
                    "description": "Авторизуйтесь через настройки для получения информации о стриме"
                }

            # Используем vk_channel_name из БД вместо запроса /v1/current_user (экономим 30 сек!)
            from core.database import User, SessionLocal
            db = SessionLocal()
            try:
                user_record = db.query(User).filter(User.id == int(user_id)).first()
                if not user_record or not user_record.vk_channel_name:
                    logger.warning(f"Could not get channel URL for user {user_id} from database")
                    return default_offline
                channel_url = user_record.vk_channel_name
                logger.info(f"✅ [VK API] Using cached channel_url from DB: {channel_url}")
            finally:
                db.close()
            
            await self._wait_for_rate_limit()
            async with aiohttp.ClientSession(timeout=VK_API_TIMEOUT) as session:
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
                                "category_id": category.get("id") if category else None,
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

    async def _update_stream(self, user_id: str, payload: Dict[str, Any], session_id: Optional[str] = None) -> bool:
        """Вспомогательный метод для обновления данных стрима (JSON)."""
        try:
            logger.info(f"📺 [VK API] _update_stream called for user {user_id} with payload: {payload}")
            
            token = self._get_user_token(user_id, session_id)
            if not token:
                logger.error(f"❌ [VK API] No token found for user {user_id}")
                return False
            
            logger.info(f"✅ [VK API] Token retrieved for user {user_id}")

            # Используем vk_channel_name из БД вместо запроса /v1/current_user (экономим 30 сек!)
            from core.database import User, SessionLocal
            db = SessionLocal()
            try:
                user_record = db.query(User).filter(User.id == int(user_id)).first()
                if not user_record or not user_record.vk_channel_name:
                    logger.warning(f"❌ [VK API] Could not get channel URL for user {user_id} from database")
                    return False
                channel_url = user_record.vk_channel_name
                logger.info(f"✅ [VK API] Using cached channel_url from DB: {channel_url}")
            finally:
                db.close()
            
            async with aiohttp.ClientSession(timeout=VK_API_TIMEOUT) as session:
                headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                
                # ШАГ 1: Получаем текущий активный стрим
                get_url = f"{self.live_base_url}/v1/channel"
                get_params = {"channel_url": channel_url}
                current_stream_data = None
                
                logger.info(f"📺 [VK API] Fetching current stream from {get_url}")
                async with session.get(get_url, headers={"Authorization": f"Bearer {token}"}, params=get_params) as response:
                    if response.status == 200:
                        data = await response.json()
                        # Ищем активный стрим в "stream" или "streams"
                        stream_object = data.get("data", {}).get("stream")
                        if stream_object and stream_object.get("status") == "started":
                            current_stream_data = stream_object
                            logger.info("✅ [VK API] Found active stream in 'stream' object.")
                        else:
                            streams_array = data.get("data", {}).get("streams", [])
                            for s in streams_array:
                                if s.get("status") == "started":
                                    current_stream_data = s
                                    logger.info("✅ [VK API] Found active stream in 'streams' array.")
                                    break
                
                if not current_stream_data:
                    logger.warning(f"⚠️ [VK API] Could not find an active stream for {user_id}. Will try to edit anyway (VK API will reject if not allowed).")
                    # Используем сохраненные данные из get_stream_info
                    stream_info = await self.get_stream_info(user_id)
                    if stream_info and stream_info.get("category_id"):
                        current_stream_data = {
                            "title": stream_info.get("title", ""),
                            "category": {"id": str(stream_info["category_id"])}  # Конвертируем в строку
                        }
                        logger.info(f"✅ [VK API] Using saved stream data: title='{current_stream_data['title']}', category_id='{current_stream_data['category']['id']}'")
                    else:
                        logger.warning(f"⚠️ [VK API] No saved stream data for {user_id}. Will try to update anyway with provided payload.")
                        # Продолжаем выполнение - используем только то что пришло в payload
                        current_stream_data = {}
                
                # ШАГ 2: Собираем полный payload, смешивая старые и новые данные
                current_category_id = current_stream_data.get("category", {}).get("id")
                # VK API требует category.id как СТРОКУ, но НЕ None!
                if current_category_id is not None and not isinstance(current_category_id, str):
                    current_category_id = str(current_category_id)
                
                final_payload = {
                    "title": current_stream_data.get("title", ""),
                    "category": {
                        "id": current_category_id if current_category_id else ""  # Пустая строка вместо None
                    }
                }
                
                # Добавляем description если есть
                if current_stream_data.get("description"):
                    final_payload["description"] = current_stream_data.get("description")
                    logger.info(f"📺 [VK API] Including description: {final_payload['description'][:50]}...")

                # Перезаписываем новыми данными из payload
                if "title" in payload:
                    final_payload["title"] = payload["title"]
                    logger.info(f"📺 [VK API] Updating title to: {final_payload['title']}")
                
                logger.info(f"📺 [VK API] Checking category update: 'category' in payload = {'category' in payload}")
                if "category" in payload:
                    logger.info(f"📺 [VK API] payload['category'] = {payload['category']}")
                    logger.info(f"📺 [VK API] 'id' in payload['category'] = {'id' in payload['category']}")
                
                if "category" in payload and "id" in payload["category"]:
                    # VK API требует ПОЛНЫЙ объект категории, не только ID
                    category_id = payload["category"]["id"]
                    logger.info(f"📺 [VK API] Category ID from payload: {category_id} (type: {type(category_id).__name__})")
                    
                    if not isinstance(category_id, str):
                        category_id = str(category_id)
                        logger.info(f"📺 [VK API] Converted category_id to string: {category_id}")
                    
                    # Загружаем полную информацию о категории если есть только ID
                    logger.info(f"📺 [VK API] Checking if need full category: 'title' in payload['category'] = {'title' in payload['category']}")
                    if "title" not in payload["category"]:
                        logger.info(f"📺 [VK API] ⚠️ STARTING TO LOAD FULL CATEGORY FOR ID: {category_id}")
                        try:
                            # Запрос информации о категории
                            cat_url = f"{self.live_base_url}/v1/category"
                            cat_params = {"category_id": category_id}
                            async with session.get(cat_url, headers=headers, params=cat_params) as cat_response:
                                if cat_response.status == 200:
                                    cat_data = await cat_response.json()
                                    full_category = cat_data.get("data", {}).get("category", {})
                                    if full_category:
                                        # Формируем category БЕЗ пустого cover_url (VK API не принимает пустые строки!)
                                        category_obj = {
                                            "id": str(category_id),  # VK API требует строку
                                            "title": full_category.get("title", ""),
                                            "type": full_category.get("type", "games")
                                        }
                                        # Добавляем cover_url ТОЛЬКО если он не пустой
                                        cover_url = full_category.get("cover_url", "")
                                        if cover_url:
                                            category_obj["cover_url"] = cover_url
                                        
                                        final_payload["category"] = category_obj
                                        logger.info(f"✅ [VK API] Loaded full category: {final_payload['category']}")
                                    else:
                                        # Если не удалось загрузить, используем только ID
                                        final_payload["category"]["id"] = category_id
                                else:
                                    # Если не удалось загрузить, используем только ID
                                    final_payload["category"]["id"] = category_id
                        except Exception as e:
                            logger.error(f"❌ [VK API] Failed to load category info: {e}")
                            final_payload["category"]["id"] = category_id
                    else:
                        # Если уже есть полная информация, используем её
                        # НО! Удаляем пустой cover_url (VK API не принимает пустые строки)
                        category_id_raw = payload["category"]["id"]
                        
                        category_update = {
                            "id": str(category_id_raw),  # VK API требует строку
                            "title": payload["category"].get("title", ""),
                            "type": payload["category"].get("type", "games")
                        }
                        # Добавляем cover_url только если он не пустой
                        cover_url = payload["category"].get("cover_url", "")
                        if cover_url:
                            category_update["cover_url"] = cover_url
                            logger.info(f"📺 [VK API] Including cover_url in category: {cover_url}")
                        else:
                            logger.info(f"📺 [VK API] Skipping empty cover_url")
                        
                        final_payload["category"] = category_update
                    
                    logger.info(f"📺 [VK API] Updating category to: {final_payload['category']}")

                # Проверка, что ID категории не пустой, т.к. API этого требует
                if not final_payload["category"]["id"]:
                    logger.error(f"❌ [VK API] Cannot update stream for {user_id} because category ID is missing.")
                    return False

                # ШАГ 3: Отправляем запрос на обновление
                await self._wait_for_rate_limit()
                
                post_url = f"{self.live_base_url}/v1/channel/stream/edit"
                post_params = {"channel_url": channel_url}
                post_data = {"stream": final_payload}
                
                # Детальное логирование для отладки
                import json
                logger.info(f"📺 [VK API] Sending update to {post_url}")
                logger.info(f"📺 [VK API] Params: {post_params}")
                logger.info(f"📺 [VK API] Payload (dict): {post_data}")
                logger.info(f"📺 [VK API] Payload (JSON): {json.dumps(post_data, ensure_ascii=False)}")
                logger.info(f"📺 [VK API] Category ID type: {type(final_payload['category']['id']).__name__} = {final_payload['category']['id']!r}")
                logger.info(f"📺 [VK API] Full category object: {final_payload['category']}")
                
                async with session.post(post_url, headers=headers, json=post_data, params=post_params) as response:
                    logger.info(f"📺 [VK API] Response status: {response.status}")
                    
                    if response.status == 200:
                        logger.info(f"✅ [VK API] Successfully updated VK Live stream for user {user_id}")
                        return True
                    else:
                        response_text = await response.text()
                        logger.error(f"❌ [VK API] Stream edit for user {user_id} returned {response.status}")
                        logger.error(f"   Response: {response_text}")
                        logger.error(f"   URL: {post_url}")
                        logger.error(f"   Payload: {post_data}")
                        return False
        except Exception as e:
            logger.error(f"❌ [VK API] Error updating stream for user {user_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False

    async def update_stream_title(self, user_id: str, title: str, session_id: Optional[str] = None) -> bool:
        """Обновить название стрима VK Live"""
        # Получаем текущую информацию о стриме чтобы сохранить категорию
        current_stream_info = await self.get_stream_info(user_id, session_id)
        payload = {"title": title}
        
        # Если есть текущая категория, сохраняем её
        if current_stream_info and current_stream_info.get("category_id"):
            payload["category"] = {"id": current_stream_info["category_id"]}
        
        return await self._update_stream(user_id, payload, session_id)

    async def update_stream_category(self, user_id: str, category_data, session_id: Optional[str] = None) -> bool:
        """Обновить категорию стрима VK Live
        
        Args:
            user_id: ID пользователя
            category_data: Либо строка (category_id), либо dict с полным объектом категории
                           Dict должен содержать: {"id": str, "title": str, "cover_url": str, "type": str}
            session_id: ID сессии для проверки безопасности (опционально)
        """
        # Получаем текущую информацию о стриме чтобы сохранить название
        current_stream_info = await self.get_stream_info(user_id, session_id)
        logger.info(f"📺 [VK API] Current stream info retrieved: {current_stream_info}")
        
        # Формируем объект категории
        if isinstance(category_data, dict):
            # Полный объект категории - используем его
            category_obj = {
                "id": str(category_data.get("id", "")),
                "title": category_data.get("title", ""),
                "type": category_data.get("type", "games")
            }
            
            # Добавляем cover_url ТОЛЬКО если он не пустой (VK API не принимает пустые строки!)
            cover_url = category_data.get("cover_url", "")
            if cover_url:
                category_obj["cover_url"] = cover_url
                logger.info(f"📺 [VK API] Using full category object with cover_url: {category_obj}")
            else:
                logger.info(f"📺 [VK API] Using full category object WITHOUT cover_url: {category_obj}")
        else:
            # Только ID - создаем минимальный объект (может не работать!)
            category_obj = {"id": str(category_data)}
            logger.warning(f"📺 [VK API] Using minimal category object (only ID): {category_obj}")
        
        payload = {"category": category_obj}
        
        # Если есть текущее название, сохраняем его
        if current_stream_info and current_stream_info.get("title"):
            payload["title"] = current_stream_info["title"]
            logger.info(f"📺 [VK API] Preserving current title: {payload['title']}")
        
        logger.info(f"📺 [VK API] Sending update with payload: {payload}")
        result = await self._update_stream(user_id, payload, session_id)
        
        if result:
            logger.info(f"✅ [VK API] Category updated successfully for user {user_id}")
        else:
            logger.error(f"❌ [VK API] Failed to update category for user {user_id}")
        
        return result

    async def get_categories(self, search: str = "", user_id: str = None, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Получить список категорий VK Live
        
        Автоматически обновляет токен если он истёк перед запросом.
        """
        logger.info(f"📺 [VK CATEGORIES] Fetching for user {user_id}, search: '{search}'")
        
        token = self._get_user_token(user_id, session_id)
        
        # Если токена нет или если получим 401, пытаемся обновить через refresh token
        if not token:
            logger.info(f"No token found for user {user_id}, attempting refresh...")
            token = await self._refresh_user_token(user_id)
        
        if not token:
            logger.warning(f"User {user_id} has no VK token")
            return []
        
        categories = []
        
        try:
            await self._wait_for_rate_limit()
            async with aiohttp.ClientSession(timeout=VK_API_TIMEOUT) as session:
                url = f"{self.live_base_url}/v1/category/search"
                headers = {"Authorization": f"Bearer {token}"}
                
                async def fetch_cats(cat_type: str):
                    params = {"query": search or "a", "type": cat_type, "limit": 50}
                    logger.info(f"📺 [VK CATEGORIES] Fetching {cat_type}: {params}")
                    try:
                        async with session.get(url, headers=headers, params=params) as response:
                            logger.info(f"📺 [VK CATEGORIES] Response {cat_type}: status={response.status}")
                            
                            # Если 401 - токен истёк, пытаемся обновить
                            if response.status == 401:
                                logger.warning("VK token expired (401), attempting to refresh...")
                                new_token = await self._refresh_user_token(user_id)
                                if new_token:
                                    headers["Authorization"] = f"Bearer {new_token}"
                                    # Пробуем ещё раз
                                    async with session.get(url, headers=headers, params=params) as retry_response:
                                        if retry_response.status == 200:
                                            data = await retry_response.json()
                                            if isinstance(data, dict) and "data" in data and "categories" in data["data"]:
                                                for cat in data["data"]["categories"]:
                                                    categories.append({
                                                        "id": cat.get("id", ""), 
                                                        "name": cat.get("title", ""),
                                                        "viewers": (cat.get("counters") or {}).get("viewers", 0),
                                                        "box_art_url": cat.get("cover_url", ""),
                                                    })
                                            logger.info(f"✅ Refreshed VK categories after token update: {len(categories)} found")
                                            return
                                        else:
                                            logger.error(f"VK categories API still failed after refresh: {retry_response.status}")
                                return
                            
                            if response.status == 200:
                                data = await response.json()
                                if isinstance(data, dict) and "data" in data and "categories" in data["data"]:
                                    for cat in data["data"]["categories"]:
                                        categories.append({
                                            "id": cat.get("id", ""), 
                                            "name": cat.get("title", ""),
                                            "viewers": (cat.get("counters") or {}).get("viewers", 0),
                                            "box_art_url": cat.get("cover_url", ""),
                                        })
                            else:
                                response_text = await response.text()
                                logger.warning(f"VK categories API returned {response.status}: {response_text[:200]}")
                    except Exception as e:
                        logger.error(f"Error fetching {cat_type} categories: {e}")
                
                await asyncio.gather(fetch_cats("game"), fetch_cats("irl"), return_exceptions=True)
            
            logger.info(f"📺 [VK CATEGORIES] Total found: {len(categories)}")
            return list({v['id']: v for v in categories}.values())
        except Exception as e:
            logger.error(f"❌ [VK CATEGORIES] Error: {e}")
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
    
    async def delete_channel_reward(self, channel_url: str, reward_id: str, access_token: str) -> bool:
        """Удалить награду канала"""
        try:
            url = f"{self.base_url}/v1/channel_point/reward/delete"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": channel_url,
                "reward_id": reward_id
            }
            
            async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
                response = await client.post(url, headers=headers, params=params, timeout=10)
                
                if response.status_code == 200:
                    logger.info(f"Deleted VK channel reward: {reward_id}")
                    return True
                else:
                    logger.error(f"VK delete reward error: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error deleting VK channel reward: {e}")
            return False
    
    async def update_channel_reward(self, channel_url: str, reward_id: str, access_token: str, reward_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Редактировать награду канала"""
        try:
            url = f"{self.base_url}/v1/channel_point/reward/edit"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": channel_url,
                "reward_id": reward_id
            }
            
            body = {"reward": reward_data}
            
            async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
                response = await client.post(url, headers=headers, params=params, json=body, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Updated VK channel reward: {reward_id}")
                    return data.get("data")
                else:
                    logger.error(f"VK update reward error: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error updating VK channel reward: {e}")
            return None
    
    async def enable_channel_reward(self, channel_url: str, reward_id: str, access_token: str) -> bool:
        """Включить награду канала"""
        try:
            url = f"{self.base_url}/v1/channel_point/reward/enable"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": channel_url,
                "reward_id": reward_id
            }
            
            async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
                response = await client.post(url, headers=headers, params=params, timeout=10)
                
                if response.status_code == 200:
                    logger.info(f"Enabled VK channel reward: {reward_id}")
                    return True
                else:
                    logger.error(f"VK enable reward error: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error enabling VK channel reward: {e}")
            return False
    
    async def disable_channel_reward(self, channel_url: str, reward_id: str, access_token: str) -> bool:
        """Отключить награду канала"""
        try:
            url = f"{self.base_url}/v1/channel_point/reward/disable"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": channel_url,
                "reward_id": reward_id
            }
            
            async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
                response = await client.post(url, headers=headers, params=params, timeout=10)
                
                if response.status_code == 200:
                    logger.info(f"Disabled VK channel reward: {reward_id}")
                    return True
                else:
                    logger.error(f"VK disable reward error: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error disabling VK channel reward: {e}")
            return False

vk_api = VKLiveAPI()

# ============================================================================
# FastAPI Роутеры для VK Live API
# ============================================================================
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from core.database import get_db, UserToken
from auth.auth import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/vk", tags=["vk"])

class UpdateCategoryRequest(BaseModel):
    categoryId: str

class UpdateTitleRequest(BaseModel):
    title: str

@router.post("/update-category")
async def update_vk_category(
    request: UpdateCategoryRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить категорию VK Live стрима"""
    try:
        user_id = current_user.get('id')
        session_id = current_user.get('session_id')
        category_id = request.categoryId
        
        logger.info(f"🔄 Updating VK category for user {user_id} to {category_id}")
        
        result = await vk_api.update_stream_category(user_id, category_id, session_id)
        
        if result:
            return JSONResponse(content={"success": True, "message": "Категория успешно обновлена"})
        else:
            raise HTTPException(status_code=400, detail="Не удалось обновить категорию")
            
    except Exception as e:
        logger.error(f"Error updating VK category: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка обновления категории: {str(e)}")

@router.post("/update-title")
async def update_vk_title(
    request: UpdateTitleRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить название VK Live стрима"""
    try:
        user_id = current_user.get('id')
        session_id = current_user.get('session_id')
        title = request.title
        
        logger.info(f"🔄 Updating VK title for user {user_id} to '{title}'")
        
        result = await vk_api.update_stream_title(user_id, title, session_id)
        
        if result:
            return JSONResponse(content={"success": True, "message": "Название успешно обновлено"})
        else:
            raise HTTPException(status_code=400, detail="Не удалось обновить название")
            
    except Exception as e:
        logger.error(f"Error updating VK title: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка обновления названия: {str(e)}")

@router.get("/categories")
async def get_vk_categories(
    search: str = "",
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получить список категорий VK Live"""
    try:
        user_id = current_user.get('id') if current_user else None
        session_id = current_user.get('session_id') if current_user else None
        
        logger.info(f"📺 [VK CATEGORIES] Fetching for user {user_id} with search: '{search}'")
        
        # Получаем VK токен пользователя или любой доступный токен для публичного API
        user_token = None
        if user_id:
            user_token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == 'vk'
            ).first()
        
        # Если у пользователя нет токена, берем любой доступный VK токен
        if not user_token or not user_token.access_token:
            logger.info(f"📺 [VK CATEGORIES] User {user_id} has no VK token, looking for any available VK token...")
            user_token = db.query(UserToken).filter(
                UserToken.platform == 'vk',
                UserToken.access_token.isnot(None)
            ).first()
        
        if not user_token or not user_token.access_token:
            logger.warning(f"❌ [VK CATEGORIES] No VK token available")
            return JSONResponse(
                content={"success": False, "categories": [], "error": "No VK token found"},
                status_code=200
            )
        
        categories = await vk_api.get_categories(search=search, user_id=str(user_id) if user_id else None, session_id=session_id)
        
        logger.info(f"✅ [VK CATEGORIES] Found {len(categories)} categories")
        
        return JSONResponse(
            content={"success": True, "categories": categories},
            status_code=200
        )
            
    except Exception as e:
        logger.error(f"❌ [VK CATEGORIES] Error: {e}")
        return JSONResponse(
            content={"success": False, "categories": [], "error": str(e)},
            status_code=500
        )

@router.get("/stream-info")
async def get_vk_stream_info(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить информацию о VK Live стриме"""
    try:
        user_id = current_user.get('id')
        session_id = current_user.get('session_id')
        
        stream_info = await vk_api.get_stream_info(user_id, session_id)
        
        if stream_info:
            return JSONResponse(content=stream_info)
        else:
            return JSONResponse(content={"success": False, "message": "Стрим не найден"})
            
    except Exception as e:
        logger.error(f"Error getting VK stream info: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)
