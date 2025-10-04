import os
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional

class AppConfig(BaseModel):
    # --- Общие настройки ---
    host: str = Field(default="0.0.0.0", env="TTS_HOST")
    port: int = Field(default=8001, env="TTS_PORT")
    debug: bool = Field(default=True, env="TTS_DEBUG")
    
    # --- Настройки путей ---
    base_dir: Path = Path(__file__).resolve().parent
    
    # Единая структура аудио файлов (внутри tts_service)
    @property
    def audio_path(self) -> Path:
        return self.base_dir / "audio"
    
    # Голоса (референсные файлы)
    @property
    def voices_path(self) -> Path:
        return self.audio_path / "voices"
        
    @property
    def global_voices_path(self) -> Path:
        return self.voices_path / "global"
        
    @property
    def user_voices_path(self) -> Path:
        return self.voices_path / "user"
    
    # Временные файлы (автоудаление через 5 минут)
    @property
    def temp_audio_path(self) -> Path:
        return self.audio_path / "temp"
        
    # Тестовые аудио файлы
    @property
    def test_audio_path(self) -> Path:
        return self.audio_path / "test"
        
    # Продакшн аудио файлы
    @property
    def production_audio_path(self) -> Path:
        return self.audio_path / "production"
        
    # Кеш для F5-TTS
    @property
    def cache_audio_path(self) -> Path:
        return self.audio_path / "cache"
        
    @property
    def user_configs_path(self) -> Path:
        return self.base_dir / "user_configs"

    # --- Логирование ---
    log_level: str = Field(default="INFO", env="TTS_LOG_LEVEL")
    cors_origins: str = Field(default="http://localhost:5173,http://localhost:3000", env="CORS_ORIGINS")
    log_file: Optional[str] = Field(default=None, env="TTS_LOG_FILE")
    
    # --- F5-TTS настройки ---
    # Настраиваемые параметры (рекомендации из официального репозитория)
    cfg_strength: float = Field(default=2.5, env="TTS_CFG_STRENGTH")  # Рекомендуемое: 2.0-5.0
    
    # Фиксированные параметры (хардкод)
    target_rms: float = 0.1  # Фиксированная громкость для всех голосов
    cross_fade_duration: float = 0.15
    silence_duration_ms: int = 100
    sway_sampling_coef: float = -1.0

# Создаем единственный экземпляр конфига
config = AppConfig()

# Создаем папки при импорте, если их нет
config.voices_path.mkdir(exist_ok=True)
config.global_voices_path.mkdir(exist_ok=True)
config.user_voices_path.mkdir(exist_ok=True)
config.audio_path.mkdir(exist_ok=True)
config.test_audio_path.mkdir(exist_ok=True)
config.production_audio_path.mkdir(exist_ok=True)
config.temp_audio_path.mkdir(exist_ok=True)
config.user_configs_path.mkdir(exist_ok=True)
