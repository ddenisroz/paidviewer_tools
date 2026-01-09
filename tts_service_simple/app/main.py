import logging
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import config
from app.services.engine import engine
from app.services.monitor import monitor_system
from app.api.routes import router

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(config.logs_dir / 'tts_simple.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('tts_simple')

app = FastAPI(
    title="TTS F5 Simple",
    description="Упрощенный микросервис для локального TTS F5",
    version=config.get('version', '1.0.0')
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for now, or use config
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске"""
    logger.info("[START] Запуск TTS F5 Simple (Modular)...")
    
    # Инициализируем TTS движок
    await engine.initialize()
    
    # Запускаем фоновые задачи
    asyncio.create_task(monitor_system())
    
    logger.info("[OK] TTS F5 Simple готов к работе!")
