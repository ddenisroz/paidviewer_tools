"""
VK API Stream Module
Handles stream information, updates, and category management.
"""
import logging
from typing import Optional, Dict, Any, List, Union

import aiohttp

from core.database import SessionLocal
from .vk_auth import VKAuth
from .vk_base import VK_API_TIMEOUT

logger = logging.getLogger(__name__)

class VKStream(VKAuth):
    """
    Stream management methods for VK Live API.
    Refereces VKAuth for token management.
    """

    def _get_channel_url_from_db(self, user_id: str) -> Optional[str]:
        """Get cached vk_channel_name from database."""
        try:
            db = SessionLocal()
            try:
                from repositories.user_repository import UserRepository
                repo = UserRepository(db)
                user_record = repo.get_by_id(int(user_id))
                if user_record and user_record.vk_channel_name:
                    return user_record.vk_channel_name
                return None
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error getting channel URL from DB for user {user_id}: {e}")
            return None

    async def search_categories(self, query: str, user_id: Optional[str], session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Search VK Live categories by name.
        Requires streamer token.
        """


        if not user_id:
            logger.warning("[VK API] Search categories called without user_id")
            return []

        token = self._get_user_token(user_id, session_id)

        await self.rate_limiter.wait()
        categories: List[Dict[str, Any]] = []

        try:
            url = f"{self.BASE_URL}/v1/category/search"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }

            async with aiohttp.ClientSession(timeout=VK_API_TIMEOUT) as session:
                # Search in both 'game' and 'irl' types
                for cat_type in ["game", "irl"]:
                    params: Dict[str, Union[str, int]] = {
                        "query": str(query or "a"),
                        "type": str(cat_type),
                        "limit": 25
                    }

                    # Use ssl_context for dev API
                    async with session.get(url, params=params, headers=headers, ssl=self.ssl_context) as response:
                        logger.debug(f"VK categories search: {cat_type} - status: {response.status}")
                        if response.status == 200:
                            try:
                                data = await response.json(content_type=None)
                                if not data or not isinstance(data, dict):
                                    continue

                                data_section = data.get("data")
                                if not data_section or not isinstance(data_section, dict):
                                    continue

                                cats = data_section.get("categories")
                                if not cats or not isinstance(cats, list):
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
                        else:
                            response_text = await response.text()
                            logger.warning(f"VK categories search failed for {cat_type}: {response.status} - {response_text}")

            logger.info(f"Found {len(categories)} VK Live categories total for query '{query}'")
            # Deduplicate by ID
            unique_categories = {cat['id']: cat for cat in categories}
            return list(unique_categories.values())

        except Exception as e:
            logger.error(f"Error searching VK Live categories: {e}")
            return []

    async def get_stream_info(self, user_id: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Get information about the current stream."""
        default_offline = {
            "online": False, "title": "Стрим оффлайн", "category": "Общение",
            "viewer_count": 0, "started_at": "", "stream_key": "",
            "description": "", "thumbnail": ""
        }
        try:
            token = self._get_user_token(user_id, session_id)
            if not token:
                logger.info(f"User {user_id} has not authorized VK Live via OAuth. Stream info unavailable.")
                return {
                    **default_offline,
                    "title": "VK Live бот работает (Stream info недоступен)",
                    "description": "Авторизуйтесь через настройки для получения информации о стриме"
                }

            # Get cached channel_url from DB
            channel_url = self._get_channel_url_from_db(user_id)
            if not channel_url:
                logger.warning(f"Could not get channel URL for user {user_id} from database")
                return default_offline

            logger.info(f"[OK] [VK API] Using cached channel_url from DB: {channel_url}")

            await self.rate_limiter.wait()
            async with aiohttp.ClientSession(timeout=VK_API_TIMEOUT) as session:
                headers = {"Authorization": f"Bearer {token}"}
                url = f"{self.BASE_URL}/v1/channel"
                params = {"channel_url": channel_url}

                async with session.get(url, headers=headers, params=params, ssl=self.ssl_context) as response:
                    if response.status != 200:
                        logger.warning(f"Failed to get channel info for '{channel_url}'. Status: {response.status}")
                        return default_offline

                    data = await response.json()
                    
                    if isinstance(data, dict) and "data" in data and "stream" in data["data"]:
                        stream = data["data"].get("stream")
                        if stream and stream.get('status') == 'started':
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
                            # Offline processing
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
        """Helper to update stream data (title, category)."""
        try:
            logger.info(f"[VK API] _update_stream called for user {user_id} with payload: {payload}")

            token = self._get_user_token(user_id, session_id)
            if not token:
                logger.error(f"[ERROR] [VK API] No token found for user {user_id}")
                return False

            # Get cached channel_url from DB
            channel_url = self._get_channel_url_from_db(user_id)
            if not channel_url:
                logger.error(f"[ERROR] [VK API] Could not get channel URL for user {user_id}")
                return False

            async with aiohttp.ClientSession(timeout=VK_API_TIMEOUT) as session:
                headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                
                # STEP 1: Get current stream to merge data
                get_url = f"{self.BASE_URL}/v1/channel"
                get_params = {"channel_url": channel_url}
                current_stream_data = {}

                async with session.get(get_url, headers={"Authorization": f"Bearer {token}"}, params=get_params, ssl=self.ssl_context) as response:
                    if response.status == 200:
                        data = await response.json()
                        stream_object = data.get("data", {}).get("stream")
                        if stream_object and stream_object.get("status") == "started":
                            current_stream_data = stream_object
                        else:
                            streams_array = data.get("data", {}).get("streams", [])
                            for s in streams_array:
                                if s.get("status") == "started":
                                    current_stream_data = s
                                    break
                
                if not current_stream_data:
                    # Fallback to get_stream_info logic if not found active
                    stream_info = await self.get_stream_info(user_id)
                    if stream_info and stream_info.get("category_id"):
                        current_stream_data = {
                            "title": stream_info.get("title", ""),
                            "category": {"id": str(stream_info["category_id"])} 
                        }

                # STEP 2: Build final payload
                current_category_id = current_stream_data.get("category", {}).get("id")
                if current_category_id is not None:
                    current_category_id = str(current_category_id)

                final_payload = {
                    "title": current_stream_data.get("title", ""),
                    "category": {
                        "id": current_category_id if current_category_id else ""
                    }
                }

                if current_stream_data.get("description"):
                    final_payload["description"] = current_stream_data.get("description")

                # Override with new data
                if "title" in payload:
                    final_payload["title"] = payload["title"]

                if "category" in payload:
                    if "id" in payload["category"]:
                        category_id = str(payload["category"]["id"])
                        
                        # Load full category info if we only have ID but want to be safe
                        # The logic from monolithic file was complex handling 'cover_url' requirements
                        # Here we try to simplify: if we have full object, use it. If not, try to fetch or use ID.
                        
                        if "title" in payload["category"]:
                            # We have full object
                            category_obj = {
                                "id": category_id,
                                "title": payload["category"].get("title", ""),
                                "type": payload["category"].get("type", "games")
                            }
                            # Only add cover_url if present
                            if payload["category"].get("cover_url"):
                                category_obj["cover_url"] = payload["category"]["cover_url"]
                            
                            final_payload["category"] = category_obj
                        else:
                            # We only have ID, try to fetch full info because VK API is picky
                            try:
                                cat_url = f"{self.BASE_URL}/v1/category"
                                cat_params = {"category_id": category_id}
                                async with session.get(cat_url, headers=headers, params=cat_params, ssl=self.ssl_context) as cat_res:
                                    if cat_res.status == 200:
                                        cat_data = await cat_res.json()
                                        full_category = cat_data.get("data", {}).get("category", {})
                                        if full_category:
                                            category_obj = {
                                                "id": category_id,
                                                "title": full_category.get("title", ""),
                                                "type": full_category.get("type", "games")
                                            }
                                            if full_category.get("cover_url"):
                                                category_obj["cover_url"] = full_category["cover_url"]
                                            final_payload["category"] = category_obj
                                        else:
                                             final_payload["category"]["id"] = category_id
                                    else:
                                        final_payload["category"]["id"] = category_id
                            except Exception:
                                final_payload["category"]["id"] = category_id

                # Ensure ID is present
                if not final_payload["category"].get("id"):
                    logger.error("[ERROR] [VK API] Missing category ID for update")
                    return False

                # STEP 3: Send Update
                await self.rate_limiter.wait()
                post_url = f"{self.BASE_URL}/v1/channel/stream/edit"
                post_params = {"channel_url": channel_url}
                post_data = {"stream": final_payload}

                async with session.post(post_url, headers=headers, json=post_data, params=post_params, ssl=self.ssl_context) as response:
                    if response.status == 200:
                        logger.info(f"[OK] [VK API] Successfully updated stream for user {user_id}")
                        return True
                    else:
                        logger.error(f"[ERROR] [VK API] Stream edit failed: {response.status} - {await response.text()}")
                        return False

        except Exception as e:
            logger.error(f"[ERROR] [VK API] Error updating stream for user {user_id}: {e}")
            return False

    async def update_stream_title(self, user_id: str, title: str, session_id: Optional[str] = None) -> bool:
        """Update stream title."""
        # Get current category to preserve it
        current_stream_info = await self.get_stream_info(user_id, session_id)
        payload: Dict[str, Any] = {"title": title}

        if current_stream_info and current_stream_info.get("category_id"):
            category_data_fixed: Dict[str, Any] = {"id": str(current_stream_info["category_id"])}
            payload["category"] = category_data_fixed

        return await self._update_stream(user_id, payload, session_id)

    async def update_stream_category(self, user_id: str, category_data: Union[str, Dict[str, Any]], session_id: Optional[str] = None) -> bool:
        """Update stream category."""
        # Get current title to preserve it
        current_stream_info = await self.get_stream_info(user_id, session_id)
        
        # Prepare category object
        if isinstance(category_data, dict):
            category_obj = {
                "id": str(category_data.get("id", "")),
                "title": category_data.get("title", ""),
                "type": category_data.get("type", "games")
            }
            if category_data.get("cover_url"):
                category_obj["cover_url"] = category_data["cover_url"]
        else:
            category_obj = {"id": str(category_data)}

        payload = {"category": category_obj}

        if current_stream_info and current_stream_info.get("title"):
            payload["title"] = current_stream_info["title"]

        return await self._update_stream(user_id, payload, session_id)
    
    async def get_categories(self, search: str = "", user_id: Optional[str] = None, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Wraps search_categories for compatibility."""
        return await self.search_categories(search, user_id, session_id)

    async def get_viewer_count(self, user_id: str) -> int:
        """Get live viewer count."""
        stream_info = await self.get_stream_info(user_id)
        if stream_info and stream_info.get("online"):
            return int(stream_info.get("viewer_count", 0))
        return 0
