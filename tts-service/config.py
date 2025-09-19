#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Конфигурация TTS сервиса
Централизованные настройки
"""

import os
from pathlib import Path
from pydantic import BaseSettings, Field
from typing import Optional, List

class TTSConfig(BaseSettings):
    """Конфигурация TTS сервиса"""
    
    # Основные настройки
    host: str = Field(default="0.0.0.0", env="TTS_HOST")
    port: int = Field(default=8001, env="TTS_PORT")
    debug: bool = Field(default=False, env="TTS_DEBUG")
    
    # TTS движок
    default_voice: str = Field(default="speaker1_24000.wav", env="TTS_DEFAULT_VOICE")
    max_text_length: int = Field(default=500, env="TTS_MAX_TEXT_LENGTH")
    max_concurrent_requests: int = Field(default=3, env="TTS_MAX_CONCURRENT")
    request_timeout: int = Field(default=30, env="TTS_REQUEST_TIMEOUT")
    
    # Воркеры
    min_workers: int = Field(default=1, env="TTS_MIN_WORKERS")
    max_workers: int = Field(default=4, env="TTS_MAX_WORKERS")
    worker_idle_timeout: int = Field(default=300, env="TTS_WORKER_IDLE_TIMEOUT")
    
    # Папки
    base_dir: Path = Field(default_factory=lambda: Path(__file__).parent)
    voices_dir: str = Field(default="voices", env="TTS_VOICES_DIR")
    audio_cache_dir: str = Field(default="audio_cache", env="TTS_AUDIO_CACHE_DIR")
    temp_audio_dir: str = Field(default="temp_audio", env="TTS_TEMP_AUDIO_DIR")
    user_configs_dir: str = Field(default="user_configs", env="TTS_USER_CONFIGS_DIR")
    
    # Настройки по умолчанию
    default_target_rms: float = Field(default=0.4, env="TTS_DEFAULT_TARGET_RMS")
    default_cfg_strength: float = Field(default=2.0, env="TTS_DEFAULT_CFG_STRENGTH")
    default_cross_fade: float = Field(default=0.15, env="TTS_DEFAULT_CROSS_FADE")
    default_silence_duration: int = Field(default=100, env="TTS_DEFAULT_SILENCE_DURATION")
    
    # Безопасность
    secret_key: str = Field(default="your-secret-key-here", env="TTS_SECRET_KEY")
    enable_guest_mode: bool = Field(default=True, env="TTS_ENABLE_GUEST_MODE")
    max_requests_per_minute: int = Field(default=10, env="TTS_MAX_REQUESTS_PER_MINUTE")
    
    # CORS
    cors_origins: List[str] = Field(
        default=[
            "http://localhost:5173",
            "http://localhost:3000", 
            "http://localhost:3001",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000"
        ],
        env="TTS_CORS_ORIGINS"
    )
    
    # Логирование
    log_level: str = Field(default="INFO", env="TTS_LOG_LEVEL")
    log_file: Optional[str] = Field(default=None, env="TTS_LOG_FILE")
    
    # F5-TTS специфичные настройки
    enable_yofication: bool = Field(default=True, env="TTS_ENABLE_YOFICATION")
    enable_accents: bool = Field(default=True, env="TTS_ENABLE_ACCENTS")
    accent_model_size: str = Field(default="turbo", env="TTS_ACCENT_MODEL_SIZE")
    ode_method: str = Field(default="euler", env="TTS_ODE_METHOD")
    use_ema: bool = Field(default=True, env="TTS_USE_EMA")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def voices_path(self) -> Path:
        """Полный путь к папке с голосами"""
        return self.base_dir / self.voices_dir
    
    @property
    def audio_cache_path(self) -> Path:
        """Полный путь к папке кеша аудио"""
        return self.base_dir / self.audio_cache_dir
        
    @property
    def temp_audio_path(self) -> Path:
        """Полный путь к папке временных аудио файлов"""
        return self.base_dir / self.temp_audio_dir
        
    @property
    def user_configs_path(self) -> Path:
        """Полный путь к папке пользовательских конфигов"""
        return self.base_dir / self.user_configs_dir

# Глобальный экземпляр конфигурации
config = TTSConfig()

# Создаем необходимые директории
for path in [config.voices_path, config.audio_cache_path, config.temp_audio_path, config.user_configs_path]:
    path.mkdir(exist_ok=True)
