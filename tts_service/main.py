# tts_service/main.py
import sys
import os
from pathlib import Path
import logging

# Настройка для работы с Hugging Face Hub
# Отключаем прокси, если они мешают
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)

# Настраиваем кеш для Hugging Face
cache_dir = Path("f5_tts_cache").absolute()
os.environ['HF_HOME'] = str(cache_dir)
os.environ['HUGGINGFACE_HUB_CACHE'] = str(cache_dir)
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import uvicorn

# --- Logging Configuration ---
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
# logging_config удален - используем стандартный logging
import logging

from tts_service.database import get_db, init_db, Voice as VoiceModel
from tts_service.models import *
from tts_service.tts_engine import tts_engine_manager
from tts_service.file_manager import file_manager
from tts_service.api_endpoints import tts_api
from tts_service.background_tasks import background_task_manager

# --- Logging and Monitoring Setup ---
log_level = os.getenv("TTS_LOG_LEVEL", "INFO")
logger = logging.getLogger(__name__)

# --- Monitoring API ---
from monitoring import tts_monitor

# Запускаем мониторинг
tts_monitor.start_monitoring(interval=60)  # Каждую минуту
logger.info("System monitoring started for tts_service")

# --- Backup System ---
from backup_manager import tts_backup_manager
from logging_config import tts_logging_config

# Запускаем систему бэкапов
tts_backup_manager.schedule_backups()
tts_backup_manager.start_scheduler()
logger.info("=== TTS SERVICE STARTED WITH ENHANCED LOGGING ===")

# --- Lifespan Events ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("TTS service starting on port 8001")
    
    # Инициализация базы данных
    init_db()
    
    # Инициализация TTS движка
    await tts_engine_manager.initialize()
    
    # Запуск фоновых задач
    await background_task_manager.start()
    
    yield
    
    # Shutdown
    logger.info("TTS service stopping")
    
    # Остановка фоновых задач
    await background_task_manager.stop()
    
    # Завершение работы TTS движка
    await tts_engine_manager.shutdown()

# --- FastAPI App ---
app = FastAPI(
    title="TTS Service API",
    description="API для синтеза речи и управления голосами",
    version="1.0.0",
    lifespan=lifespan
)

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Health Check ---
@app.get("/health")
async def health_check():
    return await tts_api.health_check()

# --- Voice Management ---
@app.get("/api/voices", response_model=List[VoiceSchema])
def get_all_voices(db: Session = Depends(get_db)):
    return tts_api.get_all_voices(db)

@app.post("/api/voices/upload", response_model=VoiceUploadResponse)
async def upload_voice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    voice_type: str = Form("user"),
    is_public: bool = Form(False),
    owner_id: str = Form(None),
    db: Session = Depends(get_db)
):
    return await tts_api.upload_voice(
        background_tasks, file, voice_name, voice_type, is_public, owner_id, db
    )

@app.delete("/api/voices/{voice_id}")
def delete_voice(voice_id: int, db: Session = Depends(get_db)):
    return tts_api.delete_voice(voice_id, db)

# --- TTS Configuration ---
@app.get("/api/tts/config", response_model=TtsConfigResponse)
def get_tts_config():
    return tts_api.get_tts_config()

@app.post("/api/tts/config", response_model=TtsConfigResponse)
def update_tts_config(settings: TtsConfigSchema):
    return tts_api.update_tts_config(settings)

# --- User Voices ---
@app.get("/api/user/voices/{user_id}", response_model=List[VoiceSchema])
def get_user_voices(user_id: int, db: Session = Depends(get_db)):
    return tts_api.get_user_voices(user_id, db)

@app.get("/api/voices/global", response_model=List[VoiceSchema])
def get_global_voices(db: Session = Depends(get_db)):
    return tts_api.get_global_voices(db)

# --- Admin Voices ---
@app.get("/api/admin/voices", response_model=List[VoiceSchema])
def get_admin_voices(db: Session = Depends(get_db)):
    """Получить все голоса для админки"""
    return tts_api.get_all_voices(db)

@app.post("/api/admin/voices/upload", response_model=VoiceUploadResponse)
async def upload_admin_voice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    voice_type: str = Form("global"),
    is_public: bool = Form(True),
    db: Session = Depends(get_db)
):
    """Загрузить голос через админку"""
    return await tts_api.upload_voice(
        background_tasks, file, voice_name, voice_type, is_public, None, db
    )

