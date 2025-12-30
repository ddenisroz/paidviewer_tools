# bot_service/core/app_config.py
"""Конфигурация приложения FastAPI"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from core.config import settings

# Импорты перенесены внутрь функций для избежания циклических импортов

def setup_logging():
    """Настройка логирования с использованием современной конфигурации"""
    from logging_config import bot_logging_config

    # Настраиваем логирование
    logger = bot_logging_config.setup_logging(settings.log_level)

    # Логируем успешную настройку
    logger.info("=== BOT SERVICE STARTED ===")

    return logger

def create_app() -> FastAPI:
    """Создание и настройка FastAPI приложения"""
    app = FastAPI(
        title="TTS Bot Service",
        description="Сервис для управления TTS ботом",
        version="2.0.0"
    )

    # Добавляем централизованные обработчики исключений
    from core.exception_handlers import setup_exception_handlers
    setup_exception_handlers(app)

    # Добавляем rate limiting
    from core.security_modern import limiter, rate_limit_handler
    from slowapi.errors import RateLimitExceeded

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

    # CORS настройки
    # Парсим CORS origins из строки с запятыми
    cors_origins_list = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
    
    allowed_origins = cors_origins_list

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
        max_age=3600,  # Кэшировать preflight запросы на 1 час
    )

    # Статические файлы
    from .project_paths import FRONTEND_ROOT, TEMP_DIR

    widgets_path = FRONTEND_ROOT / "src" / "widgets"
    if widgets_path.exists():
        app.mount("/widgets", StaticFiles(directory=str(widgets_path)), name="widgets")

    # Аудио файлы
    temp_audio_dir = TEMP_DIR / "tts_audio"
    temp_audio_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/audio", StaticFiles(directory=str(temp_audio_dir)), name="audio")

    return app

# Глобальные переменные теперь определены в main.py
# Это предотвращает дублирование экземпляров
