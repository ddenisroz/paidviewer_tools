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
import tempfile
import torch # <-- Импортируем torch
from typing import List, Optional
from pydantic import BaseModel, Field
import time
import datetime as dt

# --- РЕШЕНИЕ ПРОБЛЕМЫ ИМПОРТОВ ---
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
# --- КОНЕЦ РЕШЕНИЯ ---

from tts_service.TTS_rus_engine.russian_tts import RussianTTS
from tts_service.database import get_db, Voice as VoiceModel, User as UserModel, SessionLocal, engine, Base as DatabaseBase
from tts_service.config import config
from tts_service.audio_converter import convert_audio_for_f5tts, validate_audio_for_f5tts

# --- Pydantic Schemas ---
class VoiceSchema(BaseModel):
    id: int
    name: str
    file_path: str
    reference_text: Optional[str] = None
    voice_type: str
    owner_id: Optional[str] = None
    is_public: bool
    is_active: bool
    created_at: Optional[dt.datetime] = None
    
    # Настройки генерации TTS
    cfg_strength: float = 2.5
    cross_fade_duration: float = 0.15
    silence_duration_ms: int = 100
    sway_sampling_coef: float = -1.0

    class Config:
        from_attributes = True

class VoiceSettingsSchema(BaseModel):
    """Схема для обновления настроек голоса - только cfg_strength настраивается пользователем"""
    cfg_strength: Optional[float] = Field(None, ge=0.1, le=10.0, description="CFG strength (0.1-10.0) - единственный настраиваемый параметр")
    # target_rms, speed, nfe_step - определяются автоматически системой

class TtsConfigSchema(BaseModel):
    cfg_strength: float = Field(ge=0.1, le=10.0, description="CFG strength (0.1-10.0)")

class TtsConfigResponse(BaseModel):
    cfg_strength: float
    target_rms: float  # Только для отображения (фиксированное значение)
    cross_fade_duration: float
    silence_duration_ms: int
    sway_sampling_coef: float

# Настройка логирования
logging.basicConfig(level=config.log_level.upper())
logger = logging.getLogger(__name__)

# --- Globals ---
tts_engine = None
transcriber = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global tts_engine, transcriber
    
    # Инициализация TTS движка
    try:
        tts_engine = RussianTTS()
        logger.info("✅ TTS engine initialized successfully.")
    except Exception as e:
        logger.error(f"❌ Critical error initializing TTS engine: {e}", exc_info=True)
        tts_engine = None

    try:
        from faster_whisper import WhisperModel
        
        # Правильная проверка доступности CUDA
        device = "cuda" if torch.cuda.is_available() else "cpu"
        # float16 является более распространенным и поддерживаемым типом для ускорения на GPU
        compute_type = "float16" if device == "cuda" else "int8"
        
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


# --- HELPERS ---

async def cleanup_cache_periodically():
    """Периодически удаляет старые .wav файлы из папок с разными временами хранения."""
    while True:
        try:
            now = time.time()
            
            # Очищаем папки с разными временами хранения
            cleanup_rules = [
                (config.test_audio_path, 300),      # Тестовые файлы: 5 минут
                (config.production_audio_path, 300), # Производственные файлы: 5 минут
                (config.temp_audio_path, 1800)      # Временные файлы: 30 минут
            ]
            
            for cache_dir, max_age_seconds in cleanup_rules:
                if cache_dir.exists():
                    for filename in os.listdir(cache_dir):
                        file_path = cache_dir / filename
                        if file_path.suffix == '.wav':
                            # Время последней модификации файла
                            file_mod_time = os.path.getmtime(file_path)
                            file_age = now - file_mod_time
                            
                            # Если файл старше максимального возраста
                            if file_age > max_age_seconds:
                                os.remove(file_path)
                                logger.info(f"🗑️ Removed old {cache_dir.name} file after {file_age:.0f}s: {filename}")
            
            # Проверка каждые 5 минут
            await asyncio.sleep(300)
        except Exception as e:
            logger.error(f"Error during cache cleanup: {e}", exc_info=True)
            # В случае ошибки ждем 2 минуты перед повторной попыткой
            await asyncio.sleep(120)

def cleanup_temp_file(file_path: Path):
    """Удаляет временный файл."""
    try:
        if file_path.exists():
            os.remove(file_path)
            logger.info(f"🗑️ Cleaned up temp file: {file_path}")
    except Exception as e:
        logger.error(f"Error cleaning up temp file {file_path}: {e}", exc_info=True)

