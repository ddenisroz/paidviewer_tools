# bot_service/api/tts/settings_routes.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import logging
import httpx

from core.database import get_db
from auth.auth import get_current_user
from core.config import settings
from auth.auth import get_current_user
from core.config import settings
from services.tts.tts_service import TTSService
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
    result = await service.save_tts_settings(
        user_id=user['id'],
        enable_7tv=settings_req.enable7TV,
        enable_twitch=settings_req.enableTwitch,
        enable_lexicon_filter=settings_req.enableLexiconFilter,
        enable_custom_lexicon=settings_req.enableCustomLexicon,
        engine=settings_req.engine,
        voice=settings_req.voice,
        listening_mode=settings_req.listeningMode,
        max_message_length=settings_req.maxMessageLength,
        skip_commands=settings_req.skipCommands,
        use_local_tts=settings_req.useLocalTTS,
        filter_replies=settings_req.filterReplies,
        filter_mentions=settings_req.filterMentions,
        client_version=getattr(settings_req, 'version', None)
    )
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
# ADDITIONAL SETTINGS (Platform / Listening Mode)
# ============================================================================

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
