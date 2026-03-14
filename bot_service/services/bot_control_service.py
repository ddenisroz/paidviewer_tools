# bot_service/services/bot_control_service.py

import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from core.database import User
from core.connection_manager import get_connection_manager, ConnectionManager
from core.token_manager import token_manager
from startup.bot_registry import get_bot_registry, BotRegistry

logger = logging.getLogger(__name__)

class BotControlService:
    """
    Service for managing bot connections (Twitch/VK) and checking status.
    Encapsulates logic previously found in bot_control_api.py.
    """

    def __init__(self):
        # We access singletons here, or we could pass them in __init__
        # For now, following the existing pattern of global getters
        pass

    def _get_connection_manager(self) -> ConnectionManager:
        return get_connection_manager()

    def _get_registry(self) -> BotRegistry:
        return get_bot_registry()

    def get_bot_status(self, user_id: int, user_record: User) -> Dict[str, Any]:
        """
        Get the current connection status of bots for the user.
        """
        # Logic from get_bot_status
        twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
        vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)

        bot_status = {
            "connected": False,
            "channel": None,
            "platform": None,
            "last_activity": None,
            "twitch": {"connected": False, "channel": None},
            "vk": {"connected": False, "channel": None}
        }

        connection_manager = self._get_connection_manager()
        registry = self._get_registry()

        # Check Twitch
        if registry.twitch_bot and twitch_token and user_record.twitch_username:
            channel_name = user_record.twitch_username
            if connection_manager.is_channel_active(channel_name):
                bot_status["twitch"]["connected"] = True
                bot_status["twitch"]["channel"] = channel_name
                bot_status["connected"] = True
                bot_status["channel"] = channel_name
                bot_status["platform"] = "twitch"

        # Check VK
        if registry.vk_bot and vk_token and user_record.vk_channel_name:
            channel_name = user_record.vk_channel_name
            if connection_manager.is_channel_active(channel_name):
                bot_status["vk"]["connected"] = True
                bot_status["vk"]["channel"] = channel_name
                if not bot_status["connected"]: # Prioritize Twitch as main if both connected? Or just set main
                     bot_status["connected"] = True
                     bot_status["channel"] = channel_name
                     bot_status["platform"] = "vk"

        return bot_status

    def connect_chat(self, user_id: int, user_record: User) -> Dict[str, Any]:
        """
        Initiate connection for available platforms.
        """
        twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
        vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)

        if not twitch_token and not vk_token:
            return {"success": False, "error": "No connected platforms. Connect Twitch or VK Live."}

        connection_manager = self._get_connection_manager()
        registry = self._get_registry()
        connected_platforms = []

        if twitch_token and user_record.twitch_username:
            channel_name = user_record.twitch_username
            if registry.twitch_bot and connection_manager.is_channel_active(channel_name):
                 connected_platforms.append("Twitch")

        if vk_token and user_record.vk_channel_name:
             channel_name = user_record.vk_channel_name
             if registry.vk_bot and connection_manager.is_channel_active(channel_name):
                 connected_platforms.append("VK Live")

        if connected_platforms:
             return {
                "success": True,
                "message": f"Bot is connected to: {', '.join(connected_platforms)}"
            }
        else:
            return {
                "success": True,
                "message": "Bots are starting. Connection may take a few seconds."
            }

    def disconnect_chat(self, user_id: int, user_record: User) -> Dict[str, Any]:
        """
        Disconnect bot from user channels.
        """
        # Note: logic requires fetching token from DB? api used get_user_token_from_db
        # But token_manager.get_user_token_data is cached.
        # The original API used `get_user_token_from_db` imported from core.token_utils.
        # I'll use token_manager for consistency if possible, or stick to utils if needed for "freshness"?
        # Actually disconnect probably doesn't need the token value, just existence to know if we SHOULD disconnect.
        # But wait, connection_manager needs channel name. User record has it.
        # Original code checked for token existence before trying to disconnect.

        # Let's use token_manager for existence check.
        twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
        vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)
        
        connection_manager = self._get_connection_manager()
        disconnected = []

        if twitch_token and user_record.twitch_username:
            channel_name = user_record.twitch_username
            if connection_manager.remove_active_session(channel_name, "manual_disconnect"):
                disconnected.append("Twitch")

        if vk_token and user_record.vk_channel_name:
             channel_name = user_record.vk_channel_name
             if connection_manager.remove_active_session(channel_name, "manual_disconnect"):
                 disconnected.append("VK Live")

        if disconnected:
             return {
                "success": True,
                "message": f"Bot disconnected from: {', '.join(disconnected)}"
            }
        else:
             return {
                "success": True,
                "message": "Bot was not connected."
            }
            
    def get_chat_status(self, user_id: int, user_record: User) -> Dict[str, Any]:
         # Logic similar to get_bot_status but returns specific chat structure
         twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
         vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)
         
         chat_status = {
            "connected": False,
            "channel": None,
            "platform": None,
            "last_message": None # Logic for this wasn't implemented in API, just field present
        }
         
         connection_manager = self._get_connection_manager()
         registry = self._get_registry()

         # Check Twitch
         if registry.twitch_bot and twitch_token and user_record.twitch_username:
            channel_name = user_record.twitch_username
            if connection_manager.is_channel_active(channel_name):
                 chat_status["connected"] = True
                 chat_status["channel"] = channel_name
                 chat_status["platform"] = "twitch"
                 return chat_status

         # Check VK
         if registry.vk_bot and vk_token and user_record.vk_channel_name:
             channel_name = user_record.vk_channel_name
             if connection_manager.is_channel_active(channel_name):
                 chat_status["connected"] = True
                 chat_status["channel"] = channel_name
                 chat_status["platform"] = "vk"
                 return chat_status
                 
         return chat_status

    def reconnect_chat(self, user_id: int, user_record: User) -> Dict[str, Any]:
        twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
        vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)

        if not twitch_token and not vk_token:
             return {"success": False, "error": "No connected platforms."}

        connection_manager = self._get_connection_manager()
        reconnected = []

        if twitch_token and user_record.twitch_username:
             channel_name = user_record.twitch_username
             connection_manager.remove_active_session(channel_name, "reconnect")
             reconnected.append("Twitch")

        if vk_token and user_record.vk_channel_name:
             channel_name = user_record.vk_channel_name
             connection_manager.remove_active_session(channel_name, "reconnect")
             reconnected.append("VK Live")

        if reconnected:
             return {
                "success": True,
                "message": f"Reconnect initiated for: {', '.join(reconnected)}"
            }
        else:
             return {"success": False, "error": "Failed to initiate reconnect."}
