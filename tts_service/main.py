# -*- coding: utf-8 -*-
"""
TTS Microservice
"""
import sys
import os
from pathlib import Path
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
import uvicorn
import shutil
from typing import List, Optional
from pydantic import BaseModel
import time

# --- РЕШЕНИЕ ПРОБЛЕМЫ ИМПОРТОВ ---
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
# --- КОНЕЦ РЕШЕНИЯ ---

from tts_service.TTS_rus_engine.russian_tts import RussianTTS
from tts_service.database import get_db, Voice, User, SessionLocal, engine, Base as DatabaseBase
from tts_service.config import config

# Настройка логирования
logging.basicConfig(level=config.log_level.upper())
logger = logging.getLogger(__name__)

# Инициализация TTS движка
try:
    tts_engine = RussianTTS()
    logger.info("✅ TTS engine initialized successfully.")
except Exception as e:
    logger.error(f"❌ Critical error initializing TTS engine: {e}", exc_info=True)
    tts_engine = None

# Транскрибатор
transcriber = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global transcriber
    try:
        from faster_whisper import WhisperModel
        # Запускайте на GPU, если доступен CUDA, иначе на CPU
        device = "cuda" if "cuda" in sys.modules else "cpu"
        # Используем bfloat16 для ускорения на совместимых GPU
        compute_type = "bfloat16" if device == "cuda" else "int8"
        
        logger.info(f"🎤 Initializing WhisperModel on device='{device}' with compute_type='{compute_type}'...")
        # Модель будет загружена при первом использовании
        transcriber = WhisperModel("medium", device=device, compute_type=compute_type)
        logger.info("✅ WhisperModel initialized successfully.")

    except Exception as e:
        logger.error(f"❌ Failed to initialize WhisperModel: {e}", exc_info=True)
        transcriber = None

    logger.info("--- TTS Service starting up ---")
    DatabaseBase.metadata.create_all(bind=engine)
    
    # Запуск фоновой задачи очистки кэша
    asyncio.create_task(cleanup_cache_periodically())
    
    yield
    
    logger.info("--- TTS Service shutting down ---")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VoiceSettings(BaseModel):
    speed: float
    pitch: float
    volume: float

# --- HELPERS ---

async def cleanup_cache_periodically():
    """Периодически удаляет старые .wav файлы из кэша."""
    while True:
        try:
            now = time.time()
            for filename in os.listdir(config.audio_cache_path):
                file_path = config.audio_cache_path / filename
                if file_path.suffix == '.wav':
                    # Время последней модификации файла
                    file_mod_time = os.path.getmtime(file_path)
                    # Если файл старше 1 часа (3600 секунд)
                    if (now - file_mod_time) > 3600:
                        os.remove(file_path)
                        logger.info(f"🗑️ Removed old cache file: {filename}")
            
            # Проверка каждые 10 минут
            await asyncio.sleep(600)
        except Exception as e:
            logger.error(f"Error during cache cleanup: {e}", exc_info=True)
            # В случае ошибки ждем 5 минут перед повторной попыткой
            await asyncio.sleep(300)

def cleanup_temp_file(file_path: Path):
    """Удаляет временный файл."""
    try:
        if file_path.exists():
            os.remove(file_path)
            logger.info(f"🗑️ Cleaned up temp file: {file_path}")
    except Exception as e:
        logger.error(f"Error cleaning up temp file {file_path}: {e}", exc_info=True)

def transcribe_audio_file(file_path: str) -> str:
    """Транскрибирует аудиофайл и возвращает текст."""
    if not transcriber:
        raise HTTPException(status_code=500, detail="Transcriber model not available.")
    try:
        logger.info(f"🎤 Starting transcription for {file_path}...")
        segments, info = transcriber.transcribe(file_path, beam_size=5)
        
        # segments - это генератор, мы объединяем все части в один текст
        full_text = " ".join(segment.text for segment in segments).strip()
        
        logger.info(f"Transcription result: Language '{info.language}', Probability: {info.language_probability:.2f}")
        logger.info(f"📝 Transcription for {file_path} completed: '{full_text}'")
        return full_text
    except Exception as e:
        logger.error(f"Error during transcription for {file_path}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")


# --- API ENDPOINTS ---

@app.get("/health")
async def health_check():
    return {"status": "healthy", "tts_engine_loaded": tts_engine is not None}

@app.get("/api/voices/audio/{voice_name}")
async def get_audio_file(voice_name: str):
    file_path = config.audio_cache_path / f"{voice_name}.wav"
    if not file_path.exists():
        # Попробуем найти в основной папке, если в кэше нет
        file_path = config.voices_path / f"{voice_name}.wav"
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path)

