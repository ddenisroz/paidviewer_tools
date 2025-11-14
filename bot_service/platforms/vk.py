"""
VK Live platform implementation
"""
import logging
from typing import Optional, Dict, Any, List
from .base import StreamingPlatform, PlatformConfig

logger = logging.getLogger(__name__)


class VKPlatform(StreamingPlatform):
    """VK Live streaming platform implementation"""
    
    def __init__(self):
        config = PlatformConfig(
            name='vk',
            display_name='VK Live',
            supports_oauth=True,
            supports_chat=True,
            supports_tts=True,
            supports_points=True,
            supports_categories=True,
            color='#0077FF'
        )
        super().__init__(config)
        
        # Import VKLiveAPI lazily to avoid circular imports
        self._vk_api = None
    
    @property
    def vk_api(self):
        """Lazy load VKLiveAPI instance"""
        if self._vk_api is None:
            from api.vk_api import VKLiveAPI
            self._vk_api = VKLiveAPI()
        return self._vk_api
    
    async def authenticate(self, code: str) -> Dict[str, Any]:
        """
        Handle VK Live OAuth authentication
        
        Args:
            code: OAuth authorization code
            
        Returns:
            Dict containing access_token, refresh_token, expires_in, scopes
        """
        # VK authentication is handled in auth/vk_auth.py
        # This method is here for interface compliance
        # The actual OAuth flow uses the existing vk_auth.py implementation
        raise NotImplementedError("VK authentication is handled by auth/vk_auth.py")
    
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """
        Get VK Live user information
        
        Args:
            access_token: User's access token
            
        Returns:
            Dict containing user info
        """
        try:
            user_info = await self.vk_api._get_current_user_info(access_token)
            if not user_info:
                raise Exception("Failed to get user info from VK Live")
            
            return user_info
        except Exception as e:
            logger.error(f"Error getting VK user info: {e}")
            raise
    
    async def update_stream_title(self, user_id: int, title: str) -> bool:
        """
        Update VK Live stream title
        
        Args:
            user_id: Unified user ID from database
            title: New stream title
            
        Returns:
            True if successful, False otherwise
        """
        try:
            return await self.vk_api.update_stream_title(str(user_id), title)
        except Exception as e:
            logger.error(f"Error updating VK stream title: {e}")
            return False
    
    async def update_stream_category(self, user_id: int, category_id: str) -> bool:
        """
        Update VK Live stream category
        
        Args:
            user_id: Unified user ID from database
            category_id: VK category ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            return await self.vk_api.update_stream_category(str(user_id), category_id)
        except Exception as e:
            logger.error(f"Error updating VK stream category: {e}")
            return False
    
    async def search_categories(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for VK Live categories
        
        Args:
            query: Search query
            
        Returns:
            List of category dicts with id, name, box_art_url
        """
        try:
            # VK API requires user_id for category search
            # For now, return empty list as this needs user context
            # This should be called with user_id parameter in actual usage
            logger.warning("search_categories called without user_id context")
            return []
        except Exception as e:
            logger.error(f"Error searching VK categories: {e}")
            return []
    
    async def search_categories_for_user(self, query: str, user_id: int) -> List[Dict[str, Any]]:
        """
        Search for VK Live categories for a specific user
        
        Args:
            query: Search query
            user_id: User ID for authentication
            
        Returns:
            List of category dicts with id, name, box_art_url
        """
        try:
            categories = await self.vk_api.search_categories(query, str(user_id))
            return categories if categories else []
        except Exception as e:
            logger.error(f"Error searching VK categories: {e}")
            return []
    
    async def get_stream_status(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Get current VK Live stream status
        
        Args:
            username: VK channel name
            
        Returns:
            Dict with stream info if online, None if offline
        """
        # VK API requires user_id, not username
        # This needs to be adapted for VK's authentication model
        logger.warning("get_stream_status called with username, but VK requires user_id")
        return None
    
    async def get_stream_status_for_user(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get current VK Live stream status for a specific user
        
        Args:
            user_id: User ID
            
        Returns:
            Dict with stream info
        """
        try:
            stream_info = await self.vk_api.get_stream_info(str(user_id))
            return stream_info
        except Exception as e:
            logger.error(f"Error getting VK stream status: {e}")
            return None
    
    async def get_channel_info(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Get VK Live channel information
        
        Args:
            username: VK channel name
            
        Returns:
            Dict with channel info
        """
        # VK API requires user_id, not username
        logger.warning("get_channel_info called with username, but VK requires user_id")
        return None
    
    async def send_chat_message(self, user_id: int, message: str) -> bool:
        """
        Send message to VK Live chat
        
        Args:
            user_id: Unified user ID from database
            message: Message to send
            
        Returns:
            True if successful, False otherwise
        """
        # This would require bot integration
        # For now, return False as it's not implemented in the abstraction
        logger.warning("send_chat_message not yet implemented for VK platform abstraction")
        return False
    
    async def create_reward(self, user_id: int, reward_data: Dict) -> Optional[str]:
        """
        Create VK Live channel points reward
        
        Args:
            user_id: Unified user ID from database
            reward_data: Reward configuration
            
        Returns:
            Reward ID if successful, None otherwise
        """
        try:
            return await self.vk_api.create_reward(str(user_id), reward_data)
        except Exception as e:
            logger.error(f"Error creating VK reward: {e}")
            return None
    
    async def update_reward(self, user_id: int, reward_id: str, reward_data: Dict) -> bool:
        """
        Update VK Live channel points reward
        
        Args:
            user_id: Unified user ID from database
            reward_id: VK reward ID
            reward_data: Updated reward configuration
            
        Returns:
            True if successful, False otherwise
        """
        try:
            return await self.vk_api.update_reward(str(user_id), reward_id, reward_data)
        except Exception as e:
            logger.error(f"Error updating VK reward: {e}")
            return False
    
    async def delete_reward(self, user_id: int, reward_id: str) -> bool:
        """
        Delete VK Live channel points reward
        
        Args:
            user_id: Unified user ID from database
            reward_id: VK reward ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            return await self.vk_api.delete_reward(str(user_id), reward_id)
        except Exception as e:
            logger.error(f"Error deleting VK reward: {e}")
            return False
    
    async def get_user_roles(self, username: str, channel_name: str) -> List[str]:
        """
        Get user roles on a VK Live channel
        
        Args:
            username: User's VK username
            channel_name: Channel name
            
        Returns:
            List of role strings (broadcaster, moderator, vip, viewer)
        """
        # This would use the existing platform_role_checker utility
        try:
            from utils.platform_role_checker import PlatformRoleChecker
            # This requires author_data from chat context
            # For now, return empty list as it needs chat integration
            logger.debug(f"get_user_roles called for {username} on {channel_name}")
            return []
        except Exception as e:
            logger.error(f"Error getting VK user roles: {e}")
            return []