@app.delete("/api/admin/voices/{voice_id}")
def delete_admin_voice(voice_id: int, db: Session = Depends(get_db)):
    """Удалить голос из админки"""
    return tts_api.delete_voice(voice_id, db)

# --- Voice Upload for Users ---
@app.post("/api/user/voices/upload", response_model=VoiceUploadResponse)
async def upload_user_voice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    user_id: int = Form(...),
    db: Session = Depends(get_db)
):
    return await tts_api.upload_voice(
        background_tasks, file, voice_name, "user", False, user_id, db
    )

@app.delete("/api/user/voices/{voice_id}")
def delete_user_voice(voice_id: int, user_id: int, db: Session = Depends(get_db)):
    voice = db.query(VoiceModel).filter(
        VoiceModel.id == voice_id, 
        VoiceModel.owner_id == user_id
    ).first()
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found or access denied")
    
    # 🔒 БЕЗОПАСНОСТЬ: Запрет удаления глобальных голосов
    if voice.voice_type != 'user':
        logger.warning(f"User {user_id} attempted to delete global voice {voice_id}")
        raise HTTPException(status_code=403, detail="Cannot delete global voice")
    
    # Удаляем файл
    file_manager.delete_voice_file(voice.name)
    
    # Удаляем из базы данных
    db.delete(voice)
    db.commit()

    logger.info(f"User {user_id} deleted voice {voice_id}")
    return {"message": f"Voice {voice.name} deleted successfully"}

# --- Voice Settings ---
@app.put("/api/voices/{voice_id}/settings")
def update_voice_settings(
    voice_id: int,
    settings: VoiceSettingsSchema,
    db: Session = Depends(get_db)
):
    voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Обновляем настройки
    for field, value in settings.dict(exclude_unset=True).items():
        setattr(voice, field, value)
    
    db.commit()
    return {"message": "Voice settings updated successfully"}
    
@app.put("/api/user/voices/{voice_id}/settings")
def update_user_voice_settings(
    voice_id: int,
    user_id: int,
    settings: VoiceSettingsSchema,
    db: Session = Depends(get_db)
):
    voice = db.query(VoiceModel).filter(
        VoiceModel.id == voice_id,
        VoiceModel.owner_id == user_id
    ).first()
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found or access denied")
    
    # 🔒 БЕЗОПАСНОСТЬ: Запрет изменения глобальных голосов
    if voice.voice_type != 'user':
        logger.warning(f"User {user_id} attempted to modify global voice {voice_id}")
        raise HTTPException(status_code=403, detail="Cannot modify global voice")
    
    # Обновляем настройки
    for field, value in settings.dict(exclude_unset=True).items():
        setattr(voice, field, value)
    
    db.commit()
    logger.info(f"User {user_id} updated settings for voice {voice_id}")
    return {"message": "Voice settings updated successfully"}

# --- Transcription ---
@app.post("/api/voices/{voice_id}/transcribe", response_model=TranscriptionResponse)
def transcribe_voice_audio(voice_id: int, db: Session = Depends(get_db)):
    voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    if not tts_engine_manager.transcriber:
        raise HTTPException(status_code=503, detail="Transcriber not available")
    
    try:
        # Проверяем существование файла
        from pathlib import Path
        file_path = Path(voice.file_path)
        if not file_path.exists():
            logger.error(f"Voice file not found: {voice.file_path}")
            return TranscriptionResponse(
                success=False,
                text=None,
                message=f"Voice file not found: {voice.file_path}"
            )
        
        text = tts_engine_manager.transcribe(voice.file_path)
        voice.reference_text = text
        db.commit()
        
        return TranscriptionResponse(
            success=True,
            text=text,
            message="Transcription completed successfully"
        )
    except Exception as e:
        logger.error(f"Error transcribing voice {voice_id}: {e}")
        return TranscriptionResponse(
            success=False,
            text=None,
            message=f"Transcription failed: {str(e)}"
        )

