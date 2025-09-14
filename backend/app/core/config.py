import os
from dotenv import load_dotenv
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
# Load .env file from the project root directory
load_dotenv(BASE_DIR / ".env")

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / '.env',
        env_file_encoding='utf-8'
    )
    PROJECT_NAME: str = "TTS_TTV"

    # Project paths
    BASE_DIR: Path = BASE_DIR
    BACKEND_DIR: Path = BASE_DIR / "backend"
    VOICES_PATH: Path = BACKEND_DIR / "voices"
    AUDIO_CACHE_PATH: Path = BACKEND_DIR / "audio_cache"
    
    # Twitch API credentials
    TWITCH_CLIENT_ID: str
    TWITCH_CLIENT_SECRET: str
    TWITCH_BOT_TOKEN: str
    TWITCH_REDIRECT_URI: str = "http://localhost:8000/api/auth/twitch/callback"
    TWITCH_BOT_NICK: str
    BOT_PREFIX: str = "!"
    FRONTEND_URL: str
    
    # JWT settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30 * 24 * 60 # 30 days
    CLIENT_ORIGIN: str = "http://localhost:5173" # Default for local dev

    VK_CLIENT_ID: str = "YOUR_VK_CLIENT_ID"  # Replace with your VK client ID
    VK_CLIENT_SECRET: str = "YOUR_VK_CLIENT_SECRET"  # Replace with your VK client secret
    VK_REDIRECT_URI: str = "http://localhost:8000/api/auth/vk/callback"

settings = Settings()
