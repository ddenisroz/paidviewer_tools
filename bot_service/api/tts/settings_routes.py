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
from core.internal_service_auth import TTSAuthConfigError, build_tts_auth_headers, build_tts_httpx_client_kwargs
from constants import DEFAULT_ENABLED_PLATFORMS
from services.tts.tts_service import TTSService
from services.tts.google_cloud_tts import (
    get_google_cloud_tts,
    is_gemini_or_chirp_voice,
    normalize_gcloud_mood,
)
from services.tts.provider_utils import (
    ProviderRoutingError,
    get_synthesis_upstream_url,
    get_voice_management_upstream_params,
    get_voice_management_upstream_url,
    infer_provider_from_engine,
    normalize_provider,
    qwen_voice_crud_not_available_detail,
    should_route_provider_via_gateway,
)
from services.tts.tts_manager import get_tts_manager
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
    engine_type: str = Field(..., min_length=2, max_length=32)


class GcloudVoiceSelectionRequest(BaseModel):
    voices: List[str] = Field(default_factory=list)


class GcloudVoicePreviewRequest(BaseModel):
    voice_name: str = Field(..., min_length=2, max_length=120)
    text: Optional[str] = Field(default="Hello! This is a Google Cloud voice preview.")
    mood: Optional[str] = Field(default=None, max_length=20)
    model_name: Optional[str] = Field(default=None, max_length=120)

def get_tts_service(db: Session = Depends(get_db)) -> TTSService:
    return TTSService(db)


def _tts_auth_headers(
    provider: str,
    *,
    upstream: str = "voice",
    use_gateway: Optional[bool] = None,
) -> dict:
    try:
        return build_tts_auth_headers(
            provider=provider,
            upstream=upstream,  # type: ignore[arg-type]
            use_gateway=use_gateway,
            strict=True,
        )
    except TTSAuthConfigError as error:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "tts_upstream_auth_not_configured",
                "message": str(error),
            },
        ) from error


def _is_admin(user: dict) -> bool:
    return user.get("role") == "admin" or bool(user.get("is_admin", False))


def _normalize_voice_provider(provider: str) -> str:
    normalized_provider = normalize_provider(provider)
    if normalized_provider == "gcloud":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "gcloud_voice_management_not_supported",
                "message": "Google Cloud provider does not support voice CRUD in bot_service.",
            },
        )
    return "qwen" if normalized_provider == "qwen" else "f5"


def _voice_management_base_url(provider: str) -> str:
    resolved_provider = _normalize_voice_provider(provider)
    try:
        return get_voice_management_upstream_url(resolved_provider).rstrip("/")
    except ProviderRoutingError as error:
        if str(error) == "qwen_voice_crud_not_available":
            raise HTTPException(status_code=501, detail=qwen_voice_crud_not_available_detail()) from error
        raise HTTPException(status_code=400, detail={"code": str(error), "message": str(error)}) from error


_CANONICAL_ENGINE_TYPES = {
    "gtts",
    "gcloud",
    "f5_cloud",
    "f5_local",
    "qwen_cloud",
    "qwen_local",
}

_ENGINE_TYPE_ALIASES = {
    "cloud": "f5_cloud",
    "local": "f5_local",
    "f5": "f5_cloud",
    "qwen": "qwen_cloud",
}


def _normalize_engine_type(engine_type: str) -> str:
    normalized = (engine_type or "").strip().lower()
    return _ENGINE_TYPE_ALIASES.get(normalized, normalized)


async def _resolve_voice_proxy_provider(
    *,
    requested_provider: Optional[str],
    user_id: int,
    service: TTSService,
) -> str:
    if requested_provider and requested_provider.strip():
        return normalize_provider(requested_provider)

    try:
        settings_dict = await service.get_tts_settings(user_id=user_id)
        return infer_provider_from_engine(
            settings_dict.get("engine"),
            advanced_provider=settings_dict.get("advanced_provider"),
        )
    except Exception:
        logger.exception("Failed to resolve provider for voice proxy user_id=%s", user_id)
        return "f5"


