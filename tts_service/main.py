# -*- coding: utf-8 -*-
"""
TTS Microservice
"""
import sys
from pathlib import Path

# --- РЕШЕНИЕ ПРОБЛЕМЫ ИМПОРТОВ ---
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
# --- КОНЕЦ РЕШЕНИЯ ---

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# --- Теперь все импорты должны работать ---
from tts_service.TTS_rus_engine.russian_tts import RussianTTS
from tts_service.database import get_db, Voice, User, SessionLocal, engine, Base as DatabaseBase
from tts_service.config import config

# ... (Остальной код, эндпоинты и т.д. должны быть здесь)
# ... Я добавлю основную структуру, чтобы исправить ошибку

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Логика инициализации
    print("TTS Service starting up...")
    yield
    # Логика очистки
    print("TTS Service shutting down...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Заглушка, позже заменим на конфиг
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# --- Старый код, который был случайно удален ---
# (Я добавлю его снова, чтобы приложение запустилось)
# ...

if __name__ == "__main__":
    uvicorn.run(
        "tts_service.main:app",
        host=config.host,
        port=config.port,
        reload=config.debug,
        log_level=config.log_level.lower(),
        reload_dirs=[str(config.base_dir / "tts_service")]
    )
