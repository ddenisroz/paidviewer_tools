"""
Twitch platform implementation
"""
import logging
from typing import Optional, Dict, Any, List
from .base import StreamingPlatform, PlatformConfig

logger = logging.getLogger(__name__)


class TwitchPlatform(StreamingPlatform):
    """Twitch streaming platform implementation"""

    def __init__(self):
        config = PlatformConfig(
            name='twitch',
            display_name='Twitch',
            supports_oauth=True,
            supports_chat=True,
            supports_tts=True,
            supports_points=True,
            supports_categories=True,
            color='#9146FF'
        )
        super().__init__(config)

        # Import TwitchAPI lazily to avoid circular imports
        self._twitch_api = None

    @property
    def twitch_api(self):
        """Lazy load TwitchAPI instance"""
        if self._twitch_api is None:
            from api.twitch_api import TwitchAPI
            from core.connection_manager import connection_manager
            self._twitch_api = TwitchAPI(connection_manager)
        return self._twitch_api

    async def authenticate(self, code: str) -> Dict[str, Any]:
        """
        Handle Twitch OAuth authentication
        
        Args:
            code: OAuth authorization code
            
        Returns:
            Dict containing access_token, refresh_token, expires_in, scopes
        """
        try:
            token_data = await self.twitch_api.get_user_access_token(code)
            if not token_data:
                raise Exception("Failed to get access token from Twitch")

            return token_data
        except Exception as e:
            logger.error(f"Twitch authentication error: {e}")
            raise

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """
        Get Twitch user information
        
        Args:
            access_token: User's access token
            
        Returns:
            Dict containing id, login, display_name, profile_image_url, etc.
        """
        try:
            user_info = await self.twitch_api.get_user_from_token(access_token)
            if not user_info:
                raise Exception("Failed to get user info from Twitch")

            return user_info
        except Exception as e:
            logger.error(f"Error getting Twitch user info: {e}")
            raise

    async def update_stream_title(self, user_id: int, title: str) -> bool:
        """
        Update Twitch stream title
        
        Args:
            user_id: Unified user ID from database
            title: New stream title
            
        Returns:
            True if successful, False otherwise
        """
        try:
            return await self.twitch_api.update_stream_title(user_id, title)
        except Exception as e:
            logger.error(f"Error updating Twitch stream title: {e}")
            return False

    async def update_stream_category(self, user_id: int, category_id: str) -> bool:
        """
        Update Twitch stream category
        
        Args:
            user_id: Unified user ID from database
            category_id: Twitch game ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            return await self.twitch_api.update_stream_category(user_id, category_id)
        except Exception as e:
            logger.error(f"Error updating Twitch stream category: {e}")
            return False

    async def search_categories(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for Twitch categories
        
        Args:
            query: Search query
            
        Returns:
            List of category dicts with id, name, box_art_url
        """
        try:
            return await self.twitch_api.search_categories(query)
        except Exception as e:
            logger.error(f"Error searching Twitch categories: {e}")
            return []

    async def get_stream_status(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Get current Twitch stream status
        
        Args:
            username: Twitch username
            
        Returns:
            Dict with stream info if online, None if offline
        """
        try:
            return await self.twitch_api.get_stream_info(username)
        except Exception as e:
            logger.error(f"Error getting Twitch stream status: {e}")
            return None

    async def get_channel_info(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Get Twitch channel information
        
        Args:
            username: Twitch username
            
        Returns:
            Dict with channel info (title, game_name, etc.)
        """
        try:
            return await self.twitch_api.get_channel_info(username)
        except Exception as e:
            logger.error(f"Error getting Twitch channel info: {e}")
            return None

    async def send_chat_message(self, user_id: int, message: str) -> bool:
        """
        Send message to Twitch chat
        
        Args:
            user_id: Unified user ID from database
            message: Message to send
            
        Returns:
            True if successful, False otherwise
        """
        # This would require bot integration
        # For now, return False as it's not implemented in the abstraction
        logger.warning("send_chat_message not yet implemented for Twitch platform abstraction")
        return False

    async def create_reward(self, user_id: int, reward_data: Dict) -> Optional[str]:
        """
        Create Twitch channel points reward
        
        Args:
            user_id: Unified user ID from database
            reward_data: Reward configuration
            
        Returns:
            Reward ID if successful, None otherwise
        """
        # This would use the Twitch API's custom rewards endpoint
        # Implementation would go here
        logger.warning("create_reward not yet implemented for Twitch platform abstraction")
        return None

    async def update_reward(self, user_id: int, reward_id: str, reward_data: Dict) -> bool:
        """
        Update Twitch channel points reward
        
        Args:
            user_id: Unified user ID from database
            reward_id: Twitch reward ID
            reward_data: Updated reward configuration
            
        Returns:
            True if successful, False otherwise
        """
        logger.warning("update_reward not yet implemented for Twitch platform abstraction")
        return False

    async def delete_reward(self, user_id: int, reward_id: str) -> bool:
        """
        Delete Twitch channel points reward
        
        Args:
            user_id: Unified user ID from database
            reward_id: Twitch reward ID
            
        Returns:
            True if successful, False otherwise
        """
        logger.warning("delete_reward not yet implemented for Twitch platform abstraction")
        return False

    async def get_user_roles(self, username: str, channel_name: str) -> List[str]:
        """
        Get user roles on a Twitch channel
        
        Args:
            username: User's Twitch username
            channel_name: Channel name
            
        Returns:
            List of role strings (broadcaster, moderator, vip, subscriber, viewer)
        """
        # This would use the existing platform_role_checker utility
        try:
            # This requires author_data from chat context
            # For now, return empty list as it needs chat integration
            logger.debug(f"get_user_roles called for {username} on {channel_name}")
            return []
        except Exception as e:
            logger.error(f"Error getting Twitch user roles: {e}")
            return []
