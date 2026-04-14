# features/tts/tts_core.py
"""
Core TTS components: Pydantic schemas, TTSAPI class, helper functions.
Shared across all TTS API modules.
"""
import re
import httpx
import logging
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.internal_service_auth import build_tts_auth_headers
from auth.auth import get_current_user
from services.tts.tts_manager import get_tts_manager
from services.tts.provider_utils import normalize_local_tts_endpoint_url

logger = logging.getLogger('bot_service.tts')

# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class FilteredWord(BaseModel):
    id: Optional[int] = None
    word: str
    platform: str  # 'all', 'twitch', 'vk'
    created_at: Optional[str] = None


class AddWordRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)
    platform: str = Field('all', pattern="^(twitch|vk|all)$")

    @field_validator('word')
    @classmethod
    def sanitize_word_field(cls, v):
        if not v:
            return v
        clean_word = re.sub(r'<[^>]+>', '', v)
        clean_word = re.sub(r'[<>]', '', clean_word)
        return clean_word.strip().lower()


class AudioSettingsRequest(BaseModel):
    websiteVolume: int = Field(..., ge=0, le=100)


class TtsSettingsRequest(BaseModel):
    enable7TV: bool = Field(True)
    enableTwitch: bool = Field(True)
    enableLexiconFilter: bool = Field(True)
    enableCustomLexicon: bool = Field(False)
    engine: str = Field('gtts')
    advancedProvider: Optional[str] = Field(None)
    f5Mode: Optional[str] = Field(None)
    qwenMode: Optional[str] = Field(None)
    voice: str = Field('default_voice')
    listeningMode: str = Field('website')
    maxMessageLength: int = Field(500, ge=50, le=2000)
    skipCommands: bool = Field(True)
    useLocalTTS: bool = Field(False)
    filterReplies: bool = Field(False)
    filterMentions: bool = Field(False)
    gcloudVoices: Optional[List[str]] = None
    gcloudMood: Optional[str] = None
    qwenVoice: Optional[str] = None
    qwenModel: Optional[str] = None
    version: int = Field(1, ge=1)

    @field_validator('engine')
    @classmethod
    def validate_engine(cls, v):
        if v not in ['gtts', 'f5tts', 'gcloud', 'qwen']:
            raise ValueError('engine must be either "gtts", "f5tts", "gcloud", or "qwen"')
        return v

    @field_validator('advancedProvider')
    @classmethod
    def validate_advanced_provider(cls, v):
        if v is None:
            return v
        normalized = str(v).strip().lower()
        if normalized not in {'f5', 'gcloud', 'qwen'}:
            raise ValueError('advancedProvider must be one of: f5, gcloud, qwen')
        return normalized

    @field_validator('f5Mode', 'qwenMode')
    @classmethod
    def validate_provider_mode(cls, v):
        if v is None:
            return v
        normalized = str(v).strip().lower()
        if normalized not in {'cloud', 'local'}:
            raise ValueError('mode must be one of: cloud, local')
        return normalized

    @field_validator('listeningMode')
    @classmethod
    def validate_listening_mode(cls, v):
        if v not in ['website', 'obs']:
            raise ValueError('listeningMode must be either "website" or "obs"')
        return v

    @field_validator('gcloudMood')
    @classmethod
    def validate_gcloud_mood(cls, v):
        if v is None:
            return v
        normalized = str(v).strip().lower()
        if normalized not in {'neutral', 'sad', 'happy'}:
            raise ValueError('gcloudMood must be one of: neutral, sad, happy')
        return normalized


class BlockUserRequest(BaseModel):
    channel_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    platform: str = Field(..., pattern="^(twitch|vk)$")
    username: str = Field(..., min_length=1, max_length=100)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        normalized = (value or "").strip().lstrip("@").strip().lower()
        if not normalized:
            raise ValueError("username is required")
        return normalized


class UnblockUserRequest(BaseModel):
    channel_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    platform: str = Field(..., pattern="^(twitch|vk)$")
    username: str = Field(..., min_length=1, max_length=100)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        normalized = (value or "").strip().lstrip("@").strip().lower()
        if not normalized:
            raise ValueError("username is required")
        return normalized