def _engine_type_to_settings_payload(engine_type: str) -> dict:
    if engine_type == "gtts":
        return {
            "engine": "gtts",
            "use_local_tts": False,
        }
    if engine_type == "gcloud":
        return {
            "engine": "gcloud",
            "advanced_provider": "gcloud",
            "use_local_tts": False,
        }
    if engine_type == "f5_cloud":
        return {
            "engine": "f5tts",
            "advanced_provider": "f5",
            "f5_mode": "cloud",
            "use_local_tts": False,
        }
    if engine_type == "f5_local":
        return {
            "engine": "f5tts",
            "advanced_provider": "f5",
            "f5_mode": "local",
            "use_local_tts": True,
        }
    if engine_type == "qwen_cloud":
        return {
            "engine": "qwen",
            "advanced_provider": "qwen",
            "qwen_mode": "cloud",
            "use_local_tts": False,
        }
    if engine_type == "qwen_local":
        return {
            "engine": "qwen",
            "advanced_provider": "qwen",
            "qwen_mode": "local",
            "use_local_tts": True,
        }
    raise ValueError(f"Unsupported engine_type: {engine_type}")

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
        "advancedProvider": "advanced_provider",
        "f5Mode": "f5_mode",
        "qwenMode": "qwen_mode",
        "voice": "voice",
        "listeningMode": "listening_mode",
        "maxMessageLength": "max_message_length",
        "skipCommands": "skip_commands",
        "useLocalTTS": "use_local_tts",
        "filterReplies": "filter_replies",
        "filterMentions": "filter_mentions",
        "gcloudVoices": "gcloud_voices",
        "gcloudMood": "gcloud_mood",
        "qwenVoice": "qwen_voice",
        "qwenModel": "qwen_model",
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
        raise HTTPException(status_code=500, detail="Internal server error")
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
        raise HTTPException(status_code=404, detail="TTS status not found")
    return result


@router.get("/health")
async def get_tts_upstream_health(
    provider: str = "f5",
    user: dict = Depends(get_current_user),
):
    """Provider-aware health check routed through bot_service."""
    _ = user
    normalized_provider = normalize_provider(provider)

    if normalized_provider == "gcloud":
        gcloud = get_google_cloud_tts()
        gcloud_result = await gcloud.list_voices(language_code="ru-RU")
        is_healthy = bool(gcloud_result.get("success"))
        response_payload = {
            "success": True,
            "provider": "gcloud",
            "healthy": is_healthy,
            "status": "healthy" if is_healthy else "unhealthy",
            "auth_mode": gcloud_result.get("auth_mode"),
            "cached": bool(gcloud_result.get("cached", False)),
        }
        if not is_healthy:
            response_payload["detail"] = {
                "code": "gcloud_unhealthy",
                "message": gcloud_result.get("error") or "Google Cloud TTS is unavailable.",
                "hint": gcloud_result.get("hint"),
                "status_code": gcloud_result.get("status_code"),
            }
        return response_payload

    try:
        synthesis_url = get_synthesis_upstream_url(normalized_provider).rstrip("/")
    except ProviderRoutingError as error:
        if str(error) == "qwen_gateway_required":
            return {
                "success": True,
                "provider": "qwen",
                "healthy": False,
                "status": "unavailable",
                "detail": {
                    "code": "qwen_gateway_required",
                    "message": "Qwen synthesis is available only via tts-gateway.",
                    "hint": "Configure TTS_GATEWAY_URL and TTS_GATEWAY_API_KEY.",
                },
            }
        raise HTTPException(status_code=400, detail={"code": str(error), "message": str(error)}) from error

    use_gateway = should_route_provider_via_gateway(normalized_provider)
    _tts_auth_headers(
        normalized_provider,
        upstream="synthesis",
        use_gateway=use_gateway,
    )

    manager = get_tts_manager()
    is_healthy = await manager.check_tts_service_health(force_check=True, provider=normalized_provider)
    return {
        "success": True,
        "provider": normalized_provider,
        "healthy": bool(is_healthy),
        "status": "healthy" if is_healthy else "unhealthy",
        "upstream": {
            "url": synthesis_url,
            "via": "gateway" if use_gateway else "direct",
        },
    }