async def cleanup_test_file_delayed(file_path: Path, delay_seconds: int):
    """Удаляет тестовый файл через указанное количество секунд."""
    try:
        await asyncio.sleep(delay_seconds)
        if file_path.exists():
            os.remove(file_path)
            logger.info(f"🗑️ Cleaned up test file after {delay_seconds}s: {file_path}")
    except Exception as e:
        logger.error(f"Error cleaning up test file {file_path} after {delay_seconds}s: {e}", exc_info=True)

async def cleanup_production_file_delayed(file_path: Path, delay_seconds: int):
    """Удаляет производственный файл через указанное количество секунд (5 минут)."""
    try:
        await asyncio.sleep(delay_seconds)
        if file_path.exists():
            os.remove(file_path)
            logger.info(f"🗑️ Cleaned up production file after {delay_seconds}s: {file_path}")
    except Exception as e:
        logger.error(f"Error cleaning up production file {file_path} after {delay_seconds}s: {e}", exc_info=True)

def transcribe_audio_file(file_path: str) -> str:
    """Транскрибирует аудиофайл и возвращает текст."""
    if not transcriber:
        raise HTTPException(status_code=500, detail="Transcriber model not available.")
    try:
        logger.info(f"🎤 Starting transcription for {file_path}...")
        segments, info = transcriber.transcribe(file_path, beam_size=5)
        
        # segments - это генератор, мы объединяем все части в один текст
        # Очищаем лишние пробелы из каждого сегмента и объединяем
        cleaned_segments = []
        for segment in segments:
            # Убираем лишние пробелы в начале и конце каждого сегмента
            cleaned_text = segment.text.strip()
            if cleaned_text:  # Добавляем только непустые сегменты
                cleaned_segments.append(cleaned_text)
        
        # Объединяем сегменты одним пробелом
        full_text = " ".join(cleaned_segments).strip()
        
        # Дополнительная очистка: убираем множественные пробелы
        import re
        full_text = re.sub(r'\s+', ' ', full_text).strip()
        
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
    # Ищем файл в разных папках по приоритету
    search_paths = [
        config.test_audio_path / f"{voice_name}.wav",
        config.production_audio_path / f"{voice_name}.wav",
        config.temp_audio_path / f"{voice_name}.wav"
    ]
    
    for file_path in search_paths:
        if file_path.exists():
            return FileResponse(file_path)
    
    raise HTTPException(status_code=404, detail="Audio file not found")

@app.delete("/api/voices/audio/{voice_name}")
async def delete_audio_file(voice_name: str):
    """Удаляет аудиофайл (для тестовых файлов)"""
    # Ищем файл в разных папках
    search_paths = [
        config.test_audio_path / f"{voice_name}.wav",
        config.production_audio_path / f"{voice_name}.wav",
        config.temp_audio_path / f"{voice_name}.wav"
    ]
    
    file_path = None
    for path in search_paths:
        if path.exists():
            file_path = path
            break
    
    if not file_path:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    try:
        os.remove(file_path)
        logger.info(f"🗑️ Manually deleted audio file: {voice_name} from {file_path}")
        return {"message": "Audio file deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting audio file {voice_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error deleting audio file: {str(e)}")

