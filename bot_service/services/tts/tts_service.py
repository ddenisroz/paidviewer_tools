# bot_service/services/tts/tts_service.py
from typing import List, Optional, Dict, Any
import logging
import time

from sqlalchemy.orm import Session

from core.database import User
from core.connection_manager import get_connection_manager
from core.datetime_utils import utcnow_naive

from repositories.tts_settings_repository import TTSSettingsRepository
from repositories.filtered_word_repository import FilteredWordRepository
from repositories.blocked_user_repository import BlockedUserRepository
from repositories.audio_settings_repository import AudioSettingsRepository
from repositories.user_repository import UserRepository
from repositories.user_token_repository import UserTokenRepository

from services.tts.memory_tts_queue import get_memory_tts_queue
from services.advanced_rate_limiter import advanced_rate_limiter
from services.user_identity_service import UserIdentityService
from services.voice_management_service import VoiceManagementService
import random

logger = logging.getLogger(__name__)



class TTSService:
    """
    Unified TTS Service Facade.
    Handles:
    - Settings Management (Delegates to Repositories)
    - Synthesis Requests (Delegates to Queue)
    - Validations (Rate Limits, Filters)
    """

    def __init__(self, db: Session):
        self.db = db
        self.settings_repo = TTSSettingsRepository(db)
        self.filter_repo = FilteredWordRepository(db)
        self.blocked_user_repo = BlockedUserRepository(db)
        self.audio_repo = AudioSettingsRepository(db)
        self.user_repo = UserRepository(db)
        self.token_repo = UserTokenRepository(db)

    # === Synthesis Management ===

    async def synthesize(
        self,
        text: str,
        user: Dict[str, Any],
        voice: str = "female_1",
        channel: str = None,
        platform: str = "twitch",
        priority: int = 1
    ) -> Dict[str, Any]:
        """
        Process a synthesis request.
        1. Validate User
        2. Check Rate Limits
        3. Determine Channel
        4. Add to Queue
        """
        try:
            user_id = user.get('id')
            
            # 1. Validate User
            if not UserIdentityService.validate_user_data(user):
                 raise ValueError("Invalid user data")

            # 2. Determine Channel (if not provided)
            if not channel:
                channel = UserIdentityService.get_tts_channel_name(user)

            # 3. Check Rate Limits
            rate_limit_id = UserIdentityService.get_rate_limit_id(user)
            limit_result = await advanced_rate_limiter.check_tts_rate_limit(
                user_id=rate_limit_id,
                text_length=len(text)
            )

            if not limit_result['allowed']:
                logger.warning(f"Rate limit exceeded for user {rate_limit_id}")
                return {
                    "success": False,
                    "error": "Rate limit exceeded",
                    "retry_after": 10
                }

            # 4. Fetch User Settings (for metadata in queue)
            # We fetch them here to snapshot state at time of request
            tts_settings = self.settings_repo.get_or_create(user_id=user_id)
            audio_settings = self.audio_repo.get_or_create(user_id=user_id)
            
            # Map settings to dicts because Queue stores simple types
            settings_dict = self.settings_repo.get_settings_dict(tts_settings)
            
            # Add to Queue
            # Add to Queue
            task_id = await get_memory_tts_queue().add_task(
                user_id=rate_limit_id, # Using ID for tracking
                text=text,
                voice=voice,
                channel=channel,
                platform=platform,
                priority=priority,
                metadata={
                    "requested_at": time.time(),
                    "volume": audio_settings.website_volume,
                    "author": user.get('username', 'Unknown'),
                    "settings": settings_dict,
                    "use_ai": True # Default to trying AI
                }
            )

            # Record Usage
            await advanced_rate_limiter.add_tts_request(rate_limit_id, len(text))
            
            logger.info(f"TTS task {task_id} queued for user {user_id}")
            
            return {
                "success": True,
                "task_id": task_id,
                "message": "TTS task queued"
            }

        except Exception as e:
            logger.error(f"Error in synthesize: {e}")
            return {"success": False, "error": str(e)}

    # === Settings Management ===

    async def get_audio_settings(self, user_id: int = None, session_id: str = None) -> dict:
        settings = self.audio_repo.get_or_create(user_id)
        return {"websiteVolume": settings.website_volume}

    async def save_audio_settings(self, website_volume: int, user_id: int = None, session_id: str = None) -> bool:
        try:
            settings = self.audio_repo.get_or_create(user_id)
            self.audio_repo.update(settings, {"website_volume": website_volume})
            return True
        except Exception as e:
            logger.error(f"Error saving audio settings: {e}")
            return False

    async def get_tts_settings(self, user_id: int = None, session_id: str = None) -> dict:
        settings = self.settings_repo.get_or_create(user_id)
        return self.settings_repo.get_settings_dict(settings)

    async def save_tts_settings(self, **kwargs) -> dict:
        """Save TTS settings with validation."""
        try:
            user_id = kwargs.get('user_id')
            session_id = kwargs.get('session_id')
            
            settings = self.settings_repo.get_or_create(user_id)
            
            # Version check logic if needed (can be added to repo or here)
            client_version = kwargs.get('client_version')
            if client_version is not None and hasattr(settings, 'version'):
                 if settings.version != client_version:
                     return {"success": False, "error": "Version conflict", "current_version": settings.version}

            # Update
            updated_settings = self.settings_repo.update_settings(settings, kwargs)
            
            # Version is auto-incremented inside update_settings
            return {"success": True, "version": getattr(updated_settings, 'version', 1)}
        
        except Exception as e:
            logger.error(f"Error saving TTS settings: {e}")
            return {"success": False, "error": str(e)}

    # === Filter Management ===

    async def get_filtered_words(self, user_id: int) -> List[dict]:
        return self.filter_repo.get_words_list(user_id=user_id)

    async def add_filtered_word(self, user_id: int, word: str, platform: str = 'all') -> bool:
        new_word = self.filter_repo.add_word(word, platform, user_id=user_id)
        return new_word is not None

    async def remove_filtered_word(self, user_id: int, word_id: int) -> bool:
        return self.filter_repo.remove_word(word_id, user_id=user_id)

    # === Blocked Users ===
    
    async def get_blocked_users(self, user_id: int) -> List[dict]:
        return self.blocked_user_repo.get_blocked_list(user_id=user_id)
        
    async def block_user(self, user_id: int, channel_name: str, platform: str, username: str) -> bool:
        # Validate user existence on platform
        if platform.lower() == 'twitch':
            from startup.bot_registry import get_bot_registry
            registry = get_bot_registry()
            if registry.is_twitch_running() and registry.twitch_bot:
                try:
                    # Use TwitchIO's fetch_users to validate user existence
                    users = await registry.twitch_bot.fetch_users(names=[username])
                    if not users:
                        logger.warning(f"Cannot block user {username}: user not found on Twitch")
                        return False
                except Exception as e:
                    logger.error(f"Error validating user {username} on Twitch: {e}")
                    # If validation fails due to error, we might want to fail safe or allow. 
                    # For now, let's fail safe (don't block if we can't verify)
                    return False

        return self.blocked_user_repo.block_user(
            channel_name=channel_name, 
            platform=platform, 
            username=username, 
            user_id=user_id
        ) is not None
        
    async def unblock_user(self, user_id: int, channel_name: str, platform: str, username: str) -> bool:
        return self.blocked_user_repo.unblock_user(
            channel_name=channel_name, 
            platform=platform, 
            username=username, 
            user_id=user_id
        )

    # === TTS Status ===

    async def get_tts_status(self, user_id: int) -> dict:
        """Get TTS enabled status and listening mode for a user."""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return {"enabled": False, "listening_mode": "website", "error": "User not found"}
        enabled = getattr(user, 'tts_enabled', False)

        if enabled:
            connection_manager = get_connection_manager()
            if user.twitch_username:
                channel_name = user.twitch_username.lower()
                if channel_name not in connection_manager.tts_enabled_channels:
                    connection_manager.enable_tts_for_channel(channel_name)

            tokens = self.token_repo.get_all_by_user(user_id)
            for token in tokens:
                if token.platform == 'vk' and token.platform_user_id:
                    vk_channel = str(token.platform_user_id)
                    if vk_channel not in connection_manager.tts_enabled_channels:
                        connection_manager.enable_tts_for_channel(vk_channel)

        return {
            "enabled": enabled,
            "listening_mode": getattr(user, 'tts_listening_mode', 'website')
        }

    # === Platform Settings ===

    async def set_platform_settings(self, user_id: int, enabled_platforms: list) -> bool:
        """Set enabled platforms for TTS."""
        try:
            settings = self.settings_repo.get_or_create(user_id=user_id)
            # Repository handles commit
            self.settings_repo.update_settings(settings, {"enabled_platforms": enabled_platforms})
            return True
        except Exception as e:
            logger.error(f"Error setting platform settings: {e}")
            return False

    # === Status Management (Enable/Disable) ===

    async def enable_tts(self, user_id: int = None, session_id: str = None) -> bool:
        """Enable TTS and register in ConnectionManager."""
        try:
            if session_id: return True # Guests always enabled
            
            if not user_id: return False
            
            user = self.user_repo.get_by_id(user_id)
            if not user: return False
            
            # Use repository for update
            self.user_repo.update(user, {'tts_enabled': True})
            
            # Connection Manager Update
            connection_manager = get_connection_manager()
            if user.twitch_username:
                connection_manager.enable_tts_for_channel(user.twitch_username.lower())
            
            # VK Support
            tokens = self.token_repo.get_all_by_user(user_id)
            for t in tokens:
                if t.platform == 'vk' and t.platform_user_id:
                     connection_manager.enable_tts_for_channel(t.platform_user_id)
            
            return True
        except Exception as e:
            logger.error(f"Error enabling TTS: {e}")
            return False

    async def disable_tts(self, user_id: int = None, session_id: str = None) -> bool:
        """Disable TTS and unregister from ConnectionManager."""
        try:
            if session_id: return True
            
            if not user_id: return False
            
            user = self.user_repo.get_by_id(user_id)
            if not user: return False
            
            # Use repository for update
            self.user_repo.update(user, {'tts_enabled': False})
            
            connection_manager = get_connection_manager()
            if user.twitch_username:
                connection_manager.disable_tts_for_channel(user.twitch_username.lower())
                
            tokens = self.token_repo.get_all_by_user(user_id)
            for t in tokens:
                if t.platform == 'vk' and t.platform_user_id:
                     connection_manager.disable_tts_for_channel(t.platform_user_id)

            return True
        except Exception as e:
             logger.error(f"Error disabling TTS: {e}")
             return False



    async def set_voice(self, user_id: int, voice_name: str, db: Session = None) -> bool:
        """Set TTS voice for user."""
        try:
            # Init VoiceManagementService
            voice_service = VoiceManagementService(self.db)
            
            # Fetch available voices
            global_voices = await voice_service.get_global_voices()
            user_voices = await voice_service.get_user_custom_voices(user_id)
            
            all_voices = [v.get('name', '').lower() for v in global_voices + user_voices]
            
            if voice_name.lower() not in all_voices:
                return False
                
            # Update settings - repository handles commit
            settings = self.settings_repo.get_or_create(user_id=user_id)
            self.settings_repo.update_settings(settings, {'voice': voice_name})
            return True
            
        except Exception as e:
            logger.error(f"Error setting voice: {e}")
            return False

    async def set_random_voice(self, user_id: int, db: Session = None) -> Optional[str]:
        """Set random TTS voice for user."""
        try:
            voice_service = VoiceManagementService(self.db)
            
            global_voices = await voice_service.get_global_voices()
            user_voices = await voice_service.get_user_custom_voices(user_id)
            
            available_voices = [v.get('name') for v in global_voices + user_voices if v.get('name')]
            
            if not available_voices:
                return None
                
            voice_name = random.choice(available_voices)
            
            settings = self.settings_repo.get_or_create(user_id=user_id)
            self.settings_repo.update_settings(settings, {'voice': voice_name})
            # Repository handles commit
            
            return voice_name
            
        except Exception as e:
            logger.error(f"Error setting random voice: {e}")
            return None

    async def set_volume(self, user_id: int, volume: int, db: Session = None) -> bool:
        """Set TTS website volume."""
        try:
            return await self.save_audio_settings(website_volume=volume, user_id=user_id)
        except Exception as e:
            logger.error(f"Error setting volume: {e}")
            return False
