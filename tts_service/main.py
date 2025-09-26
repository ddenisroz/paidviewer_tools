# tts_service/main.py
import sys
import os
from pathlib import Path
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List
import uvicorn

# --- Logging Configuration ---
import sys
from pathlib import Path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
from logging_config import setup_logging, log_system_info, log_service_start, log_service_stop, log_error, log_api_call, log_tts_event

from tts_service.database import get_db, init_db, Voice as VoiceModel
from tts_service.models import *
from tts_service.tts_engine import tts_engine_manager
from tts_service.file_manager import file_manager
from tts_service.api_endpoints import tts_api
from tts_service.background_tasks import background_task_manager

# --- Logging Configuration ---
logger = setup_logging("tts_service", "INFO")
logger.info("=== TTS SERVICE STARTED ===")

# --- Lifespan Events ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    log_system_info(logger)
    log_service_start(logger, "tts_service", 8001)
    
    # Инициализация базы данных
    init_db()
    
    # Инициализация TTS движка
    await tts_engine_manager.initialize()
    
    # Запуск фоновых задач
    await background_task_manager.start()
    
    yield
    
    # Shutdown
    log_service_stop(logger, "tts_service")
    
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
def get_user_voices(user_id: str, db: Session = Depends(get_db)):
    return tts_api.get_user_voices(user_id, db)

@app.get("/api/voices/global", response_model=List[VoiceSchema])
def get_global_voices(db: Session = Depends(get_db)):
    return tts_api.get_global_voices(db)

# --- Admin Voices ---
@app.get("/api/admin/voices", response_model=List[VoiceSchema])
def get_admin_voices(db: Session = Depends(get_db)):
    """Получить все голоса для админки"""
    return tts_api.get_all_voices(db)

# --- Voice Upload for Users ---
@app.post("/api/user/voices/upload", response_model=VoiceUploadResponse)
async def upload_user_voice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    user_id: str = Form(...),
    db: Session = Depends(get_db)
):
    return await tts_api.upload_voice(
        background_tasks, file, voice_name, "user", False, user_id, db
    )

@app.delete("/api/user/voices/{voice_id}")
def delete_user_voice(voice_id: int, user_id: str, db: Session = Depends(get_db)):
    voice = db.query(VoiceModel).filter(
        VoiceModel.id == voice_id, 
        VoiceModel.owner_id == user_id
    ).first()
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Удаляем файл
    file_manager.delete_voice_file(voice.name)
    
    # Удаляем из базы данных
    db.delete(voice)
    db.commit()

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
    user_id: str,
    settings: VoiceSettingsSchema,
    db: Session = Depends(get_db)
):
    voice = db.query(VoiceModel).filter(
        VoiceModel.id == voice_id,
        VoiceModel.owner_id == user_id
    ).first()
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Обновляем настройки
    for field, value in settings.dict(exclude_unset=True).items():
        setattr(voice, field, value)
    
    db.commit()
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
def transcribe_user_voice_audio(voice_id: int, user_id: str, db: Session = Depends(get_db)):
    voice = db.query(VoiceModel).filter(
        VoiceModel.id == voice_id,
        VoiceModel.owner_id == user_id
    ).first()
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    if not tts_engine_manager.transcriber:
        raise HTTPException(status_code=503, detail="Transcriber not available")
    
    try:
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
    voice.name = new_name
    db.commit()
    
    return {"message": f"Voice renamed from {old_name} to {new_name}"}

@app.put("/api/user/voices/{voice_id}/rename")
def rename_user_voice(voice_id: int, user_id: str, new_name: str = Form(...), db: Session = Depends(get_db)):
    voice = db.query(VoiceModel).filter(
        VoiceModel.id == voice_id,
        VoiceModel.owner_id == user_id
    ).first()
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Проверяем, что новое имя не занято
    existing_voice = db.query(VoiceModel).filter(VoiceModel.name == new_name).first()
    if existing_voice and existing_voice.id != voice_id:
        raise HTTPException(status_code=400, detail="Voice with this name already exists")
    
    old_name = voice.name
    voice.name = new_name
    db.commit()
    
    return {"message": f"Voice renamed from {old_name} to {new_name}"}

# --- TTS Synthesis ---
@app.post("/api/tts/synthesize", response_model=SynthesisResponse)
async def synthesize_speech(
    background_tasks: BackgroundTasks,
    request: SynthesisRequest,
    db: Session = Depends(get_db)
):
    return await tts_api.synthesize_speech(background_tasks, request, db)

# --- Voice Testing ---
@app.post("/api/voices/{voice_id}/test", response_model=SynthesisResponse)
async def test_voice(
    background_tasks: BackgroundTasks,
    voice_id: int,
    text: str = Form(...),
    user_id: str = Form(None),
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

# --- File Operations ---
@app.get("/api/voices/{voice_name}/audio")
async def get_audio_file(voice_name: str):
    file_path = await tts_api.get_audio_file(voice_name)
    return FileResponse(file_path)

@app.delete("/api/voices/{voice_name}/audio")
async def delete_audio_file(voice_name: str):
    return await tts_api.delete_audio_file(voice_name)

# --- Main ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)