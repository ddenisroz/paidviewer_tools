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
    
    @property
    def audio_cache_path(self) -> Path:
        return self.base_dir / "audio_cache"
        
    @property
    def voices_path(self) -> Path:
        return self.base_dir / "voices"
        
    @property
    def user_voices_path(self) -> Path:
        return self.voices_path / "user"
        
    @property
    def user_configs_path(self) -> Path:
        return self.base_dir / "user_configs"

    # --- Логирование ---
    log_level: str = Field(default="INFO", env="TTS_LOG_LEVEL")
    cors_origins: str = Field(default="http://localhost:5173,http://localhost:3000", env="CORS_ORIGINS")
    log_file: Optional[str] = Field(default=None, env="TTS_LOG_FILE")

# Создаем единственный экземпляр конфига
config = AppConfig()

# Создаем папки при импорте, если их нет
config.audio_cache_path.mkdir(exist_ok=True)
config.voices_path.mkdir(exist_ok=True)
config.user_voices_path.mkdir(exist_ok=True)
config.user_configs_path.mkdir(exist_ok=True)