@router.post("/engine")
async def set_tts_engine(
    request: EngineRequest,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service)
):
    """
    Set TTS engine type.

    Canonical values:
    - gtts
    - gcloud
    - f5_cloud / f5_local
    - qwen_cloud / qwen_local

    Backward-compatible aliases are accepted:
    - cloud -> f5_cloud
    - local -> f5_local
    """
    raw_engine_type = request.engine_type
    engine_type = _normalize_engine_type(raw_engine_type)
    if engine_type not in _CANONICAL_ENGINE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid engine. Must be one of: {sorted(_CANONICAL_ENGINE_TYPES)}",
        )

    payload = _engine_type_to_settings_payload(engine_type)
    result = await service.save_tts_settings(user_id=user['id'], **payload)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail="Failed to update engine")

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
        raise HTTPException(status_code=409, detail="Word already exists or could not be added")
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
    provider: Optional[str] = None,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service),
):
    """Get global voices (Proxy)."""
    actor_id = user.get("id", user.get("user_id"))
    if not isinstance(actor_id, int) or actor_id <= 0:
        raise HTTPException(status_code=401, detail="Authentication required")

    resolved_provider = await _resolve_voice_proxy_provider(
        requested_provider=provider,
        user_id=actor_id,
        service=service,
    )
    if resolved_provider == "gcloud":
        return {"voices": [], "provider": "gcloud", "hint": "Use /api/tts/gcloud/voices"}

    tts_url = _voice_management_base_url(resolved_provider)
    try:
        async with httpx.AsyncClient(timeout=10.0, **build_tts_httpx_client_kwargs()) as client:
            resp = await client.get(
                f"{tts_url}/api/tts/voices/global",
                headers=_tts_auth_headers(resolved_provider, upstream="voice"),
                params=get_voice_management_upstream_params(resolved_provider),
            )
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 404:
                return {"voices": []}
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch provider voices")
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.warning("Timeout fetching global voices from TTS service")
        raise HTTPException(status_code=504, detail="TTS service timeout")
    except httpx.RequestError:
        logger.exception("Upstream error fetching global voices")
        raise HTTPException(status_code=502, detail="TTS service unavailable")
    except Exception:
        logger.exception("Error fetching global voices")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/user/voices/{target_user_id}")
async def get_user_voices(
    target_user_id: int,
    provider: Optional[str] = None,
    user: dict = Depends(get_current_user),
    service: TTSService = Depends(get_tts_service),
):
    """Get user voices (Proxy)."""
    actor_id = user.get("id", user.get("user_id"))
    if actor_id != target_user_id and not _is_admin(user):
        raise HTTPException(status_code=403, detail="Access denied")

    resolved_provider = await _resolve_voice_proxy_provider(
        requested_provider=provider,
        user_id=target_user_id,
        service=service,
    )
    if resolved_provider == "gcloud":
        return {"voices": [], "provider": "gcloud", "hint": "Use /api/tts/gcloud/voices"}

    tts_url = _voice_management_base_url(resolved_provider)
    try:
        async with httpx.AsyncClient(timeout=10.0, **build_tts_httpx_client_kwargs()) as client:
            resp = await client.get(
                f"{tts_url}/api/tts/user/voices/{target_user_id}",
                headers=_tts_auth_headers(resolved_provider, upstream="voice"),
                params=get_voice_management_upstream_params(resolved_provider),
            )
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 404:
                return {"voices": []}
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch user voices")
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.warning("Timeout fetching user voices from TTS service for user_id=%s", target_user_id)
        raise HTTPException(status_code=504, detail="TTS service timeout")
    except httpx.RequestError:
        logger.exception("Upstream error fetching user voices for user_id=%s", target_user_id)
        raise HTTPException(status_code=502, detail="TTS service unavailable")
    except Exception:
        logger.exception("Error fetching user voices")
        raise HTTPException(status_code=500, detail="Internal server error")

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
        raise HTTPException(status_code=500, detail="Failed to save voices")
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
        raise HTTPException(status_code=500, detail="Failed to save listening mode")

    return {"success": True, "listening_mode": mode, "listeningMode": mode}




