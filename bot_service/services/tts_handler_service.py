import logging
import re
import time
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session

# Core & Database
from core.database import SessionLocal, User

# Repositories - Clean Architecture
from repositories.tts_settings_repository import TTSSettingsRepository
from repositories.audio_settings_repository import AudioSettingsRepository
from repositories.local_tts_repository import LocalTTSRepository
from repositories.user_voice_settings_repository import UserVoiceSettingsRepository

# Services
from services.tts.tts_service import TTSService
from services.user_service import UserService
from services.platform_rewards_service import PlatformRewardsService
from services.notification_service import notification_service
from services.memory_websocket_manager import get_memory_websocket_manager
from services.tts.provider_utils import (
    infer_provider_from_engine,
    normalize_provider_mode,
    normalize_qwen_model_selection,
)

# API (for specific legacy checks if needed)
from api.moderation_api import is_user_blocked_from_tts
from utils.blocked_bot_cache import is_bot_blocked_cached
from constants import TTS_DEFAULT_VOLUME

# Analysis logging for LLM feature verification
from core.analysis_logging import (
    log_tts_request, log_error as log_analysis_error,
    get_correlation_id, set_correlation_id, clear_correlation_id
)

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
        self._message_id_dedupe_ttl_sec = 60.0
        self._fallback_dedupe_ttl_sec = 2.0
        self._recent_message_ids: dict[tuple[str, str], float] = {}
        self._recent_fallback_keys: dict[tuple[str, str, str, str], float] = {}

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
        reward_id: str = None,
        message_id: str = None,
    ) -> Dict[str, Any]:
        """
        Process a message for TTS generation.
        Uses repository pattern for all database access.
        """
        try:
            # 1. Initial Checks (Connection, Commands, Blocked)
            initial_check = self._check_initial_conditions(
                text, username, channel_identifier, platform, connection_manager, skip_if_command
            )
            if initial_check:
                return initial_check

            # 2. Database Context
            db = SessionLocal()
            trace_id = set_correlation_id()
            source_message_id = self._normalize_message_id(message_id)
            try:
                if self._is_duplicate_tts_event(
                    platform=platform,
                    channel_identifier=channel_identifier,
                    username=username,
                    text=text,
                    message_id=source_message_id,
                ):
                    logger.info(
                        "[SKIP] [%s TTS] Duplicate event suppressed trace_id=%s source_message_id=%s",
                        platform.upper(),
                        trace_id,
                        source_message_id or "-",
                    )
                    return {"success": False, "error": "Duplicate message suppressed"}

                # 3. Load User and Settings
                user_data = self._load_user_and_settings(db, channel_identifier, platform)
                if not user_data:
                    logger.warning(f"[ERROR] [{platform.upper()} TTS] No user found for channel {channel_identifier}")
                    return {"success": False, "error": "Channel owner not found"}
                
                if user_data.get("error"):
                    return {"success": False, "error": user_data["error"]}

                # 3.1 Sink guard: do not synthesize without an active playback sink.
                sink_result = self._check_active_tts_sink(user_data, connection_manager, platform)
                if sink_result:
                    return sink_result

                # 4. Filter Logic (Bots, Blocked, Shield)
                filter_result = await self._process_filters(
                    db, text, username, platform, is_reply, mentioned_users, reward_id, user_data
                )
                if filter_result.get("error"):
                    return {"success": False, "error": filter_result["error"]}
                
                text_for_tts = filter_result["filtered_text"]

                # 5. Determine TTS Engine & Volume
                engine_config = self._determine_engine_and_volume(
                    db, user_data, connection_manager, channel_identifier, platform
                )

                # 6. Execute TTS Request
                return await self._execute_tts_request(
                    tts_api, 
                    connection_manager, 
                    channel_identifier, 
                    text_for_tts, 
                    username, 
                    user_data, 
                    engine_config,
                    platform,
                    db,
                    reward_id,
                    original_text=text,
                    source_message_id=source_message_id,
                    trace_id=trace_id,
                )

            finally:
                db.close()
                clear_correlation_id()

        except Exception as e:
            logger.exception("[ERROR] [{platform.upper()} TTS] Error processing TTS")
            log_analysis_error(feature='tts_handler', error=e, context=f"process_message_{platform}")
            return {"success": False, "error": "Internal server error"}

    @staticmethod
    def _normalize_message_id(message_id: Optional[str]) -> Optional[str]:
        normalized = str(message_id or "").strip()
        return normalized or None

    def _prune_recent_dedupe_state(self, current_ts: float) -> None:
        self._recent_message_ids = {
            key: value
            for key, value in self._recent_message_ids.items()
            if current_ts - value < self._message_id_dedupe_ttl_sec
        }
        self._recent_fallback_keys = {
            key: value
            for key, value in self._recent_fallback_keys.items()
            if current_ts - value < self._fallback_dedupe_ttl_sec
        }

    def _is_duplicate_tts_event(
        self,
        *,
        platform: str,
        channel_identifier: str,
        username: str,
        text: str,
        message_id: Optional[str],
    ) -> bool:
        current_ts = time.monotonic()
        self._prune_recent_dedupe_state(current_ts)

        normalized_platform = str(platform or "").strip().lower()
        if message_id:
            message_key = (normalized_platform, message_id)
            previous_ts = self._recent_message_ids.get(message_key)
            self._recent_message_ids[message_key] = current_ts
            return previous_ts is not None and (current_ts - previous_ts) < self._message_id_dedupe_ttl_sec

        fallback_key = (
            normalized_platform,
            str(channel_identifier or "").strip().lower(),
            str(username or "").strip().lower(),
            str(text or "").strip().lower(),
        )
        previous_ts = self._recent_fallback_keys.get(fallback_key)
        self._recent_fallback_keys[fallback_key] = current_ts
        return previous_ts is not None and (current_ts - previous_ts) < self._fallback_dedupe_ttl_sec

    def _check_initial_conditions(self, text, username, channel_identifier, platform, connection_manager, skip_if_command):
        # Skip commands
        if skip_if_command and text.strip().startswith('!'):
            logger.info(f"[SKIP] [{platform.upper()} TTS] Skipping command: {text[:50]}")
            return {"success": False, "error": "Message is a command"}

        logger.info(f"[MIC] [{platform.upper()} TTS] Processing message for TTS: '{text[:50]}...'")

        if not connection_manager:
            logger.warning(f"[WARN] [{platform.upper()} TTS] No connection_manager, will check user settings")

        # Check legacy blocked list
        if is_user_blocked_from_tts(channel_identifier, platform, username.lower()):
            logger.warning(f"[BLOCKED] User {username} is blocked from TTS in {platform} channel {channel_identifier}")
            return {"success": False, "error": "User is blocked from TTS"}
        
        return None

    def _load_user_and_settings(self, db, channel_identifier, platform):
        channel_owner = self._find_channel_owner(db, platform, channel_identifier)
        if not channel_owner:
            return None

        if not channel_owner.tts_enabled:
             logger.info(f"[INFO] [{platform.upper()} TTS] TTS is DISABLED GLOBALLY for user {channel_owner.id}")
             return {"error": "TTS is disabled for this user"}

        user_id = channel_owner.id
        tts_settings_repo = TTSSettingsRepository(db)
        audio_settings_repo = AudioSettingsRepository(db)
        
        return {
            "user": channel_owner,
            "user_id": user_id,
            "tts_settings": tts_settings_repo.get_or_create(user_id=user_id),
            "audio_settings": audio_settings_repo.get_or_create(user_id=user_id),
            "audio_settings_dict": audio_settings_repo.get_settings_dict(user_id)
        }

    def _check_active_tts_sink(
        self,
        user_data: Dict[str, Any],
        connection_manager: Any,
        platform: str
    ) -> Optional[Dict[str, Any]]:
        """
        Ensure active sink exists before synthesis:
        - website mode -> requires active `tts_player` websocket
        - obs mode -> requires active OBS socket for user's obs_token
        """
        user = user_data["user"]
        user_id = user_data["user_id"]
        tts_settings = user_data["tts_settings"]
        listening_mode = (
            getattr(tts_settings, "listening_mode", None)
            or getattr(user, "tts_listening_mode", "website")
            or "website"
        )

        if listening_mode == "website":
            has_player = get_memory_websocket_manager().has_user_connection_for_role(user_id, "tts_player")
            if has_player:
                return None

            logger.info(
                "[SKIP] [%s TTS] No active /tts-player sink for user %s in website mode",
                platform.upper(),
                user_id,
            )
            return {"success": False, "error": "No active TTS player sink"}

        if listening_mode == "obs":
            obs_token = getattr(user, "obs_token", None)
            has_obs_sink = bool(
                obs_token
                and connection_manager
                and getattr(connection_manager, "obs_connections", None)
                and obs_token in connection_manager.obs_connections
            )
            if has_obs_sink:
                return None

            logger.info(
                "[SKIP] [%s TTS] No active OBS sink for user %s in obs mode",
                platform.upper(),
                user_id,
            )
            return {"success": False, "error": "No active OBS sink"}

        logger.info(
            "[SKIP] [%s TTS] Unknown listening mode '%s' for user %s",
            platform.upper(),
            listening_mode,
            user_id,
        )
        return {"success": False, "error": "Unsupported listening mode"}

    async def _process_filters(self, db, text, username, platform, is_reply, mentioned_users, reward_id, user_data):
        user_id = user_data["user_id"]
        tts_settings = user_data["tts_settings"]
        
        # Check blocked bots cache
        if is_bot_blocked_cached(username, db):
             logger.debug(f"[BOT] Bot {username} is in blocked list, skipping TTS")
             return {"error": "Bot is blocked from TTS"}

        # Channel Points Mode Validation
        if hasattr(tts_settings, 'tts_mode') and tts_settings.tts_mode == 'channel_points':
            if not self._validate_channel_points_mode(tts_settings, platform, reward_id):
                 return {"error": "Invalid channel points configuration or mismatch"}

        # Blocked Users Service Check
        tts_service = TTSService(db)
        blocked_users = await tts_service.get_blocked_users(user_id)
        if any(u['username'] == username.lower() and u['platform'] == platform for u in blocked_users):
             return {"error": "User is blocked from TTS"}
        
        # Shield Filters
        if tts_settings.filter_replies and is_reply:
            logger.info(f"[SKIP] [{platform.upper()} TTS] Skipping reply message")
            return {"error": "Reply messages are filtered"}

        if tts_settings.filter_mentions and self._has_mentions(text, mentioned_users):
            logger.info(f"[SKIP] [{platform.upper()} TTS] Skipping message with mentions")
            return {"error": "Messages with mentions are filtered"}

        # Apply Word Filters
        filtered_text = await self._apply_word_filters(tts_service, user_id, platform, text)
        return {"filtered_text": filtered_text}

    def _determine_engine_and_volume(self, db, user_data, connection_manager, channel_identifier, platform):
        user_id = user_data["user_id"]
        tts_settings = user_data["tts_settings"]
        audio_settings = user_data["audio_settings"]
        audio_settings_dict = user_data["audio_settings_dict"]

        engine = tts_settings.engine or 'gtts'
        advanced_provider = infer_provider_from_engine(
            engine,
            advanced_provider=getattr(tts_settings, "advanced_provider", None),
        )
        f5_mode = normalize_provider_mode(getattr(tts_settings, "f5_mode", "cloud"))
        qwen_mode = normalize_provider_mode(getattr(tts_settings, "qwen_mode", "cloud"))
        use_ai_tts = (engine in {'f5tts', 'qwen'})
        use_basic_tts = True

        preferred_mode = qwen_mode if advanced_provider == "qwen" else f5_mode

        # Check Local Endpoint
        local_tts_repo = LocalTTSRepository(db)
        local_tts = local_tts_repo.get_healthy(user_id=user_id, provider=advanced_provider)
        has_local_endpoint = bool(use_ai_tts and preferred_mode == "local" and local_tts)

        # Whitelist Check
        if use_ai_tts and not has_local_endpoint:
            from utils.whitelist_cache import is_user_whitelisted_cached
            if not is_user_whitelisted_cached(user_data["user"], db):
                logger.warning(
                    f"[WARN] [{platform.upper()} TTS] User {user_id} not in whitelist for {advanced_provider}, "
                    "falling back to gTTS"
                )
                use_ai_tts = False

        if has_local_endpoint:
            logger.info(
                f"[LOCAL] [{platform.upper()} TTS] Using local {advanced_provider} endpoint for user {user_id}"
            )

        # Volume
        base_volume_level = audio_settings_dict.get('websiteVolume', TTS_DEFAULT_VOLUME)
        if tts_settings.listening_mode == 'obs':
             if audio_settings and hasattr(audio_settings, 'obs_volume'):
                 base_volume_level = audio_settings.obs_volume
        
        final_volume = base_volume_level
        voice_settings_dict = {}

        # Voice Specific Settings
        if use_ai_tts and tts_settings.voice:
             voice_settings_repo = UserVoiceSettingsRepository(db)
             user_voice_config = voice_settings_repo.get_by_voice_name(
                 user_id,
                 tts_settings.voice,
                 tts_provider=advanced_provider,
             )
             
             if user_voice_config:
                 if user_voice_config.cfg_strength is not None:
                     voice_settings_dict["cfg_strength"] = user_voice_config.cfg_strength
                 if user_voice_config.speed_preset is not None:
                     voice_settings_dict["speed_preset"] = user_voice_config.speed_preset
                 if user_voice_config.volume is not None:
                     final_volume = user_voice_config.volume

        return {
            "engine": engine,
            "advanced_provider": advanced_provider,
            "f5_mode": f5_mode,
            "qwen_mode": qwen_mode,
            "use_ai_tts": use_ai_tts,
            "use_basic_tts": use_basic_tts,
            "volume": final_volume,
            "voice_settings": voice_settings_dict
        }

    async def _execute_tts_request(
        self,
        tts_api,
        connection_manager,
        channel_identifier,
        text,
        username,
        user_data,
        engine_config,
        platform,
        db,
        reward_id=None,
        original_text: str = "",
        source_message_id: Optional[str] = None,
        trace_id: Optional[str] = None,
    ):
        user_id = user_data["user_id"]
        tts_settings = user_data["tts_settings"]
        resolved_trace_id = trace_id or get_correlation_id()
        
        tts_settings_dict = {
            "enable7TV": tts_settings.enable_7tv,
            "enableTwitch": tts_settings.enable_twitch,
            "enableProfanity": tts_settings.enable_lexicon_filter,
            "maxLength": tts_settings.max_message_length,
            "skipCommands": tts_settings.skip_commands,
            "voice": tts_settings.voice,
            "advanced_provider": getattr(tts_settings, "advanced_provider", engine_config.get("advanced_provider", "f5")),
            "f5_mode": getattr(tts_settings, "f5_mode", engine_config.get("f5_mode", "cloud")),
            "qwen_mode": getattr(tts_settings, "qwen_mode", engine_config.get("qwen_mode", "cloud")),
            "gcloud_voices": getattr(tts_settings, "gcloud_voices", []) or [],
            "gcloud_mood": getattr(tts_settings, "gcloud_mood", "neutral") or "neutral",
            "qwen_voice": getattr(tts_settings, "qwen_voice", "default") or "default",
            "qwen_model": normalize_qwen_model_selection(getattr(tts_settings, "qwen_model", None)),
            "trace_id": resolved_trace_id,
            "source_message_id": source_message_id,
            "source_platform": platform,
            "source_channel": channel_identifier,
        }
        
        if engine_config["voice_settings"]:
             tts_settings_dict["voice_settings"] = engine_config["voice_settings"]

        logger.info(
            f"[MIC] [{platform.upper()} TTS] Processing: {username}: {text[:50]}... "
            f"(engine={tts_settings.engine}, provider={engine_config.get('advanced_provider')}, "
            f"volume={engine_config['volume']}%)"
        )
        logger.info(
            "[TRACE] [%s TTS] trace_id=%s source_message_id=%s original_text=%r filtered_text=%r",
            platform.upper(),
            resolved_trace_id,
            source_message_id or "-",
            original_text[:200],
            text[:200],
        )

        result = await tts_api.send_tts_request(
            channel_name=channel_identifier,
            text=text,
            author=username,
            user_id=user_id,
            db_session=db,
            volume_level=engine_config["volume"],
            use_ai_tts=engine_config["use_ai_tts"],
            use_basic_tts=engine_config["use_basic_tts"],
            engine=engine_config["engine"],
            connection_manager=connection_manager,
            tts_settings=tts_settings_dict
        )
        result["trace_id"] = resolved_trace_id
        result["source_message_id"] = source_message_id
        result["spoken_text"] = text
        result["original_text"] = original_text

        if result.get("success"):
            # Log successful TTS request for analysis
            log_tts_request(
                text=text,
                voice=result.get("voice", tts_settings.voice or "default"),
                success=True,
                user_id=user_id,
                duration_ms=result.get("processing_time_ms", 0),
                audio_size=result.get("audio_size")
            )
            
            # Auto-accept rewards (if applicable)
            if reward_id and hasattr(tts_settings, 'tts_mode') and tts_settings.tts_mode == 'channel_points':
                await self._auto_accept_reward(db, user_id, platform, reward_id)

            # Broadcast Audio
            await notification_service.broadcast_tts_audio(
                audio_data={
                    "audio_url": result.get("audio_url"),
                    "voice": result.get("voice", "unknown"),
                    "volume": engine_config["volume"],
                    "tts_type": result.get("tts_type", "unknown"),
                    "duration": result.get("duration", 0),
                    "text": text,
                    "spoken_text": result.get("spoken_text") or text,
                    "original_text": original_text,
                    "username": username,
                    "trace_id": resolved_trace_id,
                    "source_message_id": source_message_id,
                    "requested_provider": result.get("requested_provider"),
                    "actual_provider": result.get("actual_provider"),
                    "fallback_used": bool(result.get("fallback_used")),
                    "fallback_reason": result.get("fallback_reason"),
                },
                channel_name=channel_identifier,
                platform=platform
            )
            logger.info(
                "[TRACE] [%s TTS] trace_id=%s source_message_id=%s requested_provider=%s actual_provider=%s fallback=%s voice=%s audio_url=%s",
                platform.upper(),
                resolved_trace_id,
                source_message_id or "-",
                result.get("requested_provider") or engine_config.get("advanced_provider") or engine_config.get("engine"),
                result.get("actual_provider") or result.get("tts_type", "unknown"),
                bool(result.get("fallback_used")),
                result.get("voice", "unknown"),
                result.get("audio_url"),
            )
        else:
            # Log failed TTS request
            log_tts_request(
                text=text,
                voice=tts_settings.voice or "default",
                success=False,
                user_id=user_id,
                error=result.get("error")
            )
            logger.error(
                "[ERROR] [%s TTS] Synthesis FAILED trace_id=%s source_message_id=%s error=%s",
                platform.upper(),
                resolved_trace_id,
                source_message_id or "-",
                result.get("error"),
            )

        return result

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
                  else:
                       logger.debug(f"[DEBUG] [TWITCH TTS] No unfulfilled redemptions found for reward {reward_id}")

        except Exception:
             logger.exception("[WARN] Error auto-accepting reward")

tts_handler_service = TTSHandlerService()