class ListeningModeRequest(BaseModel):
    listeningMode: str = Field(...)

    @field_validator('listeningMode')
    @classmethod
    def validate_listening_mode(cls, v):
        if v not in ['website', 'obs']:
            raise ValueError('listeningMode must be either "website" or "obs"')
        return v


class PlatformSettingsRequest(BaseModel):
    enabled_platforms: List[str] = Field(...)


class VoiceSchema(BaseModel):
    id: int
    name: str
    file_path: str
    voice_type: str
    owner_id: Optional[int] = None
    is_public: bool = False
    is_active: bool = True
    reference_text: Optional[str] = None
    created_at: Optional[str] = None


class TranscriptionResponse(BaseModel):
    success: bool
    text: Optional[str] = None
    message: str


class LocalTTSConfigRequest(BaseModel):
    provider: str = Field(default="f5")
    endpoint_url: str
    api_key: Optional[str] = None
    use_local: bool = False

    @field_validator('provider')
    @classmethod
    def validate_provider(cls, v):
        normalized = str(v).strip().lower()
        if normalized not in {'f5', 'qwen'}:
            raise ValueError('provider must be either "f5" or "qwen"')
        return normalized

    @field_validator('endpoint_url')
    @classmethod
    def validate_endpoint_url(cls, v):
        return normalize_local_tts_endpoint_url(v)


class LocalTTSConfigResponse(BaseModel):
    success: bool
    message: str
    config: Optional[dict] = None


class UpdateTtsModeRequest(BaseModel):
    tts_mode: str


class CreateTtsRewardRequest(BaseModel):
    platform: str
    title: str
    cost: int
    cooldown: int = 0


# ============================================================================
# TTS API class used by TTS Manager.
# ============================================================================

