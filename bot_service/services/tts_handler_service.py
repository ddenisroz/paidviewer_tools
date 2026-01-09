import logging
import re
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

# Core & Database
from core.database import SessionLocal, User, UserToken

# Repositories - Clean Architecture
from repositories.tts_settings_repository import TTSSettingsRepository
from repositories.audio_settings_repository import AudioSettingsRepository
from repositories.local_tts_repository import LocalTTSRepository
from repositories.user_voice_settings_repository import UserVoiceSettingsRepository

# Services
from services.tts_service import TTSService
from services.user_service import UserService
from services.platform_rewards_service import PlatformRewardsService
from services.notification_service import notification_service

# API (for specific legacy checks if needed)
from api.moderation_api import is_user_blocked_from_tts
from utils.blocked_bot_cache import is_bot_blocked_cached
from constants import TTS_DEFAULT_VOLUME

logger = logging.getLogger('bot_service.tts')

class TTSHandlerService:
    """
    Service for handling TTS logic including permissions, settings, and request queuing.
    Refactored to use Clean Architecture with Repository Pattern.
    
    Repositories used:
    - TTSSettingsRepository: TTS user settings
    - AudioSettingsRepository: Volume settings
    - LocalTTSRepository: Local TTS endpoint settings
    - UserVoiceSettingsRepository: Voice-specific settings
    """
    def __init__(self):
        self.user_service = UserService()
        self.rewards_service = PlatformRewardsService()

    async def process_message_for_tts(
        self,
        text: str,
        username: str,
        channel_identifier: str,
        platform: str,
        tts_api,
        connection_manager,
        skip_if_command: bool = True,
        is_reply: bool = False,
        mentioned_users: list = None,
        reward_id: str = None
    ) -> Dict[str, Any]:
        """
        Process a message for TTS generation.
        Uses repository pattern for all database access.
        """
        try:
            # Skip commands if enabled (Check before DB to save resources)
            if skip_if_command and text.strip().startswith('!'):
                logger.info(f"[SKIP] [{platform.upper()} TTS] Skipping command: {text[:50]}")
                return {"success": False, "error": "Message is a command"}

            logger.info(f"[MIC] [{platform.upper()} TTS] Processing message for TTS: '{text[:50]}...'")

            # Determine if AI TTS is requested via connection manager
            use_ai_tts_requested = False
            if connection_manager:
                use_ai_tts_requested = connection_manager.is_tts_enabled(channel_identifier)
            else:
                logger.warning(f"[WARN] [{platform.upper()} TTS] No connection_manager, will check user settings")

            # Check if user is blocked from TTS (Legacy API check - pending refactor of ModerationAPI)
            if is_user_blocked_from_tts(channel_identifier, platform, username.lower()):
                logger.warning(f"[BLOCKED] User {username} is blocked from TTS in {platform} channel {channel_identifier}")
                return {"success": False, "error": "User is blocked from TTS"}

            # Database operations
            db = SessionLocal()
            try:
                # Initialize Repositories
                tts_settings_repo = TTSSettingsRepository(db)
                audio_settings_repo = AudioSettingsRepository(db)
                local_tts_repo = LocalTTSRepository(db)
                voice_settings_repo = UserVoiceSettingsRepository(db)
                
                # Initialize Services with current session
                tts_service = TTSService(db)

                # Check blocked bots cache
                if is_bot_blocked_cached(username, db):
                    logger.debug(f"[BOT] Bot {username} is in blocked list, skipping TTS")
                    return {"success": False, "error": "Bot is blocked from TTS"}

                # Find channel owner
                channel_owner = self._find_channel_owner(db, platform, channel_identifier)
                
                if not channel_owner:
                    logger.warning(f"[ERROR] [{platform.upper()} TTS] No user found for channel {channel_identifier}")
                    return {"success": False, "error": "Channel owner not found"}

                user_id = channel_owner.id

                # Check if TTS is globally enabled for the user
                if not channel_owner.tts_enabled:
                    logger.info(f"[INFO] [{platform.upper()} TTS] TTS is DISABLED GLOBALLY for user {user_id}")
                    return {"success": False, "error": "TTS is disabled for this user"}

                # Load settings via Repositories (Clean Architecture)
                tts_user_settings = tts_settings_repo.get_or_create(user_id=user_id)
                audio_settings = audio_settings_repo.get_or_create(user_id=user_id)
                
                # Load audio settings dict for volume
                audio_settings_dict = audio_settings_repo.get_settings_dict(user_id)

                # Check TTS Mode (Channel Points vs All Messages)
                if hasattr(tts_user_settings, 'tts_mode') and tts_user_settings.tts_mode == 'channel_points':
                    if not self._validate_channel_points_mode(tts_user_settings, platform, reward_id):
                         return {"success": False, "error": "Invalid channel points configuration or mismatch"}

                # Determine TTS Engine
                use_ai_tts = (tts_user_settings.engine == 'f5tts')
                use_basic_tts = True 

                if use_ai_tts and not use_ai_tts_requested:
                    logger.info(f"[MIC] [{platform.upper()} TTS] AI TTS disabled via connection_manager for channel")
                    use_ai_tts = False
                    use_basic_tts = True

                if not use_ai_tts and not use_basic_tts:
                     use_basic_tts = True

                # Check Local Endpoint via Repository
                local_tts = local_tts_repo.get_by_user_id(user_id)
                has_local_endpoint = use_ai_tts and local_tts and local_tts.use_local

                # Whitelist Check for Cloud AI TTS
                if use_ai_tts and not has_local_endpoint:
                    from utils.whitelist_cache import is_user_whitelisted_cached
                    if not is_user_whitelisted_cached(channel_owner, db):
                        logger.warning(f"[WARN] [{platform.upper()} TTS] User {user_id} not in whitelist, falling back to gTTS")
                        use_ai_tts = False
                        use_basic_tts = True

                if has_local_endpoint:
                    logger.info(f"[LOCAL] [{platform.upper()} TTS] Using local TTS endpoint for user {user_id}: {local_tts.endpoint_url}")

                # Apply Word Filters using Service
                filtered_text = await self._apply_word_filters(tts_service, user_id, platform, text)

                # Check Blocked User using Service
                blocked_users = await tts_service.get_blocked_users(user_id)
                if any(u['username'] == username.lower() and u['platform'] == platform for u in blocked_users):
                     return {"success": False, "error": "User is blocked from TTS"}

                # Shield Filters (Replies/Mentions)
                if tts_user_settings.filter_replies and is_reply:
                    logger.info(f"[SKIP] [{platform.upper()} TTS] Skipping reply message")
                    return {"success": False, "error": "Reply messages are filtered"}

                if tts_user_settings.filter_mentions and self._has_mentions(text, mentioned_users):
                    logger.info(f"[SKIP] [{platform.upper()} TTS] Skipping message with mentions")
                    return {"success": False, "error": "Messages with mentions are filtered"}

                text_for_tts = filtered_text

                # Prepare TTS Settings
                tts_settings_dict = {
                    "enable7TV": tts_user_settings.enable_7tv,
                    "enableTwitch": tts_user_settings.enable_twitch,
                    "enableProfanity": tts_user_settings.enable_lexicon_filter,
                    "maxLength": tts_user_settings.max_message_length,
                    "skipCommands": tts_user_settings.skip_commands,
                    "voice": tts_user_settings.voice
                }

                # Volume Logic via Repository
                base_volume_level = audio_settings_dict.get('websiteVolume', TTS_DEFAULT_VOLUME)
                if tts_user_settings.listening_mode == 'obs':
                    # Use repository-fetched audio_settings object
                    if audio_settings and hasattr(audio_settings, 'obs_volume'):
                        base_volume_level = audio_settings.obs_volume

                final_volume_level = base_volume_level
                
                # Voice Settings Logic via Repository
                if use_ai_tts and tts_user_settings.voice:
                    user_voice_config = voice_settings_repo.get_by_voice_name(
                        user_id, tts_user_settings.voice
                    )

                    if user_voice_config:
                        voice_settings_dict = {}
                        if user_voice_config.cfg_strength is not None:
                            voice_settings_dict["cfg_strength"] = user_voice_config.cfg_strength
                        if user_voice_config.speed_preset is not None:
                            voice_settings_dict["speed_preset"] = user_voice_config.speed_preset
                        
                        if voice_settings_dict:
                            tts_settings_dict["voice_settings"] = voice_settings_dict
                        
                        if user_voice_config.volume is not None:
                            final_volume_level = user_voice_config.volume

                logger.info(f"[MIC] [{platform.upper()} TTS] Processing: {username}: {text[:50]}... (engine={tts_user_settings.engine}, volume={final_volume_level}%)")

                # Send request to TTS API
                result = await tts_api.send_tts_request(
                    channel_name=channel_identifier,
                    text=text_for_tts,
                    author=username,
                    user_id=user_id,
                    volume_level=final_volume_level,
                    use_ai_tts=use_ai_tts,
                    use_basic_tts=use_basic_tts,
                    connection_manager=connection_manager,
                    tts_settings=tts_settings_dict
                )

                if result.get("success"):
                    # Auto-accept rewards
                    if reward_id and hasattr(tts_user_settings, 'tts_mode') and tts_user_settings.tts_mode == 'channel_points':
                        await self._auto_accept_reward(db, user_id, platform, reward_id)

                    # Broadcast Audio
                    await notification_service.broadcast_tts_audio(
                        audio_data={
                            "audio_url": result.get("audio_url"),
                            "voice": result.get("voice", "unknown"),
                            "volume": final_volume_level,
                            "tts_type": result.get("tts_type", "unknown"),
                            "duration": result.get("duration", 0),
                            "text": text,
                            "username": username
                        },
                        channel_name=channel_identifier,
                        platform=platform
                    )
                else:
                    logger.error(f"[ERROR] [{platform.upper()} TTS] Synthesis FAILED: {result.get('error')}")

                return result

            finally:
                db.close()

        except Exception as e:
            logger.error(f"[ERROR] [{platform.upper()} TTS] Error processing TTS: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def _find_channel_owner(self, db: Session, platform: str, channel_identifier: str) -> Optional[User]:
        from repositories.user_repository import UserRepository
        repo = UserRepository(db)
        
        if platform == 'twitch':
            return repo.get_by_twitch_username(channel_identifier)
        elif platform == 'vk':
            owner = repo.get_by_vk_channel_name(channel_identifier)
            if not owner:
                # Fallback to checking via UserToken platform_user_id
                user_token = repo.get_token_by_platform('vk', channel_identifier)
                if user_token:
                    return user_token.user
            return owner
        return None

    def _validate_channel_points_mode(self, tts_user_settings, platform, reward_id) -> bool:
        logger.info(f"[REWARD] [{platform.upper()} TTS] Channel Points mode enabled")
        tts_reward_ids = tts_user_settings.tts_reward_ids or {}
        if platform not in tts_reward_ids:
            logger.warning(f"[ERROR] [{platform.upper()} TTS] No TTS reward configured")
            return False
        
        expected_reward_id = tts_reward_ids[platform]
        if not reward_id:
             logger.warning(f"[ERROR] [{platform.upper()} TTS] Message not from reward redemption")
             return False
        
        if str(reward_id) != str(expected_reward_id):
             logger.warning(f"[ERROR] [{platform.upper()} TTS] Wrong reward ID: {reward_id} != {expected_reward_id}")
             return False
        
        return True

    async def _apply_word_filters(self, tts_service, user_id, platform, text) -> str:
        words = await tts_service.get_filtered_words(user_id)
        # Filter by platform
        filtered_words = [w['word'] for w in words if w['platform'] in ('all', platform)]
        
        if not filtered_words:
            return text
        
        filtered_text = text
        words_pattern = '|'.join(re.escape(word.lower()) for word in filtered_words)
        if words_pattern:
             filtered_text = re.sub(
                words_pattern,
                lambda m: '*' * len(m.group(0)),
                filtered_text,
                flags=re.IGNORECASE
            )
        return filtered_text

    def _has_mentions(self, text, mentioned_users) -> bool:
        if mentioned_users and len(mentioned_users) > 0:
            return True
        return bool(re.search(r'@\w+', text))

    async def _auto_accept_reward(self, db, user_id, platform, reward_id):
        try:
             # Use PlatformRewardsService
             # VK Logic
             if platform == 'vk':
                  # Get demands from PlatformRewardsService
                  demands = await self.rewards_service.get_demands(user_id, 'vk', db)
                  
                  # Logic from legacy:
                  tts_demands = [d for d in demands if str(d.get("reward_id") or d.get("reward", {}).get("id")) == str(reward_id)]
                  demand_ids = [int(d.get("id") or d.get("demand_id")) for d in tts_demands if d.get("id") or d.get("demand_id")]
                  
                  if demand_ids:
                       await self.rewards_service.process_demands(user_id, 'vk', demand_ids, 'accept', db)
                       logger.info(f"[OK] [VK TTS] Auto-accepted {len(demand_ids)} demands")

             elif platform == 'twitch':
                  # Twitch logic - using PlatformRewardsService
                  redemptions = await self.rewards_service.get_redemptions(user_id, 'twitch', reward_id, 'UNFULFILLED', db)
                  
                  count = 0
                  for redemption in redemptions:
                       r_id = redemption.get("id")
                       if r_id:
                            await self.rewards_service.update_redemption_status(user_id, 'twitch', reward_id, r_id, 'FULFILLED', db)
                            count += 1
                  
                  if count > 0:
                       logger.info(f"[OK] [TWITCH TTS] Auto-fulfilled {count} redemptions")

        except Exception as e:
             logger.warning(f"[WARN] Error auto-accepting reward: {e}")

tts_handler_service = TTSHandlerService()