@app.post("/api/user/voices/{voice_id}/transcribe", response_model=TranscriptionResponse)
def transcribe_user_voice_audio(voice_id: int, user_id: int, db: Session = Depends(get_db)):
    voice = db.query(VoiceModel).filter(
        VoiceModel.id == voice_id,
        VoiceModel.owner_id == user_id
    ).first()
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found or access denied")
    
    # 🔒 БЕЗОПАСНОСТЬ: Запрет транскрипции глобальных голосов
    if voice.voice_type != 'user':
        logger.warning(f"User {user_id} attempted to transcribe global voice {voice_id}")
        raise HTTPException(status_code=403, detail="Cannot transcribe global voice")
    
    if not tts_engine_manager.transcriber:
        raise HTTPException(status_code=503, detail="Transcriber not available")
    
    try:
        # Проверяем существование файла
        from pathlib import Path
        file_path = Path(voice.file_path)
        if not file_path.exists():
            logger.error(f"Voice file not found: {voice.file_path}")
            return TranscriptionResponse(
                success=False,
                text=None,
                message=f"Voice file not found: {voice.file_path}"
            )
        
        text = tts_engine_manager.transcribe(voice.file_path)
        voice.reference_text = text
        db.commit()
        
        logger.info(f"User {user_id} transcribed voice {voice_id}")
        return TranscriptionResponse(
            success=True,
            text=text,
            message="Transcription completed successfully"
        )
    except Exception as e:
        logger.error(f"Error transcribing voice {voice_id}: {e}")
        return TranscriptionResponse(
            success=False,
            text=None,
            message=f"Transcription failed: {str(e)}"
        )

# --- Voice Renaming ---
@app.put("/api/voices/{voice_id}/rename")
def rename_voice(voice_id: int, new_name: str = Form(...), db: Session = Depends(get_db)):
    voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Проверяем, что новое имя не занято
    existing_voice = db.query(VoiceModel).filter(VoiceModel.name == new_name).first()
    if existing_voice and existing_voice.id != voice_id:
        raise HTTPException(status_code=400, detail="Voice with this name already exists")
    
    old_name = voice.name
    old_file_path = voice.file_path
    
    try:
        # Переименовываем физический файл
        import os
        from pathlib import Path
        
        old_path = Path(old_file_path)
        logger.info(f"Attempting to rename voice file: {old_path}")
        
        if old_path.exists():
            # Определяем новое имя файла с сохранением расширения
            file_extension = old_path.suffix
            new_file_name = f"{new_name}{file_extension}"
            new_path = old_path.parent / new_file_name
            
            # Переименовываем файл
            old_path.rename(new_path)
            
            # Обновляем путь в базе данных
            voice.file_path = str(new_path)
            logger.info(f"Successfully renamed voice file from {old_path} to {new_path}")
        else:
            logger.error(f"Voice file not found: {old_path}")
            # Попробуем найти файл по имени голоса
            from tts_service.config import config
            search_paths = [
                config.global_voices_path / f"{old_name}.wav",
                config.global_voices_path / f"{old_name}.mp3",
                config.user_voices_path / f"{old_name}.wav",
                config.user_voices_path / f"{old_name}.mp3"
            ]
            
            found_file = None
            for search_path in search_paths:
                if search_path.exists():
                    found_file = search_path
                    break
            
            if found_file:
                # Определяем новое имя файла с сохранением расширения
                file_extension = found_file.suffix
                new_file_name = f"{new_name}{file_extension}"
                new_path = found_file.parent / new_file_name
                
                # Переименовываем найденный файл
                found_file.rename(new_path)
                
                # Обновляем путь в базе данных
                voice.file_path = str(new_path)
                logger.info(f"Found and renamed voice file from {found_file} to {new_path}")
            else:
                logger.error(f"Could not find voice file for {old_name} in any location")
                raise HTTPException(status_code=404, detail=f"Voice file not found for {old_name}")
        
        # Обновляем имя в базе данных
        voice.name = new_name
        db.commit()
        
        return {"message": f"Voice renamed from {old_name} to {new_name}"}
    except Exception as e:
        logger.error(f"Error renaming voice file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to rename voice file: {str(e)}")

