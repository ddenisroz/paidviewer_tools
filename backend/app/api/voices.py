from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from typing import List
import os
from pathlib import Path
import logging
import asyncio
from app.services.tts_service import TTSService

from app.core.security import get_current_user
from app.services.audio_processor import AudioProcessor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voices", tags=["voices"])

@router.get("/info")
async def get_upload_info():
    """Информация о требованиях к загружаемым файлам"""
    return {
        "max_file_size_mb": AudioProcessor.MAX_FILE_SIZE_MB,
        "max_duration_seconds": AudioProcessor.MAX_DURATION_SECONDS,
        "target_sample_rate": AudioProcessor.TARGET_SAMPLE_RATE,
        "supported_formats": list(AudioProcessor.SUPPORTED_FORMATS),
        "processing_info": {
            "auto_convert_to_wav": True,
            "auto_trim_to_max_duration": True,
            "normalize_volume": True,
            "convert_to_mono": True
        }
    }

# Base path to the main 'voices' directory
VOICES_BASE_DIR = Path(__file__).resolve().parent.parent.parent / "voices"

def get_channel_voices_dir(username: str) -> Path:
    """Returns the voice directory for a specific channel."""
    return VOICES_BASE_DIR / username

@router.get("/")
async def get_voices(user: dict = Depends(get_current_user)):
    """Получение списка голосов пользователя с подробной информацией"""
    if not user or "username" not in user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    channel_dir = get_channel_voices_dir(user["username"])
    channel_dir.mkdir(exist_ok=True, parents=True)
    
    try:
        voices = []
        for f in channel_dir.iterdir():
            if f.suffix == '.wav' and f.is_file():
                # Получаем информацию о файле
                stat = f.stat()
                size_kb = round(stat.st_size / 1024, 1)
                
                # Попытаемся получить длительность
                try:
                    with open(f, 'rb') as audio_file:
                        audio_info = AudioProcessor.get_audio_info(audio_file.read(), f.name)
                        duration = audio_info.get('duration', 0) if audio_info else 0
                except:
                    duration = 0
                
                voices.append({
                    "name": f.stem,
                    "filename": f.name,
                    "size_kb": size_kb,
                    "duration": duration
                })
        
        voices.sort(key=lambda x: x['name'])
        return {"voices": voices, "total": len(voices)}
        
    except Exception as e:
        logger.error(f"Ошибка получения списка голосов: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка чтения голосов: {e}")

@router.post("/upload")
async def upload_voice(
    user: dict = Depends(get_current_user),
    file: UploadFile = File(...),
    voice_name: str = None  # Опциональное имя голоса
):
    """Загрузка аудио файла с конвертацией в WAV и обрезкой"""
    if not user or "username" not in user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Файл не выбран")

    # Используем переданное имя или имя файла
    if voice_name:
        voice_name = voice_name.strip()
    else:
        voice_name = Path(file.filename).stem
    
    # Валидация имени голоса
    if not voice_name or ".." in voice_name or "/" in voice_name or "\\" in voice_name:
        raise HTTPException(status_code=400, detail="Некорректное имя голоса")
    
    # Проверка на существование
    channel_dir = get_channel_voices_dir(user["username"])
    channel_dir.mkdir(exist_ok=True, parents=True)
    file_path = channel_dir / f"{voice_name}.wav"
    
    if file_path.exists():
        raise HTTPException(status_code=400, detail=f"Голос '{voice_name}' уже существует")
    
    try:
        # Читаем содержимое файла
        file_content = await file.read()
        
        # Обрабатываем аудио
        wav_data, processing_info = AudioProcessor.process_audio_file(
            file_content, file.filename
        )
        
        # Сохраняем WAV файл
        with file_path.open("wb") as f:
            f.write(wav_data)
        
        logger.info(f"Голос '{voice_name}' загружен для пользователя {user['username']}")
        
        return {
            "message": "Голос успешно загружен",
            "voice_name": voice_name,
            "info": processing_info
        }
        
    except ValueError as e:
        # Ошибки валидации
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Ошибка загрузки голоса: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка обработки файла: {str(e)}")
    finally:
        await file.close()

@router.delete("/{voice_name}")
async def delete_voice(voice_name: str, user: dict = Depends(get_current_user)):
    """Удаление голоса"""
    if not user or "username" not in user:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    channel_dir = get_channel_voices_dir(user["username"])
    
    # Валидация имени
    if not voice_name or ".." in voice_name or "/" in voice_name or "\\" in voice_name:
        raise HTTPException(status_code=400, detail="Некорректное имя голоса")

    file_path = channel_dir / f"{voice_name}.wav"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Голос не найден")
        
    try:
        os.remove(file_path)
        logger.info(f"Голос '{voice_name}' удален для пользователя {user['username']}")
    except Exception as e:
        logger.error(f"Ошибка удаления голоса: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Не удалось удалить голос: {e}")
        
    return {"message": f"Голос '{voice_name}' успешно удален"}

