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
from auth.auth import get_current_user
from core.config import settings
from constants import DEFAULT_TTS_SERVICE_URL
from services.tts.tts_manager import get_tts_manager

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
    voice: str = Field('female_1')
    listeningMode: str = Field('website')
    maxMessageLength: int = Field(500, ge=50, le=2000)
    skipCommands: bool = Field(True)
    useLocalTTS: bool = Field(False)
    filterReplies: bool = Field(False)
    filterMentions: bool = Field(False)
    gcloudVoices: Optional[List[str]] = None
    gcloudMood: Optional[str] = None
    version: int = Field(1, ge=1)

    @field_validator('engine')
    @classmethod
    def validate_engine(cls, v):
        if v not in ['gtts', 'f5tts', 'gcloud']:
            raise ValueError('engine must be either "gtts", "f5tts", or "gcloud"')
        return v

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


class UnblockUserRequest(BaseModel):
    channel_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    platform: str = Field(..., pattern="^(twitch|vk)$")
    username: str = Field(..., min_length=1, max_length=100)


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
    endpoint_url: str
    api_key: Optional[str] = None
    use_local: bool = False


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
# TTS API CLASS (РґР»СЏ СЂР°Р±РѕС‚С‹ СЃ TTS Manager)
# ============================================================================

class TTSAPI:
    """Main TTS API class for synthesis operations."""
    
    def __init__(self):
        self.tts_service_url = settings.tts_service_url or DEFAULT_TTS_SERVICE_URL
        self.tts_manager = get_tts_manager()

    async def send_tts_request(
        self,
        channel_name: str,
        text: str,
        author: str,
        user_id: int = None,
        volume_level: float = 50.0,
        connection_manager=None,
        use_ai_tts: bool = False,
        use_basic_tts: bool = True,
        engine: Optional[str] = None,
        tts_settings: dict = None,
        word_filter: list = None,
        blocked_users: list = None
    ) -> dict:
        """РћС‚РїСЂР°РІРёС‚СЊ Р·Р°РїСЂРѕСЃ РЅР° РѕР·РІСѓС‡РєСѓ С‡РµСЂРµР· TTS Manager"""
        try:
            result = await self.tts_manager.synthesize_tts(
                channel_name=channel_name,
                text=text,
                author=author,
                volume_level=volume_level,
                use_ai_tts=use_ai_tts,
                use_basic_tts=use_basic_tts,
                engine=engine,
                connection_manager=connection_manager,
                tts_settings=tts_settings,
                word_filter=word_filter,
                blocked_users=blocked_users
            )

            if result.get("success"):
                tts_type = result.get("tts_type", "unknown")
                voice = result.get("voice", "unknown")
                logger.info(f"[OK] TTS СЃРёРЅС‚РµР· СѓСЃРїРµС€РµРЅ: type={tts_type}, voice={voice}, channel={channel_name}")
            else:
                logger.error(f"[ERROR] TTS СЃРёРЅС‚РµР· РЅРµ СѓРґР°Р»СЃСЏ: {result.get('error')}")

            return result

        except Exception:
            logger.exception("[ERROR] РћС€РёР±РєР° РїСЂРё РѕС‚РїСЂР°РІРєРµ TTS Р·Р°РїСЂРѕСЃР°")
            return {"success": False, "error": "Internal server error"}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def check_user_whitelisted(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """РџСЂРѕРІРµСЂСЏРµС‚ whitelist РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ РіРѕР»РѕСЃР°РјРё (С‚РѕР»СЊРєРѕ РґР»СЏ Р°РІС‚РѕСЂРёР·РѕРІР°РЅРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№)"""
    if not user or not user.get('id') or user.get('id') <= 0:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    from repositories.user_repository import UserRepository
    db_user = UserRepository(db).get_by_id(user['id'])
    if not db_user:
        raise HTTPException(status_code=404, detail="РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ")

    # РџСЂРѕРІРµСЂСЏРµРј whitelist СЃ РєРµС€РёСЂРѕРІР°РЅРёРµРј
    from utils.whitelist_cache import is_user_whitelisted_cached
    if is_user_whitelisted_cached(db_user, db):
        return user

    raise HTTPException(
        status_code=403,
        detail="РЈ РІР°СЃ РЅРµС‚ РґРѕСЃС‚СѓРїР° Рє СѓРїСЂР°РІР»РµРЅРёСЋ РіРѕР»РѕСЃР°РјРё. РћР±СЂР°С‚РёС‚РµСЃСЊ Рє Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂСѓ."
    )


async def check_local_tts_health(endpoint_url: str, api_key: Optional[str] = None) -> dict:
    """РџСЂРѕРІРµСЂРёС‚СЊ Р·РґРѕСЂРѕРІСЊРµ Р»РѕРєР°Р»СЊРЅРѕРіРѕ TTS СЃРµСЂРІРёСЃР°"""
    try:
        headers = {}
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'

        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{endpoint_url}/health", headers=headers)

            if response.status_code == 200:
                data = response.json()
                return {
                    "healthy": True,
                    "version": data.get('version'),
                    "gpu_info": data.get('gpu_info')
                }
            else:
                return {"healthy": False, "error": f"HTTP {response.status_code}"}

    except httpx.TimeoutException:
        return {"healthy": False, "error": "Timeout: СЃРµСЂРІРёСЃ РЅРµ РѕС‚РІРµС‡Р°РµС‚"}
    except Exception:
        return {"healthy": False, "error": "Internal server error"}


# Global instance
tts_api_instance = TTSAPI()


