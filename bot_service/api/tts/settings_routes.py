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
from services.tts.google_cloud_tts import get_google_cloud_tts
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
    text: Optional[str] = Field(default="Привет! Это тестовый голос Google Cloud.")

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
    gcloud_voices = None
    try:
        if "gcloudVoices" in settings_req.model_fields_set:
            gcloud_voices = settings_req.gcloudVoices
    except Exception:
        gcloud_voices = settings_req.gcloudVoices

    save_payload = {
        "user_id": user["id"],
        "enable_7tv": settings_req.enable7TV,
        "enable_twitch": settings_req.enableTwitch,
        "enable_lexicon_filter": settings_req.enableLexiconFilter,
        "enable_custom_lexicon": settings_req.enableCustomLexicon,
        "engine": settings_req.engine,
        "voice": settings_req.voice,
        "listening_mode": settings_req.listeningMode,
        "max_message_length": settings_req.maxMessageLength,
        "skip_commands": settings_req.skipCommands,
        "use_local_tts": settings_req.useLocalTTS,
        "filter_replies": settings_req.filterReplies,
        "filter_mentions": settings_req.filterMentions,
        "client_version": getattr(settings_req, "version", None)
    }

    if gcloud_voices is not None:
        save_payload["gcloud_voices"] = gcloud_voices

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
    success = await service.block_user(
        user['id'], request.channel_name, request.platform, request.username
    )
    if not success:
        return {"success": False, "message": "User already blocked"}
    return {"success": True}

@router.post("/blocked-users/unblock")
async def unblock_user(
    request: UnblockUserRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Unblock user."""
    success = await service.unblock_user(
         user['id'], request.channel_name, request.platform, request.username
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
            "status_code": result.get("status_code"),
        }
    return {
        "voices": result.get("voices", []),
        "cached": result.get("cached", False),
        "available": True,
    }


@router.post("/gcloud/voices")
async def set_gcloud_voices(
    request: GcloudVoiceSelectionRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """Persist selected Google Cloud TTS voices for user."""
    voices = [v for v in request.voices if isinstance(v, str) and v.strip()]
    if not voices:
        raise HTTPException(status_code=400, detail="At least one voice must be selected")
    result = await service.save_tts_settings(user_id=user['id'], gcloud_voices=voices)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error") or "Failed to save voices")
    return {"success": True, "voices": voices}


@router.post("/gcloud/preview")
async def preview_gcloud_voice(
    request: GcloudVoicePreviewRequest,
    user: dict = Depends(get_current_user)
):
    """Preview Google Cloud TTS voice with sample phrase."""
    gcloud = get_google_cloud_tts()
    result = await gcloud.synthesize_speech(
        text=request.text or "Привет! Это тестовый голос Google Cloud.",
        voice_name=request.voice_name,
        volume_level=50.0,
        speed=1.0
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error") or "Failed to synthesize preview")

    audio_path = result.get("audio_path")
    if not audio_path:
        raise HTTPException(status_code=500, detail="No audio_path returned")

    filename = Path(audio_path).name
    audio_url = f"{settings.backend_url}/api/tts/audio/{filename}"
    return {"success": True, "audio_url": audio_url, "voice": result.get("voice")}

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
    mode = data.get("listening_mode")
    # This is also part of generic settings save_tts_settings
    # So we can reuse that if possible, or update specific field
    # service.save_tts_settings supports 'listening_mode'
    if mode:
        await service.save_tts_settings(user['id'], listening_mode=mode)
        return {"success": True}
    return {"success": False, "error": "Missing mode"}