@app.post("/api/tts/synthesize")
async def synthesize_speech(
    background_tasks: BackgroundTasks,
    text: str = Form(...),
    voice_name: str = Form(...),
    user_id: str = Form(...),
    db: Session = Depends(get_db)
    # speed and pitch removed - F5-TTS uses dynamic settings based on text length
):
    if not tts_engine:
        raise HTTPException(status_code=500, detail="TTS engine is not initialized.")

    try:
        # Уникальное имя файла на основе времени и ID пользователя
        timestamp = int(time.time() * 1000)
        output_filename = f"tts_{user_id}_{timestamp}.wav"
        output_path = config.production_audio_path / output_filename
        
        # Путь к файлу голоса - ищем в глобальных и пользовательских голосах
        voice_path = config.global_voices_path / f"{voice_name}.wav"
        if not voice_path.exists():
            voice_path = config.user_voices_path / user_id / f"{voice_name}.wav"
            if not voice_path.exists():
                raise HTTPException(status_code=404, detail=f"Voice '{voice_name}' not found.")

        logger.info(f"Synthesizing speech for user {user_id} with voice {voice_name}")
        
        # Получаем настройки голоса из базы данных
        voice_settings = db.query(VoiceModel).filter(VoiceModel.name == voice_name).first()
        if not voice_settings:
            # Используем настройки по умолчанию
            cfg_strength = config.cfg_strength
        else:
            cfg_strength = voice_settings.cfg_strength
        
        # target_rms, speed, nfe_step - определяются автоматически системой
        target_rms = config.target_rms  # Всегда из конфига
        speed = None  # F5-TTS определит автоматически
        nfe_step = None  # F5-TTS определит автоматически
        
        # Синтез речи с настройками из базы данных
        # speed и nfe_step передаем как None, чтобы TTS движок определил их автоматически
        synthesized_path = await asyncio.to_thread(
            tts_engine.synthesize_speech,
            text=text,
            ref_audio_path=str(voice_path),
            ref_text="",  # Для основного синтеза не используем референсный текст
            cfg_strength=cfg_strength,
            target_rms=target_rms,
            speed=None,  # Автоматическое определение на основе длины текста
            nfe_step=None  # Автоматическое определение на основе длины текста
        )
        
        if not synthesized_path:
            raise HTTPException(status_code=500, detail="Failed to synthesize speech")
        
        # Копируем синтезированный файл в наш кеш
        if Path(synthesized_path).exists():
            shutil.copy2(synthesized_path, str(output_path))
            logger.info(f"Copied synthesized file from {synthesized_path} to {output_path}")
        else:
            logger.error(f"Synthesized file not found at {synthesized_path}")
            raise HTTPException(status_code=500, detail="Synthesized file not found")
        
        # URL для доступа к файлу
        audio_url = f"/api/voices/audio/{output_filename.replace('.wav', '')}"
        
        # Удаляем производственный файл через 5 минут после создания
        background_tasks.add_task(cleanup_production_file_delayed, output_path, 300)  # 300 секунд = 5 минут
        
        return {"audio_url": audio_url, "message": "Speech synthesized successfully."}

    except Exception as e:
        logger.error(f"Error during speech synthesis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# --- ADMIN VOICE MANAGEMENT ---

@app.get("/api/admin/voices", response_model=List[VoiceSchema])
def get_all_voices(db: Session = Depends(get_db)):
    voices = db.query(VoiceModel).all()
    
    # Обновляем created_at для старых записей, где он None
    for voice in voices:
        if voice.created_at is None:
            voice.created_at = dt.datetime.utcnow()
    
    db.commit()
    return voices

@app.post("/api/admin/voices/upload", response_model=VoiceSchema)
async def upload_voice(
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    owner_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    # Проверка на существование голоса с таким именем
    existing_voice = db.query(VoiceModel).filter(VoiceModel.name == voice_name).first()
    if existing_voice:
        raise HTTPException(status_code=400, detail=f"Voice with name '{voice_name}' already exists.")

    if owner_id:
        # Пользовательский голос
        upload_dir = config.user_voices_path / owner_id
        is_public = False
        voice_type = "user"
    else:
        # Глобальный голос
        upload_dir = config.global_voices_path
        is_public = True
        voice_type = "global"

    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{voice_name}.wav"

    try:
        # Сначала сохраняем во временный файл
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_path = temp_file.name
        temp_file.close()
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Проверяем, что файл уже в правильном формате (WAV)
        if not file.filename.lower().endswith('.wav'):
            os.unlink(temp_path)
            raise HTTPException(status_code=400, detail="Only WAV files are supported")
        
        # Просто копируем файл, так как он уже WAV
        shutil.copy2(temp_path, str(file_path))
        os.unlink(temp_path)

        # Автоматическая транскрипция
        reference_text = transcribe_audio_file(str(file_path))

        # Сохранение в БД
        new_voice = VoiceModel(
            name=voice_name,
            file_path=str(file_path),
            voice_type=voice_type,
            owner_id=owner_id,
            is_public=is_public,
            reference_text=reference_text,
            created_at=dt.datetime.utcnow()
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
    voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
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

# --- TTS CONFIGURATION MANAGEMENT ---

@app.get("/api/tts/config", response_model=TtsConfigResponse)
def get_tts_config():
    """Получить текущие настройки TTS"""
    return TtsConfigResponse(
        cfg_strength=config.cfg_strength,
        target_rms=config.target_rms,
        cross_fade_duration=config.cross_fade_duration,
        silence_duration_ms=config.silence_duration_ms,
        sway_sampling_coef=config.sway_sampling_coef
    )

@app.put("/api/tts/config", response_model=TtsConfigResponse)
def update_tts_config(settings: TtsConfigSchema):
    """Обновить настраиваемые параметры TTS (только cfg_strength)"""
    # Обновляем настройки в конфигурации
    config.cfg_strength = settings.cfg_strength
    # target_rms - фиксированный параметр, не изменяется
    
    logger.info(f"TTS config updated: cfg_strength={settings.cfg_strength}")
    
    return TtsConfigResponse(
        cfg_strength=config.cfg_strength,
        target_rms=config.target_rms,  # Фиксированное значение
        cross_fade_duration=config.cross_fade_duration,
        silence_duration_ms=config.silence_duration_ms,
        sway_sampling_coef=config.sway_sampling_coef
    )

# --- USER VOICE MANAGEMENT ---

@app.get("/api/user/voices", response_model=List[VoiceSchema])
def get_user_voices(user_id: str, db: Session = Depends(get_db)):
    # Возвращаем голоса пользователя + все публичные/глобальные голоса
    user_voices = db.query(VoiceModel).filter(VoiceModel.owner_id == user_id).all()
    public_voices = db.query(VoiceModel).filter(VoiceModel.is_public == True).all()
    
    # Объединяем списки, избегая дубликатов
    all_voices_dict = {v.id: v for v in user_voices}
    for v in public_voices:
        if v.id not in all_voices_dict:
            all_voices_dict[v.id] = v
    
    # Обновляем created_at для старых записей, где он None
    for voice in all_voices_dict.values():
        if voice.created_at is None:
            voice.created_at = dt.datetime.utcnow()
    
    db.commit()
    return list(all_voices_dict.values())


@app.post("/api/user/voices/upload", response_model=VoiceSchema)
async def upload_user_voice(
    background_tasks: BackgroundTasks,
    user_id: str,
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    db: Session = Depends(get_db)
):
    # Проверка, чтобы имя не конфликтовало с глобальными
    existing_global = db.query(VoiceModel).filter(VoiceModel.name == voice_name, VoiceModel.voice_type == 'global').first()
    if existing_global:
        raise HTTPException(status_code=400, detail=f"Voice name '{voice_name}' is reserved for a global voice.")

    # Проверка, чтобы пользователь не создал дубликат
    existing_user_voice = db.query(VoiceModel).filter(VoiceModel.name == voice_name, VoiceModel.owner_id == user_id).first()
    if existing_user_voice:
        raise HTTPException(status_code=400, detail=f"You already have a voice named '{voice_name}'.")

    upload_dir = config.user_voices_path / user_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{voice_name}.wav"
    
    try:
        # Сначала сохраняем во временный файл
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_path = temp_file.name
        temp_file.close()
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Проверяем, что файл уже в правильном формате (WAV)
        if not file.filename.lower().endswith('.wav'):
            os.unlink(temp_path)
            raise HTTPException(status_code=400, detail="Only WAV files are supported")
        
        # Просто копируем файл, так как он уже WAV
        shutil.copy2(temp_path, str(file_path))
        os.unlink(temp_path)

        # Автоматическая транскрипция
        reference_text = transcribe_audio_file(str(file_path))

        new_voice = VoiceModel(
            name=voice_name,
            file_path=str(file_path),
            voice_type="user",
            owner_id=user_id,
            is_public=False, # Пользовательские голоса по умолчанию приватные
            reference_text=reference_text,
            created_at=dt.datetime.utcnow()
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
    voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id, VoiceModel.owner_id == user_id).first()
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

# --- VOICE SETTINGS ENDPOINTS ---

@app.put("/api/admin/voices/{voice_id}/settings", response_model=VoiceSchema)
def update_voice_settings(
    voice_id: int,
    settings: VoiceSettingsSchema,
    db: Session = Depends(get_db)
):
    """Обновить настройки голоса (админ) - только cfg_strength"""
    voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Обновляем только cfg_strength (единственный настраиваемый параметр)
    if settings.cfg_strength is not None:
        voice.cfg_strength = settings.cfg_strength
        logger.info(f"Voice settings updated for {voice.name}: cfg_strength={voice.cfg_strength}")
    else:
        logger.warning(f"No cfg_strength provided for voice {voice.name}")
    
    db.commit()
    db.refresh(voice)
    
    return voice

@app.put("/api/user/voices/{voice_id}/settings", response_model=VoiceSchema)
def update_user_voice_settings(
    voice_id: int,
    user_id: str,
    settings: VoiceSettingsSchema,
    db: Session = Depends(get_db)
):
    """Обновить настройки пользовательского голоса - только cfg_strength"""
    voice = db.query(VoiceModel).filter(
        VoiceModel.id == voice_id,
        VoiceModel.owner_id == user_id
    ).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Обновляем только cfg_strength (единственный настраиваемый параметр)
    if settings.cfg_strength is not None:
        voice.cfg_strength = settings.cfg_strength
        logger.info(f"User voice settings updated for {voice.name}: cfg_strength={voice.cfg_strength}")
    else:
        logger.warning(f"No cfg_strength provided for user voice {voice.name}")
    
    db.commit()
    db.refresh(voice)
    
    return voice

@app.post("/api/voices/test")
async def test_user_voice(
    background_tasks: BackgroundTasks,
    voice_name: str = Form(...),
    user_id: str = Form(...),
    test_text: str = Form("Ну так я гетеро, че мне пидоров бояться!"),  # Добавляем возможность ввода текста
    db: Session = Depends(get_db)
    # speed and pitch removed - F5-TTS uses dynamic settings based on text length
):
    if not tts_engine:
        raise HTTPException(status_code=500, detail="TTS engine is not initialized.")

    voice = db.query(VoiceModel).filter(VoiceModel.name == voice_name).first()
    if not voice:
        raise HTTPException(status_code=404, detail=f"Voice '{voice_name}' not found.")

    voice_path = Path(voice.file_path)
    if not voice_path.exists():
        raise HTTPException(status_code=404, detail=f"Voice file for '{voice_name}' not found at {voice_path}.")

    try:
        timestamp = int(time.time() * 1000)
        output_filename = f"test_{user_id}_{timestamp}.wav"
        output_path = config.test_audio_path / output_filename
        
        # Используем переданный текст или дефолтный
        if not test_text or test_text.strip() == "":
            test_text = "Ну так я гетеро, че мне пидоров бояться!"
        
        # Логируем настройки голоса для диагностики
        logger.info(f"🎛️ Voice settings for '{voice_name}':")
        logger.info(f"  - cfg_strength: {voice.cfg_strength}")
        logger.info(f"  - cross_fade_duration: {voice.cross_fade_duration}")
        logger.info(f"  - silence_duration_ms: {voice.silence_duration_ms}")
        logger.info(f"  - sway_sampling_coef: {voice.sway_sampling_coef}")
        logger.info(f"  - target_rms, speed, nfe_step: определяются автоматически")
        
        # Синтезируем речь с настройками из базы данных
        # target_rms, speed и nfe_step передаем как None, чтобы TTS движок определил их автоматически
        synthesized_path = await asyncio.to_thread(
            tts_engine.synthesize_speech,
            text=test_text,
            ref_audio_path=str(voice_path),
            ref_text=voice.reference_text or "",
            cfg_strength=voice.cfg_strength,
            target_rms=None,  # Автоматическое определение
            speed=None,  # Автоматическое определение на основе длины текста
            nfe_step=None  # Автоматическое определение на основе длины текста
        )
        
        if not synthesized_path:
            raise HTTPException(status_code=500, detail="Failed to synthesize speech")
        
        # Копируем синтезированный файл в наш кеш
        if Path(synthesized_path).exists():
            shutil.copy2(synthesized_path, str(output_path))
            logger.info(f"Copied synthesized file from {synthesized_path} to {output_path}")
        else:
            logger.error(f"Synthesized file not found at {synthesized_path}")
            raise HTTPException(status_code=500, detail="Synthesized file not found")
        
        audio_url = f"/api/voices/audio/{output_filename.replace('.wav', '')}"
        
        # Удаляем тестовый файл через 5 минут после создания
        background_tasks.add_task(cleanup_test_file_delayed, output_path, 300)  # 300 секунд = 5 минут
        
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
        reload=False, # <-- Отключаем авто-перезагрузку для стабильной работы
        log_level=config.log_level.lower()
    )
