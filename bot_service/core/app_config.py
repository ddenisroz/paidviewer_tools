# bot_service/core/app_config.py
"""Конфигурация приложения FastAPI"""
import os
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Импорты перенесены внутрь функций для избежания циклических импортов

def setup_logging():
    """Настройка логирования с использованием современной конфигурации"""
    from logging_config import bot_logging_config
    
    # Получаем уровень логирования из переменных окружения
    log_level = os.getenv("LOG_LEVEL", "DEBUG")
    
    # Настраиваем логирование
    logger = bot_logging_config.setup_logging(log_level)
    
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
    from constants import DEFAULT_FRONTEND_URL
    frontend_url = os.getenv("FRONTEND_URL")
    if not frontend_url:
        raise ValueError("FRONTEND_URL environment variable is required")
    
    # Получаем дополнительные CORS origins из переменных окружения
    additional_origins = os.getenv("ADDITIONAL_CORS_ORIGINS", "").split(",")
    additional_origins = [origin.strip() for origin in additional_origins if origin.strip()]
    
    allowed_origins = [frontend_url] + additional_origins
    
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