@app.put("/api/user/voices/{voice_id}/rename")
def rename_user_voice(voice_id: int, user_id: int, new_name: str = Form(...), db: Session = Depends(get_db)):
    voice = db.query(VoiceModel).filter(
        VoiceModel.id == voice_id,
        VoiceModel.owner_id == user_id
    ).first()
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found or access denied")
    
    # 🔒 БЕЗОПАСНОСТЬ: Запрет переименования глобальных голосов
    if voice.voice_type != 'user':
        logger.warning(f"User {user_id} attempted to rename global voice {voice_id}")
        raise HTTPException(status_code=403, detail="Cannot rename global voice")
    
    # 🔒 БЕЗОПАСНОСТЬ: Валидация имени (санитизация)
    import re
    new_name = new_name.strip()
    if not new_name or len(new_name) > 100:
        raise HTTPException(status_code=400, detail="Invalid voice name length")
    
    # Разрешаем только буквы, цифры, пробелы, дефисы и подчеркивания
    if not re.match(r'^[\w\s\-]+$', new_name, re.UNICODE):
        raise HTTPException(status_code=400, detail="Voice name contains invalid characters")
    
    # Проверяем, что новое имя не занято
    existing_voice = db.query(VoiceModel).filter(VoiceModel.name == new_name).first()
    if existing_voice and existing_voice.id != voice_id:
        raise HTTPException(status_code=400, detail="Voice with this name already exists")
    
    old_name = voice.name
    old_file_path = voice.file_path
    
    try:
        # Переименовываем физический файл
        import os
        from pathlib import Path
        
        old_path = Path(old_file_path)
        logger.info(f"Attempting to rename voice file: {old_path}")
        
        if old_path.exists():
            # Определяем новое имя файла с сохранением расширения
            file_extension = old_path.suffix
            new_file_name = f"{new_name}{file_extension}"
            new_path = old_path.parent / new_file_name
            
            # Переименовываем файл
            old_path.rename(new_path)
            
            # Обновляем путь в базе данных
            voice.file_path = str(new_path)
            logger.info(f"Successfully renamed user voice file from {old_path} to {new_path}")
        else:
            logger.error(f"User voice file not found: {old_path}")
            # Попробуем найти файл по имени голоса
            from tts_service.config import config
            search_paths = [
                config.user_voices_path / str(user_id) / f"{old_name}.wav",
                config.user_voices_path / str(user_id) / f"{old_name}.mp3",
                config.global_voices_path / f"{old_name}.wav",
                config.global_voices_path / f"{old_name}.mp3"
            ]
            
            found_file = None
            for search_path in search_paths:
                if search_path.exists():
                    found_file = search_path
                    break
            
            if found_file:
                # Определяем новое имя файла с сохранением расширения
                file_extension = found_file.suffix
                new_file_name = f"{new_name}{file_extension}"
                new_path = found_file.parent / new_file_name
                
                # Переименовываем найденный файл
                found_file.rename(new_path)
                
                # Обновляем путь в базе данных
                voice.file_path = str(new_path)
                logger.info(f"Found and renamed user voice file from {found_file} to {new_path}")
            else:
                logger.error(f"Could not find voice file for {old_name} in any location")
                raise HTTPException(status_code=404, detail=f"Voice file not found for {old_name}")
        
        # Обновляем имя в базе данных
        voice.name = new_name
        db.commit()
        
        return {"message": f"User voice renamed from {old_name} to {new_name}"}
    except Exception as e:
        logger.error(f"Error renaming user voice file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to rename user voice file: {str(e)}")

# --- TTS Synthesis ---
@app.post("/api/tts/synthesize", response_model=SynthesisResponse)
async def synthesize_speech(
    background_tasks: BackgroundTasks,
    request: SynthesisRequest,
    db: Session = Depends(get_db)
):
    return await tts_api.synthesize_speech(background_tasks, request, db)