@router.get("/tts/status")
async def get_tts_status(request: Request):
    """Получить статус TTS движка"""
    tts_service = request.app.state.tts_service
    loaded = tts_service is not None
    ready = tts_service.is_ready() if tts_service else False
    logger.info(f"TTS status: loaded={loaded}, ready={ready}")
    return {
        "loaded": loaded,
        "ready": ready
    }

@router.post("/tts/load")
async def load_tts_engine(request: Request):
    """Загрузить TTS движок с прогрессом"""
    logger.info("TTS load endpoint called")
    tts_service = request.app.state.tts_service
    
    # Проверяем, действительно ли TTS сервис готов
    if tts_service is not None and tts_service.is_ready():
        logger.info("TTS service already loaded and ready")
        return {"status": "already_loaded", "message": "TTS движок уже загружен"}
    
    try:
        # Если TTS сервис существует, но не готов, перезапускаем его
        if tts_service is not None:
            logger.info("TTS service exists but not ready, reinitializing...")
        
        # Создаем новый TTS сервис
        state_service = request.app.state.state_service
        logger.info("Creating new TTS service...")
        tts_service = TTSService(state_service=state_service)
        
        # Сохраняем в app state сразу
        request.app.state.tts_service = tts_service
        logger.info("TTS service saved to app state")
        
        # Обновляем ссылку на TTS сервис в боте
        bot = request.app.state.bot
        if bot:
            bot.update_tts_service(tts_service)
            logger.info("TTS service updated in bot")
        
        # Загружаем TTS в фоне
        logger.info("Starting TTS initialization...")
        asyncio.create_task(tts_service.initialize_async())
        
        # Включаем TTS для всех активных каналов
        state_service = request.app.state.state_service
        if state_service.channels:
            for channel_name in state_service.channels.keys():
                await state_service.set_tts_enabled(channel_name, True)
                logger.info(f"TTS enabled for channel {channel_name}")
        else:
            logger.warning("No channels found in state service, TTS will be enabled when channels are registered")
        
        logger.info("TTS service created and initialization started")
        return {"status": "loading", "message": "TTS движок загружается..."}
    except Exception as e:
        logger.error(f"Ошибка загрузки TTS: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки TTS: {str(e)}")

@router.get("/tts/progress")
async def get_tts_progress(request: Request):
    """Получить прогресс загрузки TTS"""
    tts_service = request.app.state.tts_service
    
    if tts_service is None:
        logger.info("TTS progress: service is None")
        return {"progress": 0, "status": "not_started", "message": "TTS не запущен"}
    
    if tts_service.is_ready():
        logger.info("TTS progress: service is ready")
        return {"progress": 100, "status": "ready", "message": "TTS готов к работе"}
    
    # Получаем прогресс из TTS сервиса
    progress = getattr(tts_service, 'loading_progress', 0)
    status = getattr(tts_service, 'loading_status', 'loading')
    message = getattr(tts_service, 'loading_message', 'Загрузка...')
    
    logger.info(f"TTS progress: {progress}%, status: {status}, message: {message}")
    return {
        "progress": progress,
        "status": status,
        "message": message
    }

@router.post("/tts/reload")
async def reload_tts_engine(request: Request):
    """Принудительно перезагрузить TTS движок"""
    try:
        # Удаляем текущий TTS сервис
        request.app.state.tts_service = None
        
        # Создаем новый TTS сервис
        state_service = request.app.state.state_service
        tts_service = TTSService(state_service=state_service)
        
        # Сохраняем в app state
        request.app.state.tts_service = tts_service
        
        # Загружаем TTS в фоне
        asyncio.create_task(tts_service.initialize_async())
        
        logger.info("TTS service force reloaded")
        return {"status": "reloading", "message": "TTS движок перезагружается..."}
    except Exception as e:
        logger.error(f"Ошибка перезагрузки TTS: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка перезагрузки TTS: {str(e)}")

@router.post("/tts/unload")
async def unload_tts_engine(request: Request):
    """Выгрузка TTS движка из памяти"""
    try:
        logger.info("TTS unload endpoint called")
        
        # Получаем существующий сервис из состояния приложения
        tts_service = request.app.state.tts_service
        
        if tts_service:
            # Останавливаем текущий сервис
            logger.info("Unloading TTS service...")
            
            # Очищаем состояние приложения
            request.app.state.tts_service = None
            logger.info("TTS service unloaded successfully")
            
            return {"message": "TTS движок успешно выгружен из памяти"}
        else:
            logger.warning("TTS service was not loaded")
            return {"message": "TTS движок не был загружен"}
            
    except Exception as e:
        logger.error(f"Error unloading TTS engine: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка выгрузки TTS: {str(e)}")