@app.post("/api/tts/synthesize")
async def synthesize_speech(
    background_tasks: BackgroundTasks,
    text: str = Form(...),
    voice_name: str = Form(...),
    user_id: str = Form(...),
    speed: float = Form(1.0),
    pitch: float = Form(1.0),
    volume: float = Form(1.0)
):
    if not tts_engine:
        raise HTTPException(status_code=500, detail="TTS engine is not initialized.")

    try:
        # Уникальное имя файла на основе времени и ID пользователя
        timestamp = int(time.time() * 1000)
        output_filename = f"tts_{user_id}_{timestamp}.wav"
        output_path = config.audio_cache_path / output_filename
        
        # Путь к файлу голоса
        voice_path = config.voices_path / f"{voice_name}.wav"
        if not voice_path.exists():
             voice_path = config.user_voices_path / user_id / f"{voice_name}.wav"
             if not voice_path.exists():
                raise HTTPException(status_code=404, detail=f"Voice '{voice_name}' not found.")

        logger.info(f"Synthesizing speech for user {user_id} with voice {voice_name}")
        
        # Синтез речи
        await asyncio.to_thread(
            tts_engine.synthesize,
            text=text,
            output_path=str(output_path),
            speaker_wav=str(voice_path),
            speed=speed,
            pitch=pitch,
            volume=volume
        )
        
        # URL для доступа к файлу
        audio_url = f"/api/voices/audio/{output_filename.replace('.wav', '')}"
        
        return {"audio_url": audio_url, "message": "Speech synthesized successfully."}

    except Exception as e:
        logger.error(f"Error during speech synthesis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# --- ADMIN VOICE MANAGEMENT ---

@app.get("/api/admin/voices", response_model=List[Voice])
def get_all_voices(db: Session = Depends(get_db)):
    voices = db.query(Voice).all()
    return voices

@app.post("/api/admin/voices/upload")
async def upload_voice(
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    owner_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    # Проверка на существование голоса с таким именем
    existing_voice = db.query(Voice).filter(Voice.name == voice_name).first()
    if existing_voice:
        raise HTTPException(status_code=400, detail=f"Voice with name '{voice_name}' already exists.")

    if owner_id:
        # Пользовательский голос
        upload_dir = config.user_voices_path / owner_id
        is_public = False
        voice_type = "user"
    else:
        # Глобальный голос
        upload_dir = config.voices_path
        is_public = True
        voice_type = "global"

    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{voice_name}.wav"

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Автоматическая транскрипция
        reference_text = transcribe_audio_file(str(file_path))

        # Сохранение в БД
        new_voice = Voice(
            name=voice_name,
            file_path=str(file_path),
            voice_type=voice_type,
            owner_id=owner_id,
            is_public=is_public,
            reference_text=reference_text
        )
        db.add(new_voice)
        db.commit()
        db.refresh(new_voice)

        return new_voice
    except Exception as e:
        # Если что-то пошло не так, удаляем загруженный файл
        if file_path.exists():
            os.remove(file_path)
        logger.error(f"Error uploading voice '{voice_name}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/admin/voices/{voice_id}")
def delete_voice(voice_id: int, db: Session = Depends(get_db)):
    voice = db.query(Voice).filter(Voice.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")

    try:
        file_path = Path(voice.file_path)
        if file_path.exists():
            os.remove(file_path)
        
        db.delete(voice)
        db.commit()
        return {"message": "Voice deleted successfully."}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting voice ID {voice_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/voices/{voice_id}/settings", response_model=Voice)
def update_voice_settings_admin(voice_id: int, settings: VoiceSettings, db: Session = Depends(get_db)):
    voice = db.query(Voice).filter(Voice.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    voice.speed = settings.speed
    voice.pitch = settings.pitch
    voice.volume = settings.volume
    db.commit()
    db.refresh(voice)
    return voice

# --- USER VOICE MANAGEMENT ---

@app.get("/api/user/voices", response_model=List[Voice])
def get_user_voices(user_id: str, db: Session = Depends(get_db)):
    # Возвращаем голоса пользователя + все публичные/глобальные голоса
    user_voices = db.query(Voice).filter(Voice.owner_id == user_id).all()
    public_voices = db.query(Voice).filter(Voice.is_public == True).all()
    
    # Объединяем списки, избегая дубликатов
    all_voices_dict = {v.id: v for v in user_voices}
    for v in public_voices:
        if v.id not in all_voices_dict:
            all_voices_dict[v.id] = v
            
    return list(all_voices_dict.values())


@app.post("/api/user/voices/upload")
async def upload_user_voice(
    background_tasks: BackgroundTasks,
    user_id: str,
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    db: Session = Depends(get_db)
):
    # Проверка, чтобы имя не конфликтовало с глобальными
    existing_global = db.query(Voice).filter(Voice.name == voice_name, Voice.voice_type == 'global').first()
    if existing_global:
        raise HTTPException(status_code=400, detail=f"Voice name '{voice_name}' is reserved for a global voice.")

    # Проверка, чтобы пользователь не создал дубликат
    existing_user_voice = db.query(Voice).filter(Voice.name == voice_name, Voice.owner_id == user_id).first()
    if existing_user_voice:
        raise HTTPException(status_code=400, detail=f"You already have a voice named '{voice_name}'.")

    upload_dir = config.user_voices_path / user_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{voice_name}.wav"
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Автоматическая транскрипция
        reference_text = transcribe_audio_file(str(file_path))

        new_voice = Voice(
            name=voice_name,
            file_path=str(file_path),
            voice_type="user",
            owner_id=user_id,
            is_public=False, # Пользовательские голоса по умолчанию приватные
            reference_text=reference_text
        )
        db.add(new_voice)
        db.commit()
        db.refresh(new_voice)

        return new_voice
    except Exception as e:
        if file_path.exists():
            os.remove(file_path)
        logger.error(f"Error uploading voice for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/user/voices/{voice_id}")
def delete_user_voice(voice_id: int, user_id: str, db: Session = Depends(get_db)):
    voice = db.query(Voice).filter(Voice.id == voice_id, Voice.owner_id == user_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found or you don't have permission to delete it.")

    try:
        file_path = Path(voice.file_path)
        if file_path.exists():
            os.remove(file_path)

        db.delete(voice)
        db.commit()
        return {"message": "Voice deleted successfully."}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting voice ID {voice_id} for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/user/voices/{voice_id}/settings", response_model=Voice)
def update_user_voice_settings(voice_id: int, user_id: str, settings: VoiceSettings, db: Session = Depends(get_db)):
    voice = db.query(Voice).filter(Voice.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found.")
    
    # Пользователь может редактировать только свои голоса или публичные
    if voice.owner_id != user_id and not voice.is_public:
        raise HTTPException(status_code=403, detail="You do not have permission to edit this voice.")

    # TODO: В будущем, настройки для публичных голосов должны сохраняться для каждого пользователя отдельно
    # Сейчас они меняются глобально, что не идеально.
    voice.speed = settings.speed
    voice.pitch = settings.pitch
    voice.volume = settings.volume
    db.commit()
    db.refresh(voice)
    return voice

@app.post("/api/voices/test")
async def test_user_voice(
    background_tasks: BackgroundTasks,
    voice_name: str = Form(...),
    user_id: str = Form(...),
    speed: float = Form(1.0),
    pitch: float = Form(1.0),
    volume: float = Form(1.0),
    db: Session = Depends(get_db)
):
    if not tts_engine:
        raise HTTPException(status_code=500, detail="TTS engine is not initialized.")

    voice = db.query(Voice).filter(Voice.name == voice_name).first()
    if not voice:
        raise HTTPException(status_code=404, detail=f"Voice '{voice_name}' not found.")

    voice_path = Path(voice.file_path)
    if not voice_path.exists():
        raise HTTPException(status_code=404, detail=f"Voice file for '{voice_name}' not found at {voice_path}.")

    try:
        timestamp = int(time.time() * 1000)
        output_filename = f"test_{user_id}_{timestamp}.wav"
        output_path = config.audio_cache_path / output_filename
        
        test_text = "Ну так я гетеро, че мне пидоров бояться!"
        
        await asyncio.to_thread(
            tts_engine.synthesize,
            text=test_text,
            output_path=str(output_path),
            speaker_wav=str(voice_path),
            speed=speed,
            pitch=pitch,
            volume=volume
        )
        
        audio_url = f"/api/voices/audio/{output_filename.replace('.wav', '')}"
        
        # Удаляем тестовый файл через 30 секунд
        background_tasks.add_task(cleanup_temp_file, output_path)
        
        return {"audio_url": audio_url, "message": "Test speech synthesized."}
    except Exception as e:
        logger.error(f"Error during voice test for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    # Запускаем uvicorn с правильным путем для --reload-dir
    # Используем str(config.base_dir) для корректного пути
    uvicorn.run(
        "tts_service.main:app",
        host=config.host,
        port=config.port,
        reload=config.debug,
        reload_dirs=[str(config.base_dir)],
        log_level=config.log_level.lower()
    )
