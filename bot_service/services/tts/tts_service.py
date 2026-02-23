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
from repositories.local_tts_repository import LocalTTSRepository

from services.tts.memory_tts_queue import get_memory_tts_queue
from services.advanced_rate_limiter import advanced_rate_limiter
from services.user_identity_service import UserIdentityService
from services.voice_management_service import VoiceManagementService
import random
from services.tts.provider_utils import (
    infer_provider_from_engine,
    normalize_provider_mode,
)

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
            logger.exception("Error in synthesize")
            return {"success": False, "error": "Internal server error"}

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
            logger.exception("Error saving audio settings")
            return False

    async def get_tts_settings(self, user_id: int = None, session_id: str = None) -> dict:
        settings = self.settings_repo.get_or_create(user_id)
        return self.settings_repo.get_settings_dict(settings)

    async def save_tts_settings(self, **kwargs) -> dict:
        """Save TTS settings with validation."""
        try:
            user_id = kwargs.get('user_id')
            session_id = kwargs.get('session_id')
            
            settings = self.settings_repo.get_or_create(user_id=user_id, session_id=session_id)
            
            # Version check logic if needed (can be added to repo or here)
            client_version = kwargs.get('client_version')
            if client_version is not None and hasattr(settings, 'version'):
                 if settings.version != client_version:
                     return {"success": False, "error": "Version conflict", "current_version": settings.version}

            payload = dict(kwargs)
            payload.pop("user_id", None)
            payload.pop("session_id", None)
            payload.pop("client_version", None)

            # Update
            updated_settings = self.settings_repo.update_settings(settings, payload)

            listening_mode = payload.get("listening_mode")
            if user_id and listening_mode in {"website", "obs"}:
                user = self.user_repo.get_by_id(user_id)
                if user:
                    self.user_repo.update(user, {"tts_listening_mode": listening_mode})

            if user_id:
                from services.memory_websocket_manager import get_memory_websocket_manager
                await get_memory_websocket_manager().sync_user_tts_generation(user_id)
            
            # Version is auto-incremented inside update_settings
            return {"success": True, "version": getattr(updated_settings, 'version', 1)}
        
        except Exception as e:
            logger.exception("Error saving TTS settings")
            return {"success": False, "error": "Internal server error"}

    # === Filter Management ===

    async def get_filtered_words(self, user_id: int) -> List[dict]:
        return self.filter_repo.get_words_list(user_id=user_id)

    async def add_filtered_word(self, user_id: int, word: str, platform: str = 'all') -> bool:
        new_word = self.filter_repo.add_word(word, platform, user_id=user_id)
        return new_word is not None

    async def remove_filtered_word(self, user_id: int, word_id: int) -> bool:
        return self.filter_repo.remove_word(word_id, user_id=user_id)

    # === Blocked Users ===
    
    async def get_blocked_users(self, user_id: Optional[int] = None, session_id: Optional[str] = None) -> List[dict]:
        return self.blocked_user_repo.get_blocked_list(user_id=user_id, session_id=session_id)
        
    async def block_user(
        self,
        user_id: Optional[int],
        channel_name: str,
        platform: str,
        username: str,
        session_id: Optional[str] = None,
    ) -> bool:
        # Validate user existence on platform (best-effort only).
        # Blocking must still work even if upstream OAuth/token validation is temporarily broken.
        if platform.lower() == 'twitch':
            from startup.bot_registry import get_bot_registry
            registry = get_bot_registry()
            if registry.is_twitch_running() and registry.twitch_bot:
                try:
                    # Use TwitchIO's fetch_users to validate user existence
                    users = await registry.twitch_bot.fetch_users(names=[username])
                    if not users:
                        logger.warning(
                            f"User {username} was not resolved via Twitch API, proceeding with local username block"
                        )
                except Exception as e:
                    logger.warning(
                        f"Failed to validate user {username} on Twitch API, proceeding with local username block: {e}"
                    )

        return self.blocked_user_repo.block_user(
            channel_name=channel_name, 
            platform=platform, 
            username=username, 
            user_id=user_id,
            session_id=session_id,
        ) is not None
        
    async def unblock_user(
        self,
        user_id: Optional[int],
        channel_name: str,
        platform: str,
        username: str,
        session_id: Optional[str] = None,
    ) -> bool:
        return self.blocked_user_repo.unblock_user(
            channel_name=channel_name, 
            platform=platform, 
            username=username, 
            user_id=user_id,
            session_id=session_id,
        )

    # === TTS Status ===

    async def get_tts_status(self, user_id: int) -> dict:
        """Get TTS enabled status and listening mode for a user."""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return {"enabled": False, "listening_mode": "website", "error": "User not found"}
        enabled = getattr(user, 'tts_enabled', False)

        settings = self.settings_repo.get_or_create(user_id=user_id)
        engine = getattr(settings, 'engine', 'gtts')
        provider = infer_provider_from_engine(
            engine,
            advanced_provider=getattr(settings, "advanced_provider", None),
        )
        use_local_tts = bool(getattr(settings, "use_local_tts", False))
        f5_mode = normalize_provider_mode(getattr(settings, "f5_mode", "cloud"))
        qwen_mode = normalize_provider_mode(getattr(settings, "qwen_mode", "cloud"))

        if engine == 'f5tts':
            resolved_mode = 'local' if use_local_tts else f5_mode
            engine_type = f'f5_{resolved_mode}'
        elif engine == 'qwen':
            resolved_mode = 'local' if use_local_tts else qwen_mode
            engine_type = f'qwen_{resolved_mode}'
        elif engine == 'gcloud':
            engine_type = 'gcloud'
        else:
            engine_type = 'gtts'

        listening_mode = getattr(settings, 'listening_mode', None) or getattr(user, 'tts_listening_mode', 'website')

        has_local_setup = False
        has_local_setup_f5 = False
        has_local_setup_qwen = False
        is_whitelisted = False

        try:
            local_repo = LocalTTSRepository(self.db)
            local_f5 = local_repo.get_active(user_id=user_id, provider="f5")
            has_local_setup_f5 = bool(local_f5 and local_f5.is_healthy)
            local_qwen = local_repo.get_active(user_id=user_id, provider="qwen")
            has_local_setup_qwen = bool(local_qwen and local_qwen.is_healthy)
            has_local_setup = has_local_setup_qwen if provider == "qwen" else has_local_setup_f5
        except Exception as e:
            logger.exception("Failed to resolve local TTS status for user %s", user_id)

        try:
            from utils.whitelist_cache import is_user_whitelisted_cached
            is_whitelisted = bool(is_user_whitelisted_cached(user, self.db))
        except Exception as e:
            logger.exception("Failed to resolve whitelist status for user %s", user_id)

        return {
            "enabled": enabled,
            "listening_mode": listening_mode,
            "listeningMode": listening_mode,
            "engine_type": engine_type,
            "advanced_provider": provider,
            "f5_mode": f5_mode,
            "qwen_mode": qwen_mode,
            "has_local_setup": has_local_setup,
            "has_local_setup_f5": has_local_setup_f5,
            "has_local_setup_qwen": has_local_setup_qwen,
            "is_whitelisted": is_whitelisted,
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
            logger.exception("Error setting platform settings")
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

            from services.memory_websocket_manager import get_memory_websocket_manager
            await get_memory_websocket_manager().sync_user_tts_generation(user_id)
            
            return True
        except Exception as e:
            logger.exception("Error enabling TTS")
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

            from services.memory_websocket_manager import get_memory_websocket_manager
            await get_memory_websocket_manager().sync_user_tts_generation(user_id)

            return True
        except Exception as e:
             logger.exception("Error disabling TTS")
             return False



    async def set_voice(self, user_id: int, voice_name: str, db: Session = None) -> bool:
        """Set TTS voice for user."""
        try:
            settings = self.settings_repo.get_or_create(user_id=user_id)
            provider = infer_provider_from_engine(
                getattr(settings, "engine", None),
                advanced_provider=getattr(settings, "advanced_provider", None),
            )
            target_voice = (voice_name or "").strip().lower()
            if not target_voice:
                return False

            available_voices: List[str] = []
            if provider == "gcloud":
                available_voices = [
                    str(voice).strip()
                    for voice in (getattr(settings, "gcloud_voices", None) or [])
                    if isinstance(voice, str) and str(voice).strip()
                ]
            else:
                voice_service = VoiceManagementService(self.db)
                global_voices = await voice_service.get_global_voices(provider=provider)
                user_voices = await voice_service.get_user_custom_voices(user_id, provider=provider)
                available_voices = [
                    str(v.get("name", "")).strip()
                    for v in (global_voices + user_voices)
                    if isinstance(v, dict) and v.get("name")
                ]

            resolved_voice = None
            for candidate in available_voices:
                if candidate.lower() == target_voice:
                    resolved_voice = candidate
                    break

            if not resolved_voice:
                return False

            self.settings_repo.update_settings(settings, {"voice": resolved_voice})
            return True
            
        except Exception as e:
            logger.exception("Error setting voice")
            return False

    async def set_random_voice(self, user_id: int, db: Session = None) -> Optional[str]:
        """Set random TTS voice for user."""
        try:
            settings = self.settings_repo.get_or_create(user_id=user_id)
            provider = infer_provider_from_engine(
                getattr(settings, "engine", None),
                advanced_provider=getattr(settings, "advanced_provider", None),
            )

            available_voices: List[str] = []
            if provider == "gcloud":
                available_voices = [
                    str(voice).strip()
                    for voice in (getattr(settings, "gcloud_voices", None) or [])
                    if isinstance(voice, str) and str(voice).strip()
                ]
            else:
                voice_service = VoiceManagementService(self.db)
                global_voices = await voice_service.get_global_voices(provider=provider)
                user_voices = await voice_service.get_user_custom_voices(user_id, provider=provider)
                available_voices = [
                    str(v.get("name", "")).strip()
                    for v in (global_voices + user_voices)
                    if isinstance(v, dict) and v.get("name")
                ]

            if not available_voices:
                return None
                
            voice_name = random.choice(available_voices)
            
            self.settings_repo.update_settings(settings, {'voice': voice_name})
            # Repository handles commit
            
            return voice_name
            
        except Exception as e:
            logger.exception("Error setting random voice")
            return None

    async def set_volume(self, user_id: int, volume: int, db: Session = None) -> bool:
        """Set TTS website volume."""
        try:
            return await self.save_audio_settings(website_volume=volume, user_id=user_id)
        except Exception as e:
            logger.exception("Error setting volume")
            return False

