# bot_service/core/config_modern.py
"""
Современная конфигурация с использованием pydantic-settings
Заменяет os.getenv() костыли на профессиональную конфигурацию
"""
import logging
from typing import Optional
from pydantic import Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

class ModernConfig(BaseSettings):
    """Современная конфигурация приложения с валидацией"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # === DATABASE ===
    database_url: str = Field(default="sqlite:///./data/app_data.db", description="Database URL")
    
    # === SECURITY ===
    secret_key: str = Field(default="your-super-secret-jwt-key-here", description="Secret key for JWT")
    jwt_secret_key: str = Field(default="", description="JWT secret key (uses secret_key if not set)")
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    jwt_access_token_expire_minutes: int = Field(default=30, description="Access token expiry")
    jwt_refresh_token_expire_days: int = Field(default=7, description="Refresh token expiry")
    token_encryption_key: str = Field(default="tsWOwRqyIbRBATNPyONTd0K1sHLzVPbEeVFmMc7T8II=", description="Key for encrypting OAuth tokens")
    
    # === RATE LIMITING ===
    rate_limit_enabled: bool = Field(default=True, description="Enable rate limiting")
    rate_limit_requests_per_minute: int = Field(default=60, description="Default rate limit")
    rate_limit_login_attempts: int = Field(default=5, description="Login attempts limit")
    rate_limit_login_window_minutes: int = Field(default=15, description="Login window")
    
    # === TTS ===
    tts_max_text_length: int = Field(default=200, description="Max TTS text length")
    tts_daily_limit: int = Field(default=100, description="Daily TTS requests limit")
    tts_gpu_time_limit: float = Field(default=300.0, description="Daily GPU time limit")
    
    # === VK LIVE ===
    vk_client_id: Optional[str] = Field(default=None, description="VK Client ID")
    vk_client_secret: Optional[str] = Field(default=None, description="VK Client Secret")
    vk_live_user_token: Optional[str] = Field(default=None, description="VK Live User Token")
    
    # === YOUTUBE ===
    youtube_api_key: Optional[str] = Field(default=None, description="YouTube API Key")
    
    # === HUGGINGFACE ===
    huggingface_token: Optional[str] = Field(default=None, description="HuggingFace Token")
    
    # === MONITORING ===
    monitoring_enabled: bool = Field(default=True, description="Enable monitoring")
    monitoring_port: int = Field(default=8003, description="Monitoring port")
    monitoring_interval: int = Field(default=30, description="Monitoring interval seconds")
    
    # === ADDITIONAL FIELDS FOR TESTS ===
    jwt_expiration_hours: int = Field(default=24, description="JWT expiration hours")
    tts_priority_level: int = Field(default=2, description="TTS priority level")
    tts_enabled: bool = Field(default=True, description="TTS enabled")
    cors_origins: str = Field(default="*", description="CORS origins")
    session_secret_key: str = Field(default="your-session-secret-key", description="Session secret key")
    session_max_age_seconds: int = Field(default=3600, description="Session max age")
    session_https_only: bool = Field(default=False, description="Session HTTPS only")
    environment: str = Field(default="development", description="Environment")
    debug: bool = Field(default=False, description="Debug mode")
    log_level: str = Field(default="INFO", description="Log level")
    
    @validator('jwt_secret_key')
    def validate_jwt_secret(cls, v, values):
        # Если jwt_secret_key не задан, используем secret_key
        if not v and 'secret_key' in values:
            v = values['secret_key']
        
        if v == "your-super-secret-jwt-key-here":
            logger.warning("⚠️ Using default JWT secret key! Change JWT_SECRET_KEY in production!")
        return v
    
    @validator('rate_limit_requests_per_minute')
    def validate_rate_limit(cls, v):
        if v < 1:
            raise ValueError("Rate limit must be at least 1")
        return v
    
    @validator('tts_max_text_length')
    def validate_tts_length(cls, v):
        if v < 10:
            raise ValueError("TTS text length must be at least 10 characters")
        return v
    
    @validator('tts_priority_level')
    def validate_tts_priority(cls, v):
        if not 1 <= v <= 4:
            raise ValueError("TTS priority level must be between 1 and 4")
        return v
    
    def update(self, **kwargs):
        """Обновить конфигурацию"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        return self

# Глобальный экземпляр конфигурации
modern_config = ModernConfig()

logger.info("🔧 Modern configuration loaded with pydantic-settings")