# bot_service/api/tts/settings_routes.py
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import logging
import httpx
from pathlib import Path
from typing import List, Optional

from core.database import get_db
from auth.auth import get_current_user
from core.config import settings
from constants import DEFAULT_ENABLED_PLATFORMS
from services.tts.tts_service import TTSService
from services.tts.google_cloud_tts import (
    get_google_cloud_tts,
    is_gemini_or_chirp_voice,
    normalize_gcloud_mood,
)
from services.tts.tts_core import (
    AudioSettingsRequest,
    TtsSettingsRequest,
    BlockUserRequest, 
    UnblockUserRequest,
    AddWordRequest,
    PlatformSettingsRequest
)

# Prefix is defined in main.py via include_router or here. 
# We decided to use api/tts/__init__.py to include this router.
# Let's define the prefix here to be safe and consistent with synthesis_routes
router = APIRouter(prefix="/api/tts", tags=["tts-settings"])
logger = logging.getLogger(__name__)


class EngineRequest(BaseModel):
    engine_type: str = Field(..., min_length=2, max_length=20)


class GcloudVoiceSelectionRequest(BaseModel):
    voices: List[str] = Field(default_factory=list)


class GcloudVoicePreviewRequest(BaseModel):
    voice_name: str = Field(..., min_length=2, max_length=120)
    text: Optional[str] = Field(default="Hello! This is a Google Cloud voice preview.")
    mood: Optional[str] = Field(default=None, max_length=20)
    model_name: Optional[str] = Field(default=None, max_length=120)

def get_tts_service(db: Session = Depends(get_db)) -> TTSService:
    return TTSService(db)

# ============================================================================
# TTS SETTINGS
# ============================================================================

@router.get("/settings")
async def get_tts_settings(
    user: dict = Depends(get_current_user), 
    service: TTSService = Depends(get_tts_service)
):
    """Get TTS settings for current user."""
    return await service.get_tts_settings(user_id=user['id'])

