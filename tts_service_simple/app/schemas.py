from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class TTSRequest(BaseModel):
    text: str
    voice: str = "female_1"
    user_id: Optional[int] = None

class TTSResponse(BaseModel):
    success: bool
    audio_url: Optional[str] = None
    error: Optional[str] = None
    processing_time: Optional[float] = None

class TTSSettingsData(BaseModel):
    """Настройки TTS для фильтрации"""
    enable7TV: Optional[bool] = True
    enableTwitch: Optional[bool] = True
    enableProfanity: Optional[bool] = True
    maxLength: Optional[int] = 200
    skipCommands: Optional[bool] = True

class ChannelTTSRequest(BaseModel):
    """Запрос на синтез TTS для канала (совместимость с bot_service)"""
    channel_name: str
    text: str
    author: str
    user_id: Optional[int] = None
    volume_level: Optional[int] = 50
    tts_settings: Optional[TTSSettingsData] = None
    word_filter: Optional[List[str]] = []
    blocked_users: Optional[List[str]] = []

class ChannelTTSResponse(BaseModel):
    """Ответ на запрос синтеза для канала"""
    success: bool
    audio_url: Optional[str] = None
    voice: Optional[str] = None
    volume: Optional[int] = None
    tts_type: Optional[str] = "local_f5"
    duration: Optional[float] = None
    channel: Optional[str] = None
    author: Optional[str] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    version: str
    gpu_info: Dict[str, Any]
    uptime: float
    memory_usage: Dict[str, Any]