@app.post("/api/tts/synthesize-channel")
async def synthesize_speech_for_channel(
    background_tasks: BackgroundTasks,
    channel_name: str = Form(...),
    text: str = Form(...),
    author: str = Form(...),
    volume_level: float = Form(50.0),
    db: Session = Depends(get_db)
):
    """Синтез речи для канала с автоматическим выбором голоса и настраиваемой громкостью"""
    try:
        import random
        
        # Получаем все доступные голоса
        voices = db.query(VoiceModel).filter(VoiceModel.is_active == True).all()
        if not voices:
            raise HTTPException(status_code=404, detail="No voices available")
        
        # Логика выбора голоса:
        # 1. Ищем персональный голос пользователя
        # 2. Если нет - случайный из глобальных голосов канала
        selected_voice = None
        
        # 1. Проверяем персональный голос пользователя
        personal_voice = db.query(VoiceModel).filter(
            VoiceModel.is_active == True,
            VoiceModel.voice_type == 'user',
            VoiceModel.owner_id.isnot(None)  # Есть владелец
        ).first()
        
        if personal_voice:
            selected_voice = personal_voice
            logger.info(f"Using personal voice '{personal_voice.name}' for user '{author}'")
        else:
            # 2. Случайный голос из глобальных голосов канала
            global_voices = [v for v in voices if v.voice_type == 'global']
            if global_voices:
                selected_voice = random.choice(global_voices)
                logger.info(f"Using random global voice '{selected_voice.name}' for channel '{channel_name}'")
            else:
                # Fallback: любой доступный голос
                selected_voice = random.choice(voices)
                logger.info(f"Using fallback voice '{selected_voice.name}' (no global voices available)")
        
        # Создаем запрос на синтез с громкостью
        request = SynthesisRequest(
            text=text,
            voice_name=selected_voice.name,
            user_id=None,  # Для канальных запросов user_id может быть None
            volume_level=volume_level
        )
        
        logger.info(f"Using selected voice '{selected_voice.name}' for channel '{channel_name}' from user '{author}' with volume {volume_level}%")
        
        result = await tts_api.synthesize_speech(background_tasks, request, db)
        
        # Добавляем информацию о выбранном голосе в ответ
        if hasattr(result, '__dict__'):
            result.selected_voice = selected_voice.name
        else:
            # Если result это dict
            result['selected_voice'] = selected_voice.name
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error synthesizing speech for channel: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Voice Testing ---
@app.post("/api/voices/{voice_id}/test", response_model=SynthesisResponse)
async def test_voice(
    background_tasks: BackgroundTasks,
    voice_id: int,
    text: str = Form(...),
    user_id: int = Form(None),
    db: Session = Depends(get_db)
):
    voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Проверяем права доступа
    if voice.owner_id and voice.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    request = SynthesisRequest(
        text=text,
        voice_name=voice.name,
        user_id=user_id
    )
    
    return await tts_api.synthesize_speech(background_tasks, request, db)

