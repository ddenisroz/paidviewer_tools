# tts_service/admin_api.py
"""API для администрирования TTS Service"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from tts_service.database import get_db, Voice as VoiceModel
from tts_service.tts_engine import tts_engine_manager
from tts_service.file_manager import file_manager
from tts_service.background_tasks import background_task_manager
from tts_service.stats_service import stats_service
from monitoring import tts_monitor
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

admin_router = APIRouter(tags=["admin"])

@admin_router.get("/stats")
async def get_admin_stats(db: Session = Depends(get_db)):
    """Получить статистику для админки"""
    try:
        # Получаем общую статистику
        stats = stats_service.get_system_overview()
        
        # Получаем статистику голосов
        voices = db.query(VoiceModel).all()
        voice_stats = {
            "total_voices": len(voices),
            "voices": [
                {
                    "id": voice.id,
                    "name": voice.name,
                    "description": voice.description,
                    "is_active": voice.is_active,
                    "created_at": voice.created_at.isoformat() if voice.created_at else None
                }
                for voice in voices
            ]
        }
        
        # Получаем метрики мониторинга
        metrics = tts_monitor.get_metrics()
        
        return {
            "status": "success",
            "stats": stats,
            "voices": voice_stats,
            "metrics": metrics
        }
    except Exception as e:
        logger.error(f"Admin stats error: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

@admin_router.get("/voices")
async def get_voices(db: Session = Depends(get_db)):
    """Получить список голосов"""
    try:
        voices = db.query(VoiceModel).all()
        return {
            "status": "success",
            "voices": [
                {
                    "id": voice.id,
                    "name": voice.name,
                    "voice_type": voice.voice_type,
                    "owner_id": voice.owner_id,
                    "is_active": voice.is_active,
                    "file_path": voice.file_path,
                    "reference_text": voice.reference_text,
                    "cfg_strength": voice.cfg_strength,
                    "speed_preset": voice.speed_preset,
                    "created_at": voice.created_at.isoformat() if voice.created_at else None
                }
                for voice in voices
            ]
        }
    except Exception as e:
        logger.error(f"Get voices error: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

@admin_router.post("/voices/{voice_id}/toggle")
async def toggle_voice(voice_id: int, db: Session = Depends(get_db)):
    """Включить/выключить голос"""
    try:
        voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        
        voice.is_active = not voice.is_active
        db.commit()
        
        return {
            "status": "success",
            "message": f"Voice {voice.name} {'enabled' if voice.is_active else 'disabled'}",
            "voice": {
                "id": voice.id,
                "name": voice.name,
                "is_active": voice.is_active
            }
        }
    except Exception as e:
        logger.error(f"Toggle voice error: {e}")
        db.rollback()
        return {
            "status": "error",
            "error": str(e)
        }

@admin_router.post("/voices/upload")
async def upload_voice(
    file: UploadFile = File(...),
    name: str = None,
    db: Session = Depends(get_db)
):
    """Загрузить новый голос для AI TTS с автоматической конвертацией и транскрибацией"""
    import tempfile
    
    temp_input_path = None
    temp_converted_path = None
    final_voice_path = None
    
    try:
        # Проверка типа файла (принимаем любые аудио форматы)
        allowed_extensions = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.aiff', '.au']
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Неподдерживаемый формат файла. Разрешены: {', '.join(allowed_extensions)}"
            )
        
        # Используем имя файла если не указано имя голоса
        voice_name = name or os.path.splitext(file.filename)[0]
        
        # Проверка дубликатов
        existing_voice = db.query(VoiceModel).filter(VoiceModel.name == voice_name).first()
        if existing_voice:
            raise HTTPException(status_code=400, detail=f"Голос с именем '{voice_name}' уже существует")
        
        # Сохраняем загруженный файл во временную директорию
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            contents = await file.read()
            temp_file.write(contents)
            temp_input_path = temp_file.name
        
        logger.info(f"📥 Voice file uploaded to temp: {temp_input_path}")
        
        # Конвертируем в WAV с требованиями F5-TTS (48kHz, Mono, 16-bit)
        temp_converted_path = tempfile.mktemp(suffix='.wav')
        
        from tts_service.async_audio_converter import AsyncAudioConverter
        converter = AsyncAudioConverter(max_workers=1)
        await converter.start_workers()
        
        try:
            # Синхронная конвертация для простоты
            success = converter._convert_audio_sync(temp_input_path, temp_converted_path, "upload_task")
            if not success:
                raise Exception("Audio conversion failed")
            
            logger.info(f"✅ Audio converted to WAV: {temp_converted_path}")
        finally:
            await converter.stop_workers()
        
        # Автоматическая транскрибация аудио
        reference_text = ""
        try:
            from tts_service.tts_engine import tts_engine_manager
            if tts_engine_manager.transcriber:
                reference_text = tts_engine_manager.transcribe(temp_converted_path)
                logger.info(f"✅ Audio transcribed: '{reference_text[:50]}...'")
            else:
                logger.warning("⚠️ Transcriber not available, skipping transcription")
        except Exception as e:
            logger.warning(f"⚠️ Transcription failed: {e}, continuing without reference text")
        
        # Сохраняем в финальную директорию
        voices_dir = Path("audio/voices/global")
        voices_dir.mkdir(parents=True, exist_ok=True)
        
        # ВСЕГДА сохраняем как WAV
        safe_filename = f"{voice_name}.wav"
        final_voice_path = voices_dir / safe_filename
        
        # Копируем конвертированный файл
        import shutil
        shutil.copy2(temp_converted_path, final_voice_path)
        
        logger.info(f"✅ Voice saved: {final_voice_path}")
        
        # Создаём запись в БД
        new_voice = VoiceModel(
            name=voice_name,
            voice_type='global',
            file_path=str(final_voice_path),
            reference_text=reference_text or None,
            is_active=True,
            cfg_strength=2.5,  # Значение по умолчанию
            speed_preset='normal'  # Значение по умолчанию
        )
        db.add(new_voice)
        db.commit()
        db.refresh(new_voice)
        
        logger.info(f"✅ Voice '{voice_name}' uploaded successfully (ID: {new_voice.id})")
        
        return {
            "status": "success",
            "message": f"Голос '{voice_name}' успешно загружен, конвертирован в WAV и транскрибирован",
            "voice": {
                "id": new_voice.id,
                "name": new_voice.name,
                "voice_type": new_voice.voice_type,
                "is_active": new_voice.is_active,
                "file_path": str(final_voice_path),
                "reference_text": reference_text[:100] + "..." if reference_text and len(reference_text) > 100 else reference_text,
                "format": "WAV 48kHz Mono 16-bit"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice upload error: {e}")
        db.rollback()
        
        # Удаляем все временные и финальные файлы при ошибке
        if final_voice_path and Path(final_voice_path).exists():
            Path(final_voice_path).unlink()
        
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки голоса: {str(e)}")
    
    finally:
        # Очистка временных файлов
        if temp_input_path and os.path.exists(temp_input_path):
            try:
                os.unlink(temp_input_path)
            except:
                pass
        
        if temp_converted_path and os.path.exists(temp_converted_path):
            try:
                os.unlink(temp_converted_path)
            except:
                pass

@admin_router.post("/voices/{voice_id}/retranscribe")
async def retranscribe_voice(voice_id: int, db: Session = Depends(get_db)):
    """Перетранскрибировать голос - извлечь reference_text из аудиофайла заново"""
    try:
        # Получаем голос из БД
        voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
        if not voice:
            raise HTTPException(status_code=404, detail="Голос не найден")
        
        # Проверяем, что файл существует
        if not voice.file_path or not os.path.exists(voice.file_path):
            raise HTTPException(status_code=404, detail="Аудиофайл не найден")
        
        logger.info(f"🔄 Starting retranscription for voice {voice_id} ({voice.name})")
        
        # Транскрибируем аудио
        reference_text = ""
        try:
            from tts_service.tts_engine import tts_engine_manager
            if tts_engine_manager.transcriber:
                reference_text = tts_engine_manager.transcribe(voice.file_path)
                logger.info(f"✅ Retranscribed: '{reference_text[:50]}...'")
            else:
                raise Exception("Transcriber not available")
        except Exception as e:
            logger.error(f"❌ Transcription failed: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка транскрибации: {str(e)}")
        
        # Обновляем reference_text в БД
        voice.reference_text = reference_text
        db.commit()
        db.refresh(voice)
        
        logger.info(f"✅ Voice {voice_id} retranscribed successfully")
        
        return {
            "status": "success",
            "message": f"Голос '{voice.name}' успешно перетранскрибирован",
            "reference_text": reference_text,
            "voice_id": voice_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Retranscribe error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка перетранскрибации: {str(e)}")

@admin_router.post("/voices/test")
async def test_voice(
    voice_name: str = Form(...),
    user_id: int = Form(...),
    test_text: str = Form(...),
    cfg_strength: float = Form(None),
    speed_preset: str = Form(None),
    db: Session = Depends(get_db)
):
    """Тестировать голос с заданным текстом и настройками"""
    from pathlib import Path
    
    try:
        if not voice_name or not test_text:
            raise HTTPException(status_code=400, detail="voice_name and test_text are required")
        
        # Получаем голос из БД
        voice = db.query(VoiceModel).filter(VoiceModel.name == voice_name).first()
        if not voice:
            raise HTTPException(status_code=404, detail=f"Voice '{voice_name}' not found")
        
        # Проверяем права доступа для пользовательских голосов
        if voice.owner_id and user_id and voice.owner_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        logger.info(f"🎤 Testing voice '{voice_name}' with text: '{test_text[:50]}...'")
        
        # Используем переданные параметры или значения по умолчанию из голоса
        cfg = cfg_strength if cfg_strength is not None else voice.cfg_strength
        speed = speed_preset if speed_preset is not None else voice.speed_preset
        
        # Выполняем синтез
        result = await tts_engine_manager.synthesize_speech_async(
            text=test_text,
            voice=voice_name,
            user_id=user_id,
            channel_name="test",
            author="admin",
            volume=50.0,
            tts_settings={
                "voice_settings": {
                    "cfg_strength": cfg,
                    "speed_preset": speed
                }
            }
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Synthesis failed"))
        
        # Проверяем, есть ли audio_url или audio_path в результате
        audio_url = result.get("audio_url")
        audio_path = result.get("audio_path")
        
        # Если есть audio_url, используем его напрямую
        if audio_url:
            logger.info(f"✅ Test synthesis completed: {audio_url}")
            return {
                "status": "success",
                "audio_url": audio_url,
                "message": "Test synthesis completed successfully"
            }
        
        # Если есть только audio_path, преобразуем его в audio_url
        if audio_path:
            from tts_service.config import config
            audio_path_obj = Path(audio_path)
            # Получаем путь относительно audio директории
            try:
                # Абсолютный путь к audio директории
                abs_audio_path = config.audio_path.resolve()
                abs_audio_file = audio_path_obj.resolve()
                
                # Проверяем, находится ли файл внутри audio директории
                try:
                    relative_path = abs_audio_file.relative_to(abs_audio_path)
                    audio_url = f"/audio/{relative_path.as_posix()}"
                except ValueError:
                    # Если файл находится вне audio, пытаемся найти его имя
                    audio_url = f"/audio/{audio_path_obj.name}"
                    
                logger.info(f"✅ Test synthesis completed: {audio_url}")
                return {
                    "status": "success",
                    "audio_url": audio_url,
                    "message": "Test synthesis completed successfully"
                }
            except Exception as e:
                logger.error(f"Error processing audio path: {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Error processing audio path: {str(e)}")
        
        # Если нет ни audio_url, ни audio_path
        raise HTTPException(status_code=500, detail="Audio file not generated")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test voice error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@admin_router.delete("/voices/{voice_id}")
async def delete_voice(voice_id: int, db: Session = Depends(get_db)):
    """Удалить голос"""
    try:
        voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        
        # Удаляем файл
        if voice.file_path and Path(voice.file_path).exists():
            try:
                Path(voice.file_path).unlink()
                logger.info(f"Voice file deleted: {voice.file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete voice file: {e}")
        
        # Удаляем запись из БД
        db.delete(voice)
        db.commit()
        
        logger.info(f"Voice '{voice.name}' (ID: {voice_id}) deleted successfully")
        
        return {
            "status": "success",
            "message": f"Голос '{voice.name}' успешно удалён"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice delete error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка удаления голоса: {str(e)}")

@admin_router.put("/voices/{voice_id}/settings")
async def update_voice_settings(
    voice_id: int,
    settings: dict = Body(...),
    db: Session = Depends(get_db)
):
    """Обновить настройки голоса (reference_text, cfg_strength, speed_preset)"""
    try:
        voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
        if not voice:
            raise HTTPException(status_code=404, detail="Голос не найден")
        
        # Обновляем доступные настройки
        if 'reference_text' in settings:
            voice.reference_text = settings['reference_text']
        
        if 'cfg_strength' in settings:
            voice.cfg_strength = settings['cfg_strength']
        
        if 'speed_preset' in settings:
            voice.speed_preset = settings['speed_preset']
        
        db.commit()
        db.refresh(voice)
        
        logger.info(f"✅ Voice {voice_id} settings updated")
        
        return {
            "status": "success",
            "message": "Настройки голоса обновлены",
            "voice": {
                "id": voice.id,
                "name": voice.name,
                "reference_text": voice.reference_text,
                "cfg_strength": voice.cfg_strength,
                "speed_preset": voice.speed_preset
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update voice settings error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка обновления настроек: {str(e)}")

@admin_router.put("/voices/{voice_id}/rename")
async def rename_voice(
    voice_id: int,
    new_name: str,
    db: Session = Depends(get_db)
):
    """Переименовать голос"""
    try:
        voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        
        # Проверка дубликатов
        existing_voice = db.query(VoiceModel).filter(
            VoiceModel.name == new_name,
            VoiceModel.id != voice_id
        ).first()
        if existing_voice:
            raise HTTPException(status_code=400, detail=f"Голос с именем '{new_name}' уже существует")
        
        old_name = voice.name
        voice.name = new_name
        db.commit()
        
        logger.info(f"Voice renamed from '{old_name}' to '{new_name}' (ID: {voice_id})")
        
        return {
            "status": "success",
            "message": f"Голос переименован: '{old_name}' → '{new_name}'",
            "voice": {
                "id": voice.id,
                "name": voice.name
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice rename error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка переименования голоса: {str(e)}")

@admin_router.get("/system/status")
async def get_system_status():
    """Получить статус системы"""
    try:
        return {
            "status": "success",
            "system": {
                "tts_engine": tts_engine_manager.is_initialized(),
                "file_manager": file_manager.is_initialized(),
                "background_tasks": background_task_manager.is_running(),
                "monitoring": tts_monitor.is_running()
            }
        }
    except Exception as e:
        logger.error(f"System status error: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

@admin_router.post("/system/restart")
async def restart_system():
    """Перезапустить систему (заглушка)"""
    try:
        logger.warning("System restart requested")
        return {
            "status": "success",
            "message": "Restart command sent (not implemented in development)"
        }
    except Exception as e:
        logger.error(f"System restart error: {e}")
        return {
            "status": "error",
            "error": str(e)
        }
