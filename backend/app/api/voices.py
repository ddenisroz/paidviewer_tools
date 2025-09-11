from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List
import os
from pathlib import Path
import logging

from app.core.security import get_current_user
from app.services.audio_processor import AudioProcessor

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/voices/info")
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

@router.get("/voices")
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

@router.post("/voices/upload")
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

@router.delete("/voices/{voice_name}")
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
