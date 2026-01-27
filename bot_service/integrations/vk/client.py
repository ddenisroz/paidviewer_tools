
import logging
from typing import Optional, Dict, Any, List, Union
import aiohttp

from integrations.base import BaseIntegrationClient, TokenInfo, IntegrationError, RateLimitError
from integrations.vk.oauth import VKOAuth

logger = logging.getLogger(__name__)

class VKClient(BaseIntegrationClient):
    """
    VK Live API Client.
    """
    PROD_BASE_URL = "https://api.live.vkvideo.ru"
    DEV_BASE_URL = "https://apidev.live.vkvideo.ru"
    BASE_URL = DEV_BASE_URL
    
    def __init__(self, oauth: VKOAuth):
        super().__init__(self.BASE_URL)
        self.oauth = oauth

    async def _get_headers(self, token: Optional[TokenInfo] = None) -> Dict[str, str]:
        """
        Headers with Authorization.
        """
        if not token or not token.access_token:
            # Some public endpoints might not need it, but most do.
            return {"Content-Type": "application/json"}
        return {
            "Authorization": f"Bearer {token.access_token}",
            "Content-Type": "application/json"
        }

    async def _request_with_base(
        self,
        base_url: str,
        method: str,
        endpoint: str,
        token: Optional[TokenInfo] = None,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        data: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Выполнить запрос с временным base_url (для прод-эндпоинтов).
        """
        url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        headers = await self._get_headers(token)
        session = await self._get_session()

        last_error: Optional[Exception] = None
        for attempt in range(self.MAX_RETRIES):
            try:
                async with session.request(
                    method,
                    url,
                    headers=headers,
                    params=params,
                    json=json_data,
                    data=data,
                ) as response:
                    return await self._handle_response(response)
            except aiohttp.ClientError as e:
                last_error = e
                logger.warning(
                    f"[INTEGRATION] {self.__class__.__name__} request failed "
                    f"(attempt {attempt + 1}/{self.MAX_RETRIES}): {e}"
                )
                if attempt < self.MAX_RETRIES - 1:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)

        raise IntegrationError(
            f"Request failed after {self.MAX_RETRIES} attempts",
            original_error=last_error
        )

    # ==================== User ====================

    def _format_channel_url(self, channel_url: str) -> str:
        if not channel_url:
            return channel_url
        if channel_url.startswith('http://') or channel_url.startswith('https://'):
            return channel_url
        return f"https://live.vkvideo.ru/{channel_url}"

    async def get_current_user(self, token: TokenInfo) -> Optional[Dict[str, Any]]:
        """Get info about current user (streamer)."""
        try:
            result = await self.get("v1/current_user", token=token)
            return result.get("data")
        except IntegrationError as e:
            logger.error(f"[VK client] Failed to get user info: {e}")
            raise

    # ==================== Stream ====================

    async def get_stream_info(self, channel_url: str, token: TokenInfo) -> Dict[str, Any]:
        """
        Get info about the stream.
        Note: VK requires 'channel_url', not just ID, for public read often.
        If using token, we might get it via current_user or specific endpoint.
        """
        # Based on vk_stream.py logic
        default_offline = {
            "online": False, "title": "Стрим оффлайн", "category": "Общение",
            "viewer_count": 0, "started_at": ""
        }
        
        try:
            params = {"channel_url": self._format_channel_url(channel_url)}
            # Using token allows seeing drafts/latency info etc.
            result = await self.get("v1/channel", token=token, params=params)
            data = result.get("data", {})
            
            stream = data.get("stream")
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
            
            # Offline fallback
            title = "Стрим оффлайн"
            category_name = "Общение"
            category_id = None
            if stream:
                 title = stream.get("title", title)
                 if stream.get("category"):
                     category_id = stream["category"].get("id")
                     category_name = stream["category"].get("title", category_name)

            return {
                **default_offline,
                "title": title,
                "category": category_name,
                "category_id": category_id
            }

        except IntegrationError as e:
            logger.error(f"[VK client] Failed to get stream info: {e}")
            return default_offline

    async def update_stream(self, channel_url: str, token: TokenInfo, title: Optional[str] = None, category_id: Optional[str] = None) -> bool:
        """
        Update stream title or category.
        Requires getting current state first to merge.
        """
        try:
            # 1. Get current state
            try:
                current_data = await self.get("v1/channel", token=token, params={"channel_url": self._format_channel_url(channel_url)})
                stream_info = current_data.get("data", {}).get("stream", {})
            except Exception:
                stream_info = {}

            # 2. Build payload
            current_cat_id = None
            if stream_info.get("category"):
                 current_cat_id = stream_info["category"].get("id")

            payload = {
                "title": title if title is not None else stream_info.get("title", "")
            }
            resolved_category_id = str(category_id) if category_id else (str(current_cat_id) if current_cat_id else None)
            if resolved_category_id:
                payload["category"] = {"id": resolved_category_id}
            if stream_info.get("description"):
                payload["description"] = stream_info.get("description")

            # 3. Update
            body = {"stream": payload}
            await self._request_with_base(
                self.PROD_BASE_URL,
                "POST",
                "v1/channel/stream/edit",
                token=token,
                params={"channel_url": self._format_channel_url(channel_url)},
                json_data=body
            )
            logger.info(f"[VK client] Updated stream for {channel_url}")
            return True

        except IntegrationError as e:
            logger.error(f"[VK client] Failed to update stream: {e}")
            return False

    async def search_categories(self, query: str, token: TokenInfo) -> List[Dict[str, Any]]:
        """Search categories."""
        try:
            params = {"search": query, "type": "game", "limit": "20"}
            result = await self._request_with_base(
                self.PROD_BASE_URL,
                "GET",
                "v1/public_video_stream/category/",
                token=token,
                params=params
            )

            categories = []
            if isinstance(result, dict) and "data" in result:
                cats = result.get("data", [])
                for cat in cats:
                    if cat:
                        categories.append({
                            "id": cat.get("id"),
                            "name": cat.get("title"),
                            "box_art_url": cat.get("coverUrl")
                        })
            return categories
        except IntegrationError as e:
            logger.error(f"[VK client] Failed to search categories: {e}")
            return []

    # ==================== Rewards ====================

    async def get_custom_rewards(self, channel_url: str, token: TokenInfo) -> List[Dict[str, Any]]:
        """Get custom rewards."""
        try:
            result = await self.get("v1/channel_point/rewards", token=token, params={"channel_url": self._format_channel_url(channel_url)})
            return result.get("data", {}).get("rewards", [])
        except IntegrationError as e:
             logger.error(f"[VK client] Failed to get rewards: {e}")
             return []

    async def create_custom_reward(self, channel_url: str, token: TokenInfo, reward_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create reward."""
        try:
            body = {"reward": reward_data}
            result = await self.post("v1/channel_point/reward/create", token=token, 
                                   params={"channel_url": self._format_channel_url(channel_url)}, json_data=body)
            return result.get("data")
        except IntegrationError as e:
            logger.error(f"[VK client] Failed to create reward: {e}")
            return None

    async def delete_custom_reward(self, channel_url: str, reward_id: str, token: TokenInfo) -> bool:
        """Delete reward."""
        try:
            params = {"channel_url": channel_url, "reward_id": reward_id}
            await self.post("v1/channel_point/reward/delete", token=token, params=params)
            return True
        except IntegrationError as e:
             logger.error(f"[VK client] Failed to delete reward: {e}")
             return False

    async def update_custom_reward(self, channel_url: str, reward_id: str, token: TokenInfo, reward_data: Dict[str, Any]) -> bool:
        """Update reward."""
        try:
            params = {"channel_url": channel_url, "reward_id": reward_id}
            body = {"reward": reward_data}
            await self.post("v1/channel_point/reward/edit", token=token, params=params, json_data=body)
            return True
        except IntegrationError as e:
             logger.error(f"[VK client] Failed to update reward: {e}")
             return False
