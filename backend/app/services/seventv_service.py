import httpx
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

class SevenTVService:
    def __init__(self):
        self.base_url = "https://7tv.io/v3"
        self.emote_sets = {}  # Cache for emote sets

    async def get_user_id_from_login(self, login_name: str) -> Optional[str]:
        """Gets a Twitch user's ID from their login name."""
        # This would typically be a call to the Twitch API
        # For now, we'll assume a direct mapping or another service handles this.
        # This is a placeholder for real implementation.
        logger.warning("Twitch user ID lookup is not fully implemented.")
        return None # Needs implementation

    async def get_channel_emotes(self, twitch_user_id: str) -> List[str]:
        """Gets a list of 7TV emote codes for a given Twitch user ID."""
        if twitch_user_id in self.emote_sets:
            return self.emote_sets[twitch_user_id]

        url = f"{self.base_url}/users/twitch/{twitch_user_id}"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                
                emote_set = data.get("emote_set", {})
                emotes = [emote["name"] for emote in emote_set.get("emotes", [])]
                
                self.emote_sets[twitch_user_id] = emotes
                return emotes
        except httpx.HTTPStatusError as e:
            logger.error(f"Error fetching 7TV emotes for {twitch_user_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"An unexpected error occurred in get_channel_emotes: {e}")
            return []

seventv_service = SevenTVService()