@app.post("/api/voices/test", response_model=SynthesisResponse)
async def test_voice_by_name(
    background_tasks: BackgroundTasks,
    voice_name: str = Form(...),
    test_text: str = Form(...),
    user_id: Optional[int] = Form(None),
    cfg_strength: Optional[float] = Form(None),
    speed_preset: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Тестирование голоса по имени (для совместимости с frontend)"""
    # ДИАГНОСТИКА
    logger.info(f"=" * 80)
    logger.info(f"🎬 TTS TEST ENDPOINT CALLED")
    logger.info(f"  voice_name: {voice_name}")
    logger.info(f"  user_id: {user_id} (type: {type(user_id)})")
    logger.info(f"  cfg_strength: {cfg_strength} (type: {type(cfg_strength)})")
    logger.info(f"  speed_preset: {speed_preset} (type: {type(speed_preset)})")
    logger.info(f"=" * 80)
    voice = db.query(VoiceModel).filter(VoiceModel.name == voice_name).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Проверяем права доступа
    if voice.owner_id and voice.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    request = SynthesisRequest(
        text=test_text,
        voice_name=voice.name,
        user_id=user_id,
        cfg_strength=cfg_strength,
        speed_preset=speed_preset
    )
    
    return await tts_api.synthesize_speech(background_tasks, request, db)

@app.post("/api/voices/{voice_id}/transcribe")
async def transcribe_voice(
    voice_id: int,
    db: Session = Depends(get_db)
):
    """Транскрипция голоса по ID"""
    voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    try:
        # Выполняем транскрипцию
        transcription = await tts_engine_manager.transcribe(voice.file_path)
        
        # Обновляем запись в базе данных
        voice.transcription = transcription
        db.commit()
        
        return {"success": True, "transcription": transcription}
    except Exception as e:
        logger.error(f"Error transcribing voice {voice_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/voices/{voice_id}/retranscribe")
async def retranscribe_voice(
    voice_id: int,
    reference_text: str = Form(...),
    db: Session = Depends(get_db)
):
    """Перетранскрибация голоса по ID с новым референсным текстом"""
    voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    try:
        # Обновляем референсный текст
        voice.reference_text = reference_text
        db.commit()
        
        return {"success": True, "reference_text": reference_text}
    except Exception as e:
        logger.error(f"Error retranscribing voice {voice_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/user/voices/{voice_id}/retranscribe")
async def retranscribe_user_voice(
    voice_id: int,
    user_id: int,
    reference_text: str = Form(...),
    db: Session = Depends(get_db)
):
    """Перетранскрибация пользовательского голоса с новым референсным текстом"""
    voice = db.query(VoiceModel).filter(
        VoiceModel.id == voice_id,
        VoiceModel.owner_id == user_id
    ).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found or access denied")
    
    # 🔒 БЕЗОПАСНОСТЬ: Запрет перетранскрибации глобальных голосов
    if voice.voice_type != 'user':
        logger.warning(f"User {user_id} attempted to retranscribe global voice {voice_id}")
        raise HTTPException(status_code=403, detail="Cannot retranscribe global voice")
    
    # 🔒 БЕЗОПАСНОСТЬ: Валидация референсного текста
    reference_text = reference_text.strip()
    if not reference_text:
        raise HTTPException(status_code=400, detail="Reference text cannot be empty")
    
    if len(reference_text) > 5000:
        raise HTTPException(status_code=400, detail="Reference text is too long (max 5000 characters)")
    
    try:
        # Обновляем референсный текст
        voice.reference_text = reference_text
        db.commit()
        
        logger.info(f"User {user_id} retranscribed voice {voice_id}")
        return {"success": True, "reference_text": reference_text}
    except Exception as e:
        logger.error(f"Error retranscribing user voice {voice_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/voices/{voice_id}/reference-text")
async def update_reference_text(
    voice_id: int,
    text: str = Form(...),
    db: Session = Depends(get_db)
):
    """Обновление референсного текста голоса"""
    voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    try:
        # Обновляем референсный текст
        voice.reference_text = text
        db.commit()
        
        return {"success": True, "message": "Reference text updated"}
    except Exception as e:
        logger.error(f"Error updating reference text for voice {voice_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- File Operations ---
@app.get("/api/voices/{voice_name}/audio")
async def get_audio_file(voice_name: str):
    file_path = await tts_api.get_audio_file(voice_name)
    return FileResponse(file_path)

@app.delete("/api/voices/{voice_name}/audio")
async def delete_audio_file(voice_name: str):
    return await tts_api.delete_audio_file(voice_name)

# --- Voice Management ---
@app.post("/api/tts/set-voice")
async def set_voice_for_channel(
    channel_name: str = Form(...),
    voice_number: int = Form(...),
    user_name: str = Form(...),
    db: Session = Depends(get_db)
):
    """Установить голос для канала"""
    try:
        # Получаем все доступные голоса
        voices = db.query(VoiceModel).filter(VoiceModel.is_active == True).all()
        if not voices:
            raise HTTPException(status_code=404, detail="No voices available")
        
        # Проверяем, что номер голоса валидный
        if voice_number < 1 or voice_number > len(voices):
            raise HTTPException(status_code=400, detail=f"Voice number must be between 1 and {len(voices)}")
        
        # Выбираем голос по номеру (voice_number - 1, так как номера начинаются с 1)
        selected_voice = voices[voice_number - 1]
        
        # Сохраняем выбор пользователя в базе данных или кэше
        # Здесь можно добавить логику сохранения выбора пользователя
        
        return {
            "success": True,
            "voice_number": voice_number,
            "voice_name": selected_voice.name,
            "message": f"Voice set to #{voice_number}: {selected_voice.name}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tts/random-voice")
async def get_random_voice_for_channel(
    channel_name: str = Form(...),
    db: Session = Depends(get_db)
):
    """Получить случайный голос для канала"""
    try:
        import random
        
        # Получаем все доступные голоса
        voices = db.query(VoiceModel).filter(VoiceModel.is_active == True).all()
        if not voices:
            raise HTTPException(status_code=404, detail="No voices available")
        
        # Выбираем случайный голос
        random_voice = random.choice(voices)
        voice_number = voices.index(random_voice) + 1  # Номер начинается с 1
        
        return {
            "success": True,
            "voice_number": voice_number,
            "voice_name": random_voice.name,
            "message": f"Random voice selected: #{voice_number}: {random_voice.name}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting random voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- TTS Settings (moved to bot_service) ---
# Все настройки платформ, громкости и фильтров теперь в bot_service
# TTS service содержит только настройки синтеза голосов


@app.post("/api/tts/restart")
async def restart_tts_engine():
    """Перезагрузить TTS движок"""
    return await tts_api.restart_engine()

@app.post("/api/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    """Загрузить аудио файл для обслуживания"""
    from tts_service.config import config
    
    # Создаем директорию если не существует
    config.temp_audio_path.mkdir(parents=True, exist_ok=True)
    
    # Сохраняем файл
    file_path = config.temp_audio_path / file.filename
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    return JSONResponse({
        "message": "Audio file uploaded successfully",
        "filename": file.filename,
        "url": f"/api/audio/{file.filename}"
    })

@app.get("/api/audio/{filename}")
async def get_temp_audio(filename: str):
    """Получить временный аудио файл"""
    from tts_service.config import config
    temp_file = config.temp_audio_path / filename
    
    if not temp_file.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        path=str(temp_file),
        media_type="audio/wav",
        filename=filename
    )

# --- Main ---
# --- Backup Management API ---
@app.get("/api/admin/backups/info")
async def get_backup_info():
    """Получить информацию о бэкапах TTS"""
    try:
        backup_info = tts_backup_manager.get_backup_info()
        return {
            "success": True,
            "backups": backup_info,
            "service": "tts_service"
        }
    except Exception as e:
        logger.error(f"Error getting TTS backup info: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения информации о бэкапах TTS")

@app.post("/api/admin/backups/create")
async def create_manual_backup(backup_type: str):
    """Создать ручной бэкап TTS"""
    try:
        if backup_type == "database":
            db_path = "tts_service.db"
            backup_path = tts_backup_manager.create_database_backup(db_path)
        elif backup_type == "config":
            config_files = ["config.py", "requirements.txt"]
            backup_path = tts_backup_manager.create_config_backup(config_files)
        elif backup_type == "logs":
            backup_path = tts_backup_manager.create_logs_backup("logs")
        elif backup_type == "audio":
            backup_path = tts_backup_manager.create_audio_backup("audio/voices")
        elif backup_type == "models":
            backup_path = tts_backup_manager.create_models_backup("f5_tts_cache")
        elif backup_type == "full":
            # Полный бэкап TTS
            db_path = "tts_service.db"
            tts_backup_manager.create_database_backup(db_path)
            config_files = ["config.py", "requirements.txt"]
            tts_backup_manager.create_config_backup(config_files)
            tts_backup_manager.create_logs_backup("logs")
            tts_backup_manager.create_audio_backup("audio/voices")
            tts_backup_manager.create_models_backup("f5_tts_cache")
            backup_path = "Full TTS backup completed"
        else:
            raise HTTPException(status_code=400, detail="Неверный тип бэкапа TTS")
        
        if backup_path:
            return {
                "success": True,
                "message": f"Бэкап TTS {backup_type} создан успешно",
                "backup_path": backup_path
            }
        else:
            raise HTTPException(status_code=500, detail="Ошибка создания бэкапа TTS")
            
    except Exception as e:
        logger.error(f"Error creating manual TTS backup: {e}")
        raise HTTPException(status_code=500, detail="Ошибка создания бэкапа TTS")

@app.post("/api/admin/backups/cleanup")
async def cleanup_old_backups():
    """Очистить старые бэкапы TTS"""
    try:
        tts_backup_manager.cleanup_old_backups()
        return {
            "success": True,
            "message": "Очистка старых бэкапов TTS завершена"
        }
    except Exception as e:
        logger.error(f"Error cleaning up TTS backups: {e}")
        raise HTTPException(status_code=500, detail="Ошибка очистки бэкапов TTS")

# --- System Monitoring API ---
@app.get("/api/admin/monitoring/current")
async def get_current_monitoring():
    """Получить текущую статистику мониторинга TTS"""
    try:
        stats = tts_monitor.get_current_stats()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        logger.error(f"Error getting TTS monitoring stats: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения статистики мониторинга TTS")

@app.get("/api/admin/monitoring/summary")
async def get_monitoring_summary():
    """Получить сводку мониторинга TTS за 24 часа"""
    try:
        summary = tts_monitor.get_monitoring_summary()
        return {
            "success": True,
            "data": summary
        }
    except Exception as e:
        logger.error(f"Error getting TTS monitoring summary: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения сводки мониторинга TTS")

@app.get("/api/admin/monitoring/status")
async def get_monitoring_status():
    """Получить статус мониторинга TTS"""
    try:
        return {
            "success": True,
            "monitoring_active": tts_monitor.is_monitoring,
            "data_points": len(tts_monitor.monitoring_data),
            "service": "tts_service"
        }
    except Exception as e:
        logger.error(f"Error getting TTS monitoring status: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения статуса мониторинга TTS")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)