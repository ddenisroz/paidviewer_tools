# tts_service/app_factory.py
"""Фабрика приложения TTS Service"""
import sys
import os
from pathlib import Path
import logging
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Загружаем переменные окружения
load_dotenv()

# Настройка для работы с Hugging Face Hub
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)

# Настраиваем кеш для Hugging Face
cache_dir = Path("f5_tts_cache").absolute()
os.environ['HF_HOME'] = str(cache_dir)
os.environ['HUGGINGFACE_HUB_CACHE'] = str(cache_dir)

# Добавляем путь к проекту
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    """Создать FastAPI приложение"""
    
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Управление жизненным циклом приложения"""
        # Startup
        logger.info("[START] TTS Service starting up...")
        
        try:
            # Инициализация базы данных
            from tts_service.database import init_db
            init_db()
            logger.info("[OK] Database initialized")
            
            # Инициализация TTS движка
            from tts_service.tts_engine import tts_engine_manager
            await tts_engine_manager.initialize()
            logger.info("[OK] TTS Engine initialized")
            
            # Инициализация файлового менеджера (инициализация происходит в __init__)
            from tts_service.file_manager import file_manager
            # Директории уже созданы в конструкторе FileManager
            logger.info("[OK] File Manager initialized")
            
            # Запуск фоновых задач
            from tts_service.background_tasks import background_task_manager
            await background_task_manager.start()
            logger.info("[OK] Background tasks started")
            
            # Инициализация мониторинга
            from monitoring import tts_monitor
            tts_monitor.start_monitoring(interval=30)
            logger.info("[OK] Monitoring started")
            
            logger.info("[SUCCESS] TTS Service startup complete!")
            
        except Exception:
            logger.exception("[ERROR] Error during startup")
            raise
        
        yield
        
        # Shutdown
        logger.info("[SHUTDOWN] TTS Service shutting down...")
        
        try:
            # Остановка фоновых задач
            await background_task_manager.stop()
            logger.info("[OK] Background tasks stopped")
            
            # Остановка TTS движка
            await tts_engine_manager.shutdown()
            logger.info("[OK] TTS Engine stopped")
            
            # Остановка мониторинга
            tts_monitor.stop_monitoring()
            logger.info("[OK] Monitoring stopped")
            
            logger.info("[SUCCESS] TTS Service shutdown complete!")
            
        except Exception:
            logger.exception("[ERROR] Error during shutdown")

    # Создаем приложение
    app = FastAPI(
        title="TTS Service",
        description="Text-to-Speech Service with AI Voice Synthesis",
        version="1.0.0",
        lifespan=lifespan
    )

    # Настройка CORS
    from tts_service.config import config
    allowed_origins = [origin.strip() for origin in config.cors_origins.split(",") if origin.strip()]
    if not allowed_origins:
        allowed_origins = ["http://localhost:5173"]
    allow_credentials = "*" not in allowed_origins
    if not allow_credentials:
        logger.warning("CORS wildcard origin configured; credentials are disabled for safety")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Регистрируем роутеры
    from tts_service.api_endpoints import tts_api
    from tts_service.health_api import health_router, api_health_router
    from tts_service.admin_api import admin_router
    from tts_service.tts_control_api import router as tts_control_router
    from tts_service.api_endpoints_voice_enabled import voice_enabled_router
    
    # Регистрируем роутеры
    app.include_router(tts_api, prefix="/api/tts")
    app.include_router(voice_enabled_router, prefix="/api/tts")
    app.include_router(health_router, prefix="")  # /health
    app.include_router(api_health_router, prefix="/api")  # /api/health для совместимости с bot_service
    app.include_router(admin_router, prefix="/api/admin")
    app.include_router(tts_control_router, prefix="")
    
    # Раздача статических файлов для аудио
    from fastapi.staticfiles import StaticFiles
    from tts_service.config import config
    
    # Создаем директорию audio если её нет
    config.audio_path.mkdir(parents=True, exist_ok=True)
    
    # Подключаем раздачу статических файлов
    app.mount("/audio", StaticFiles(directory=str(config.audio_path)), name="audio")
    
    return app