class TTSAPI:
    """Main TTS API class for synthesis operations."""
    
    def __init__(self):
        self.tts_manager = get_tts_manager()

    async def send_tts_request(
        self,
        channel_name: str,
        text: str,
        author: str,
        user_id: int = None,
        db_session=None,
        volume_level: float = 50.0,
        connection_manager=None,
        use_ai_tts: bool = False,
        use_basic_tts: bool = True,
        engine: Optional[str] = None,
        tts_settings: dict = None,
        word_filter: list = None,
        blocked_users: list = None
    ) -> dict:
        """Send a synthesis request through TTS Manager."""
        try:
            result = await self.tts_manager.synthesize_tts(
                channel_name=channel_name,
                text=text,
                author=author,
                user_id=user_id,
                volume_level=volume_level,
                use_ai_tts=use_ai_tts,
                use_basic_tts=use_basic_tts,
                engine=engine,
                connection_manager=connection_manager,
                tts_settings=tts_settings,
                word_filter=word_filter,
                blocked_users=blocked_users,
                db_session=db_session,
            )

            if result.get("success"):
                tts_type = result.get("tts_type", "unknown")
                voice = result.get("voice", "unknown")
                logger.info(f"[OK] TTS synthesis succeeded: type={tts_type}, voice={voice}, channel={channel_name}")
            else:
                logger.error(f"[ERROR] TTS synthesis failed: {result.get('error')}")

            return result

        except Exception:
            logger.exception("[ERROR] Failed to submit a TTS request")
            return {"success": False, "error": "Internal server error"}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def check_user_whitelisted(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Validate voice-management access for authenticated users."""
    if not user or not user.get('id') or user.get('id') <= 0:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    from repositories.user_repository import UserRepository
    db_user = UserRepository(db).get_by_id(user['id'])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Use the cached whitelist check.
    from utils.whitelist_cache import is_user_whitelisted_cached
    if is_user_whitelisted_cached(db_user, db):
        return user

    raise HTTPException(
        status_code=403,
        detail="You do not have access to voice management. Contact an administrator."
    )


async def check_local_tts_health(
    endpoint_url: str,
    api_key: Optional[str] = None,
    provider: str = "f5",
    fetch_status: bool = False,
) -> dict:
    """Check the health of a local TTS service."""
    try:
        endpoint = normalize_local_tts_endpoint_url(endpoint_url)
        normalized_provider = (provider or "f5").strip().lower()
        headers = build_tts_auth_headers(
            provider=normalized_provider,
            upstream="local",
            local_api_key=api_key,
            strict=False,
        )

        async with httpx.AsyncClient(timeout=5.0) as client:
            if normalized_provider == "qwen":
                compatibility_note = (
                    "This endpoint is treated as a user's self-hosted Qwen endpoint. "
                    "The official cloud path remains bot_service -> tts-gateway -> qwen runtime. "
                    "The self-hosted path still uses a compatibility flow via /api/prepare -> /api/stream/{id}, "
                    "but the worker now exposes health, model catalog and user voice CRUD endpoints."
                )
                for health_path in ("/health/ready", "/health/live", "/health"):
                    try:
                        health_probe = await client.get(f"{endpoint}{health_path}", headers=headers)
                        if health_probe.status_code == 200:
                            health_payload = health_probe.json()
                            result = {
                                "healthy": True,
                                "status": health_payload.get("status", "healthy"),
                                "compatibility_mode": "qwen_prepare_stream",
                                "warning": compatibility_note,
                                "version": health_payload.get("version"),
                                "ready": health_payload.get("ready"),
                                "phase": health_payload.get("phase"),
                                "percent": health_payload.get("percent"),
                                "message": health_payload.get("message"),
                                "current_model": health_payload.get("current_model"),
                                "target_model": health_payload.get("target_model"),
                            }
                            if fetch_status:
                                result["status_data"] = None
                            return result
                    except httpx.RequestError:
                        pass

                try:
                    prepare_probe = await client.get(f"{endpoint}/api/prepare", headers=headers)
                    if prepare_probe.status_code in {405, 422}:
                        result = {
                            "healthy": True,
                            "status": "healthy",
                            "compatibility_mode": "qwen_prepare_stream",
                            "warning": compatibility_note,
                        }
                        if fetch_status:
                            try:
                                status_probe = await client.get(f"{endpoint}/api/status/__healthcheck__", headers=headers)
                                result["status_data"] = status_probe.json() if status_probe.status_code == 200 else None
                            except Exception:
                                result["status_data"] = None
                        return result
                except httpx.RequestError:
                    pass

                root_response = await client.get(f"{endpoint}/", headers=headers)
                if root_response.status_code == 200:
                    result = {
                        "healthy": True,
                        "status": "healthy",
                        "compatibility_mode": "qwen_prepare_stream",
                        "warning": compatibility_note,
                    }
                    if fetch_status:
                        result["status_data"] = None
                    return result

                return {"healthy": False, "error": f"HTTP {root_response.status_code}"}

            response = await client.get(f"{endpoint}/health", headers=headers)

            if response.status_code == 200:
                data = response.json()
                result = {
                    "healthy": True,
                    "status": data.get('status', 'healthy'),
                    "version": data.get('version'),
                    "gpu_info": data.get('gpu_info'),
                    "ready": data.get("ready"),
                    "phase": data.get("phase"),
                    "percent": data.get("percent"),
                    "message": data.get("message"),
                    "current_model": data.get("current_model"),
                    "target_model": data.get("target_model"),
                }
                if fetch_status:
                    try:
                        status_response = await client.get(f"{endpoint}/api/tts/status", headers=headers)
                        result["status_data"] = status_response.json() if status_response.status_code == 200 else None
                    except Exception:
                        result["status_data"] = None
                return result
            else:
                return {"healthy": False, "error": f"HTTP {response.status_code}"}

    except ValueError as error:
        return {"healthy": False, "error": str(error)}
    except httpx.TimeoutException:
        return {"healthy": False, "error": "Timeout: service is not responding"}
    except Exception:
        return {"healthy": False, "error": "Internal server error"}


# Global instance
tts_api_instance = TTSAPI()
