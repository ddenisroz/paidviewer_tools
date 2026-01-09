import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from core.database import User
from platforms.registry import platform_registry
from services.stream_session_service import StreamSessionService

logger = logging.getLogger(__name__)

class StreamInfoService:
    """
    Service for managing stream information and updates across platforms.
    Interacts with PlatformRegistry and StreamSessionService.
    """

    def __init__(self, db: Session):
        self.db = db
        self.session_service = StreamSessionService(db)

    async def get_stream_info(self, user_id: int, platform_name: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get stream info and update session tracking.
        """
        platform = platform_registry.get(platform_name)
        if not platform:
            logger.warning(f"Platform {platform_name} not found")
            return self._empty_info()

        # Get stream status from platform
        # Note: Platform implementations might vary in signature, ideally unified.
        # TwitchPlatform: get_stream_status(username) -> but we have user_id. 
        # We need a method get_stream_status_by_user_id on StreamingPlatform if possible.
        # But base.py has get_stream_status(username).
        
        # We need to resolve username.
        # We need to resolve username.
        from repositories.user_repository import UserRepository
        user = UserRepository(self.db).get(user_id)
        if not user:
             return self._empty_info()
        
        username = None
        if platform_name == 'twitch':
            username = user.twitch_username
        elif platform_name == 'vk':
            username = user.vk_channel_name or user.vk_username # VKPlatform uses channel name
            
        if not username:
             return self._empty_info()

        # Fetch Info
        # VKPlatform has get_stream_status_for_user(user_id) which handles tokens better.
        # TwitchPlatform uses get_stream_status(username) which handles generic lookup.
        stream_info = None
        
        if hasattr(platform, 'get_stream_status_for_user'):
             stream_info = await platform.get_stream_status_for_user(user_id)
        else:
             stream_info = await platform.get_stream_status(username)

        is_live = stream_info is not None and (stream_info.get('is_live') or stream_info.get('online') or stream_info.get('type') == 'live')
        
        # Get Channel Info (title, game) if stream_info doesn't have it fully or we want offline info
        channel_info = None
        if not stream_info: # If offline, we still want title/game
             channel_info = await platform.get_channel_info(username)
        
        # Unify Result
        result = self._empty_info()
        
        if stream_info:
             result.update(stream_info)
             result['is_live'] = True
             result['viewers'] = stream_info.get('viewer_count', 0)
        elif channel_info:
             result.update(channel_info)
             
        # Session Tracking logic
        title = result.get('title', "")
        
        if is_live and username:
             self.session_service.get_or_create_active_session(
                user_id=user_id,
                session_id=session_id,
                channel_name=username.lower(),
                platform=platform_name,
                title=title
             )
        elif not is_live and username:
             self.session_service.end_session(
                user_id=user_id,
                session_id=session_id,
                channel_name=username.lower(),
                platform=platform_name
             )
             
        # Normalize keys for Frontend
        # Frontend expects: is_live, title, category, viewers, etc.
        # VK returns 'category' object or 'category_id'. Twitch returns 'game_name', 'game_id'.
        
        if platform_name == 'twitch':
             result['game'] = result.get('game_name') # Frontend expects 'game'
        
        return result

    async def update_stream(self, user_id: int, platform_name: str, title: Optional[str] = None, category_id: Optional[str] = None) -> bool:
        """
        Update stream title/category.
        """
        platform = platform_registry.get(platform_name)
        if not platform:
             return False
             
        success = True
        if title is not None:
             if not await platform.update_stream_title(user_id, title):
                 success = False
        
        if category_id is not None:
             if not await platform.update_stream_category(user_id, category_id):
                 success = False
                 
        return success

    async def search_categories(self, platform_name: str, query: str, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Search categories.
        """
        platform = platform_registry.get(platform_name)
        if not platform:
             return []
             
        if user_id and hasattr(platform, 'search_categories_for_user'):
             return await platform.search_categories_for_user(query, user_id)
        
        return await platform.search_categories(query)

    def _empty_info(self):
        return {
            "is_live": False,
            "title": "",
            "game_id": None,
            "game": None,
            "category": None,
            "viewers": 0,
            "started_at": None,
            "language": "ru"
        }