@router.post("/settings")
async def update_tts_settings(
    settings_req: TtsSettingsRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Update TTS settings."""
    save_payload = {"user_id": user["id"]}
    field_map = {
        "enable7TV": "enable_7tv",
        "enableTwitch": "enable_twitch",
        "enableLexiconFilter": "enable_lexicon_filter",
        "enableCustomLexicon": "enable_custom_lexicon",
        "engine": "engine",
        "voice": "voice",
        "listeningMode": "listening_mode",
        "maxMessageLength": "max_message_length",
        "skipCommands": "skip_commands",
        "useLocalTTS": "use_local_tts",
        "filterReplies": "filter_replies",
        "filterMentions": "filter_mentions",
        "gcloudVoices": "gcloud_voices",
        "gcloudMood": "gcloud_mood",
    }

    model_fields_set = getattr(settings_req, "model_fields_set", set())
    for request_field, payload_field in field_map.items():
        if request_field not in model_fields_set:
            continue
        value = getattr(settings_req, request_field, None)
        if value is None and request_field in {"gcloudVoices", "gcloudMood"}:
            continue
        save_payload[payload_field] = value

    if "version" in model_fields_set:
        save_payload["client_version"] = settings_req.version

    if len(save_payload) == 1:
        return {"success": True, "message": "No changes provided"}

    result = await service.save_tts_settings(**save_payload)
    if not result.get("success"):
        if result.get("error") == "Version conflict":
             raise HTTPException(status_code=409, detail=result)
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

# ============================================================================
# STATUS & CONTROL
# ============================================================================

@router.get("/status")
async def get_tts_status(
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Get TTS Status (enabled/disabled)."""
    result = await service.get_tts_status(user_id=user['id'])
    if result.get('error'):
        raise HTTPException(status_code=404, detail=result['error'])
    return result

@router.post("/engine")
async def set_tts_engine(
    request: EngineRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Set TTS engine type."""
    engine_type = request.engine_type
    valid_engines = ['gtts', 'cloud', 'local', 'gcloud']
    if engine_type not in valid_engines:
        raise HTTPException(status_code=400, detail=f"Invalid engine. Must be one of: {valid_engines}")

    if engine_type in ['cloud', 'local']:
        engine = 'f5tts'
        use_local_tts = engine_type == 'local'
    elif engine_type == 'gcloud':
        engine = 'gcloud'
        use_local_tts = False
    else:
        engine = 'gtts'
        use_local_tts = False

    result = await service.save_tts_settings(
        user_id=user['id'],
        engine=engine,
        use_local_tts=use_local_tts
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error") or "Failed to update engine")

    return {"success": True, "engine_type": engine_type}

@router.post("/enable")
async def enable_tts(
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Enable TTS."""
    success = await service.enable_tts(user_id=user['id'])
    return {"success": success}

@router.post("/disable")
async def disable_tts(
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Disable TTS."""
    success = await service.disable_tts(user_id=user['id'])
    return {"success": success}

# ============================================================================
# AUDIO SETTINGS
# ============================================================================

@router.get("/audio-settings")
async def get_audio_settings(
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Get audio settings."""
    return await service.get_audio_settings(user_id=user['id'])

@router.post("/audio-settings")
async def update_audio_settings(
    settings_req: AudioSettingsRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Update audio settings."""
    success = await service.save_audio_settings(
        user_id=user['id'],
        website_volume=settings_req.websiteVolume
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save audio settings")
    return {"success": True}

# ============================================================================
# FILTERS
# ============================================================================

@router.get("/filters/words")
async def get_filtered_words(
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Get filtered words."""
    return await service.get_filtered_words(user_id=user['id'])

@router.post("/filters/words")
async def add_filtered_word(
    request: AddWordRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Add word to filter."""
    success = await service.add_filtered_word(user['id'], request.word, request.platform)
    if not success:
        return {"success": False, "message": "Word already exists or error"}
    return {"success": True}

@router.delete("/filters/words/{word_id}")
async def remove_filtered_word(
    word_id: int,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Remove word from filter."""
    success = await service.remove_filtered_word(user['id'], word_id)
    if not success:
        raise HTTPException(status_code=404, detail="Word not found")
    return {"success": True}

# ============================================================================
# BLOCKED USERS
# ============================================================================

@router.get("/blocked-users")
async def get_blocked_users(
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Get blocked users."""
    return await service.get_blocked_users(user_id=user['id'])

@router.post("/blocked-users")
async def block_user(
    request: BlockUserRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Block user."""
    channel_name = request.channel_name or (
        (user.get('twitch_username') if request.platform == 'twitch' else user.get('vk_username') or user.get('vk_channel_name'))
        or user.get('username')
    )
    if not channel_name:
        raise HTTPException(status_code=400, detail="Failed to resolve channel_name")

    success = await service.block_user(
        user_id=user['id'], channel_name=channel_name, platform=request.platform, username=request.username
    )
    if not success:
        return {"success": True, "message": "User already blocked", "already_blocked": True}
    return {"success": True}

@router.post("/blocked-users/unblock")
async def unblock_user(
    request: UnblockUserRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Unblock user."""
    channel_name = request.channel_name or (
        (user.get('twitch_username') if request.platform == 'twitch' else user.get('vk_username') or user.get('vk_channel_name'))
        or user.get('username')
    )
    if not channel_name:
        raise HTTPException(status_code=400, detail="Failed to resolve channel_name")

    success = await service.unblock_user(
         user_id=user['id'], channel_name=channel_name, platform=request.platform, username=request.username
    )
    if not success:
         raise HTTPException(status_code=404, detail="User not found in blacklist")
    return {"success": True}

# ============================================================================
# VOICES (Proxy)
# ============================================================================

@router.get("/voices/global")
async def get_global_voices(
    user: dict = Depends(get_current_user)
):
    """Get global voices (Proxy)."""
    tts_url = settings.tts_service_url
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{tts_url}/api/tts/voices/global")
            if resp.status_code == 200:
                return resp.json()
            return {"voices": []}
    except Exception as e:
        logger.error(f"Error fetching global voices: {e}")
        return {"voices": []}

@router.get("/user/voices/{target_user_id}")
async def get_user_voices(
    target_user_id: int,
    user: dict = Depends(get_current_user)
):
    """Get user voices (Proxy)."""
    tts_url = settings.tts_service_url
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{tts_url}/api/tts/user/voices/{target_user_id}")
            if resp.status_code == 200:
                return resp.json()
            return {"voices": []}
    except Exception as e:
        logger.error(f"Error fetching user voices: {e}")
        return {"voices": []}

# ============================================================================
# GOOGLE CLOUD TTS VOICES
# ============================================================================

@router.get("/gcloud/voices")
async def get_gcloud_voices(
    language: Optional[str] = "ru-RU",
    user: dict = Depends(get_current_user)
):
    """Get Google Cloud TTS voices (cached)."""
    gcloud = get_google_cloud_tts()
    result = await gcloud.list_voices(language_code=language)
    if not result.get("success"):
        logger.warning("Google Cloud voices unavailable: %s", result.get("error", "unknown error"))
        return {
            "voices": [],
            "cached": False,
            "available": False,
            "error": result.get("error"),
            "hint": result.get("hint"),
            "status_code": result.get("status_code"),
        }
    return {
        "voices": result.get("voices", []),
        "cached": result.get("cached", False),
        "available": True,
        "auth_mode": result.get("auth_mode"),
    }


@router.post("/gcloud/voices")
async def set_gcloud_voices(
    request: GcloudVoiceSelectionRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Persist selected Google Cloud TTS voices for user."""
    voices = [
        v.strip()
        for v in request.voices
        if isinstance(v, str) and v.strip() and is_gemini_or_chirp_voice(v.strip())
    ]
    if not voices:
        raise HTTPException(status_code=400, detail="Select at least one Gemini or Chirp3-HD voice")
    result = await service.save_tts_settings(user_id=user['id'], gcloud_voices=voices)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error") or "Failed to save voices")
    return {"success": True, "voices": voices}


@router.post("/gcloud/preview")
async def preview_gcloud_voice(
    request: GcloudVoicePreviewRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service),
):
    """Preview Google Cloud TTS voice with sample phrase."""
    requested_mood = request.mood
    if requested_mood is None:
        saved_settings = await service.get_tts_settings(user_id=user["id"])
        requested_mood = (
            saved_settings.get("gcloud_mood")
            or saved_settings.get("gcloudMood")
        )
    resolved_mood = normalize_gcloud_mood(requested_mood)

    gcloud = get_google_cloud_tts()
    result = await gcloud.synthesize_speech(
        text=request.text or "Hello! This is a Google Cloud voice preview.",
        voice_name=request.voice_name,
        volume_level=50.0,
        speed=1.0,
        mood=resolved_mood,
        model_name=request.model_name,
    )
    if not result.get("success"):
        status_code = result.get("status_code")
        http_status = 502 if status_code in {400, 401, 403, 429, 500} else 400
        raise HTTPException(
            status_code=http_status,
            detail={
                "error": result.get("error") or "Failed to synthesize preview",
                "hint": result.get("hint"),
                "status_code": status_code,
            },
        )

    audio_path = result.get("audio_path")
    if not audio_path:
        raise HTTPException(status_code=500, detail="No audio_path returned")

    filename = Path(audio_path).name
    audio_url = f"{settings.backend_url}/api/tts/audio/{filename}"
    return {
        "success": True,
        "audio_url": audio_url,
        "voice": result.get("voice"),
        "auth_mode": result.get("auth_mode"),
        "requested_model": result.get("requested_model"),
        "fallback_used": bool(result.get("fallback_used")),
        "mood": resolved_mood,
    }

# ============================================================================
# ADDITIONAL SETTINGS (Platform / Listening Mode)
# ============================================================================

@router.get("/platform-settings")
async def get_platform_settings(
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Get enabled platforms for TTS."""
    settings = await service.get_tts_settings(user_id=user['id'])
    return {
        "enabled_platforms": settings.get("enabled_platforms", DEFAULT_ENABLED_PLATFORMS)
    }

@router.post("/platform-settings")
async def set_platform_settings(
    settings_req: PlatformSettingsRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Set enabled platforms for TTS."""
    success = await service.set_platform_settings(
        user_id=user['id'],
        enabled_platforms=settings_req.enabled_platforms
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update platform settings")
    return {"success": True}

@router.post("/listening-mode")
async def set_listening_mode(
    request: Request,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Set listening mode."""
    data = await request.json()
    mode = data.get("listening_mode") or data.get("listeningMode")
    if mode not in {"website", "obs"}:
        raise HTTPException(status_code=400, detail="Mode must be 'website' or 'obs'")

    result = await service.save_tts_settings(user_id=user['id'], listening_mode=mode)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error") or "Failed to save listening mode")

    return {"success": True, "listening_mode": mode, "listeningMode": mode}
