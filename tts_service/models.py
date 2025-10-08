# tts_service/models.py
from pydantic import BaseModel, Field
from typing import Optional
import datetime as dt

class VoiceSchema(BaseModel):
    id: int
    name: str
    file_path: str
    reference_text: Optional[str] = None
    voice_type: str
    owner_id: Optional[int] = None
    is_public: bool
    is_active: bool
    created_at: Optional[dt.datetime] = None
    
    # Настройки генерации TTS
    cfg_strength: float = 2.0
    speed_preset: str = 'normal'
    cross_fade_duration: float = 0.15
    silence_duration: float = 0.0
    temperature: float = 1.0
    top_p: float = 0.9
    top_k: int = 50
    repetition_penalty: float = 1.0
    length_penalty: float = 1.0
    early_stopping: bool = False

    class Config:
        from_attributes = True

class VoiceSettingsSchema(BaseModel):
    """Схема для обновления настроек голоса"""
    cfg_strength: Optional[float] = Field(None, ge=0.1, le=10.0, description="CFG strength (0.1-10.0)")
    speed_preset: Optional[str] = Field(None, pattern='^(very_slow|slow|normal|fast|very_fast)$', description="Speed preset")
    cross_fade_duration: Optional[float] = Field(None, ge=0.0, le=1.0, description="Cross fade duration in seconds")
    silence_duration: Optional[float] = Field(None, ge=0.0, le=2.0, description="Silence duration in seconds")
    temperature: Optional[float] = Field(None, ge=0.1, le=2.0, description="Temperature for sampling")
    top_p: Optional[float] = Field(None, ge=0.1, le=1.0, description="Top-p sampling")
    top_k: Optional[int] = Field(None, ge=1, le=100, description="Top-k sampling")
    repetition_penalty: Optional[float] = Field(None, ge=0.1, le=2.0, description="Repetition penalty")
    length_penalty: Optional[float] = Field(None, ge=0.1, le=2.0, description="Length penalty")
    early_stopping: Optional[bool] = Field(None, description="Early stopping")
    reference_text: Optional[str] = Field(None, min_length=1, max_length=5000, description="Reference text for voice synthesis")

class TtsConfigSchema(BaseModel):
    cfg_strength: float = Field(ge=0.1, le=10.0, description="CFG strength (0.1-10.0)")

class TtsConfigResponse(BaseModel):
    cfg_strength: float

class SynthesisRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Text to synthesize (1-5000 characters)")
    voice_name: str = Field(..., min_length=1, max_length=100, description="Voice name")
    user_id: Optional[int] = Field(None, ge=1, description="User ID")
    volume_level: Optional[float] = Field(50.0, ge=0.0, le=100.0, description="Volume level (0-100%)")
    cfg_strength: Optional[float] = Field(None, ge=0.1, le=10.0, description="CFG strength override")
    speed_preset: Optional[str] = Field(None, pattern='^(very_slow|slow|normal|fast|very_fast)$', description="Speed preset override")

class SynthesisResponse(BaseModel):
    success: bool
    message: str
    audio_file: Optional[str] = None
    audio_url: Optional[str] = None
    duration: Optional[float] = None

class VoiceUploadResponse(BaseModel):
    success: bool
    message: str
    voice_id: Optional[int] = None
    voice_name: Optional[str] = None

class TranscriptionResponse(BaseModel):
    success: bool
    text: Optional[str] = None
    message: str
