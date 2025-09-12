import os
from dotenv import load_dotenv
from pathlib import Path
from pydantic_settings import BaseSettings

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent
# Load .env file from the 'backend' directory
load_dotenv(BASE_DIR / ".env")

class Settings(BaseSettings):
    PROJECT_NAME: str = "TTS_TTV"

    # Project paths
    BASE_DIR: Path = BASE_DIR
    VOICES_PATH: Path = BASE_DIR / "voices"
    AUDIO_CACHE_PATH: Path = BASE_DIR / "audio_cache"
    
    # Twitch API credentials
    TWITCH_CLIENT_ID: str
    TWITCH_CLIENT_SECRET: str
    TWITCH_BOT_TOKEN: str
    TWITCH_REDIRECT_URI: str
    # TMI_TOKEN: str # Deprecated, use TWITCH_BOT_TOKEN
    BOT_NICK: str
    BOT_PREFIX: str = "!"
    
    # JWT settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days

    class Config:
        # Pydantic will now look for a .env file in the same directory as this config.py
        # Since this file is in backend/app/core, we need to go up two levels.
        # However, since uvicorn is run from the 'backend' folder, the path should be relative to it.
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
