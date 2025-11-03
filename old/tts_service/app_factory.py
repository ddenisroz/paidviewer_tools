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
        logger.info("🚀 TTS Service starting up...")
        
        try:
            # Инициализация базы данных
            from tts_service.database import init_db
            init_db()
            logger.info("✅ Database initialized")
            
            # Инициализация TTS движка
            from tts_service.tts_engine import tts_engine_manager
            await tts_engine_manager.initialize()
            logger.info("✅ TTS Engine initialized")
            
            # Инициализация файлового менеджера (инициализация происходит в __init__)
            from tts_service.file_manager import file_manager
            # Директории уже созданы в конструкторе FileManager
            logger.info("✅ File Manager initialized")
            
            # Запуск фоновых задач
            from tts_service.background_tasks import background_task_manager
            await background_task_manager.start()
            logger.info("✅ Background tasks started")
            
            # Инициализация мониторинга
            from monitoring import tts_monitor
            tts_monitor.start_monitoring(interval=30)
            logger.info("✅ Monitoring started")
            
            logger.info("🎉 TTS Service startup complete!")
            
        except Exception as e:
            logger.error(f"❌ Error during startup: {e}")
            raise
        
        yield
        
        # Shutdown
        logger.info("🛑 TTS Service shutting down...")
        
        try:
            # Остановка фоновых задач
            await background_task_manager.stop()
            logger.info("✅ Background tasks stopped")
            
            # Остановка TTS движка
            await tts_engine_manager.shutdown()
            logger.info("✅ TTS Engine stopped")
            
            # Остановка мониторинга
            tts_monitor.stop_monitoring()
            logger.info("✅ Monitoring stopped")
            
            logger.info("🎉 TTS Service shutdown complete!")
            
        except Exception as e:
            logger.error(f"❌ Error during shutdown: {e}")

    # Создаем приложение
    app = FastAPI(
        title="TTS Service",
        description="Text-to-Speech Service with AI Voice Synthesis",
        version="1.0.0",
        lifespan=lifespan
    )

    # Настройка CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # В production указать конкретные домены
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Регистрируем роутеры
    from tts_service.api_endpoints import tts_api
    from tts_service.health_api import health_router
    from tts_service.admin_api import admin_router
    from tts_service.tts_control_api import router as tts_control_router
    
    # Регистрируем роутеры
    app.include_router(tts_api, prefix="/api/tts")
    app.include_router(health_router, prefix="")
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
