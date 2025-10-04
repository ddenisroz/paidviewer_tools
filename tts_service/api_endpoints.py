# tts_service/api_endpoints.py
import logging
import time
from pathlib import Path
from fastapi import HTTPException, UploadFile, File, Form, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional

from tts_service.database import get_db, Voice as VoiceModel, User as UserModel
from tts_service.models import *
from tts_service.tts_engine import tts_engine_manager
from tts_service.file_manager import file_manager
from tts_service.background_tasks import background_task_manager

logger = logging.getLogger(__name__)

class TTSAPIEndpoints:
    def __init__(self):
        pass

    async def health_check(self):
        """Проверка здоровья сервиса"""
        return {
            "status": "healthy", 
            "tts_engine_loaded": tts_engine_manager.is_ready()
        }

    async def get_audio_file(self, voice_name: str):
        """Получить аудиофайл голоса"""
        file_path = file_manager.get_voice_file_path(voice_name)
        if not file_path or not file_path.exists():
            raise HTTPException(status_code=404, detail="Voice file not found")
        
        return file_path

    async def delete_audio_file(self, voice_name: str):
        """Удалить аудиофайл (для тестовых файлов)"""
        success = file_manager.delete_voice_file(voice_name)
        if not success:
            raise HTTPException(status_code=404, detail="Voice file not found")
        
        return {"message": f"Voice file {voice_name} deleted successfully"}

    async def synthesize_speech(
        self,
        background_tasks: BackgroundTasks,
        request: SynthesisRequest,
        db: Session = Depends(get_db)
    ):
        """Синтез речи с применением громкости к выходному файлу"""
        if not tts_engine_manager.is_ready():
            raise HTTPException(status_code=503, detail="TTS engine not ready")
        
        try:
            # Получаем голос из базы данных
            voice = db.query(VoiceModel).filter(VoiceModel.name == request.voice_name).first()
            if not voice:
                raise HTTPException(status_code=404, detail="Voice not found")
            
            # Проверяем права доступа
            if voice.owner_id and voice.owner_id != request.user_id:
                raise HTTPException(status_code=403, detail="Access denied")
            
            # Создаем временный файл для результата
            from tts_service.config import config
            temp_file = config.temp_audio_path / f"tts_{request.voice_name}_{int(time.time())}.wav"
            temp_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Параметры синтеза - используем только поддерживаемые параметры
            cfg_strength = getattr(request, 'cfg_strength', None)
            speed_preset = getattr(request, 'speed_preset', None)
            
            logger.info(f"📥 Request params: cfg_strength={cfg_strength}, speed_preset={speed_preset}")
            logger.info(f"📊 Voice defaults: cfg_strength={voice.cfg_strength}, speed_preset={voice.speed_preset}")
            
            synthesis_params = {
                "cfg_strength": cfg_strength if cfg_strength is not None else voice.cfg_strength,
                "speed_preset": speed_preset if speed_preset is not None else voice.speed_preset,
                "volume_level": getattr(request, 'volume_level', 50.0)  # Громкость по умолчанию 50%
            }
            
            logger.info(f"🎛️ Final synthesis params: {synthesis_params}")
            
            # Выполняем синтез с применением громкости
            success = await tts_engine_manager.synthesize(
                request.text, 
                request.voice_name, 
                str(temp_file),
                **synthesis_params
            )
            
            if not success:
                raise HTTPException(status_code=500, detail="Synthesis failed")
            
            # Планируем очистку файла через 5 минут
            background_tasks.add_task(
                background_task_manager.cleanup_temp_file_delayed,
                temp_file,
                300  # 5 минут
            )
            
            # Создаем URL для доступа к файлу
            audio_url = f"/api/audio/{temp_file.name}"
            
            return SynthesisResponse(
                success=True,
                message="Synthesis completed successfully",
                audio_file=str(temp_file),
                audio_url=audio_url,
                duration=0.0  # TODO: calculate duration
            )
            
        except Exception as e:
            logger.error(f"Error during synthesis: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def get_all_voices(self, db: Session = Depends(get_db)):
        """Получить все голоса"""
        voices = db.query(VoiceModel).all()
        return [VoiceSchema.from_orm(voice) for voice in voices]

    async def upload_voice(
        self,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        voice_name: str = Form(...),
        voice_type: str = Form("user"),
        is_public: bool = Form(False),
        owner_id: int = Form(None),
        db: Session = Depends(get_db)
    ):
        """Загрузить голос"""
        try:
            # Проверяем, что голос с таким именем не существует
            existing_voice = db.query(VoiceModel).filter(VoiceModel.name == voice_name).first()
            if existing_voice:
                raise HTTPException(status_code=400, detail="Voice with this name already exists")
            
            # Сохраняем файл
            saved_path = file_manager.save_uploaded_file(file, voice_name, owner_id)
            if not saved_path:
                raise HTTPException(status_code=500, detail="Failed to save voice file")
            
            # Создаем запись в базе данных
            voice = VoiceModel(
                name=voice_name,
                file_path=str(saved_path),
                voice_type=voice_type,
                owner_id=owner_id,
                is_public=is_public,
                is_active=True
            )
            
            db.add(voice)
            db.commit()
            db.refresh(voice)
            
            # Планируем транскрипцию
            if tts_engine_manager.transcriber:
                background_tasks.add_task(
                    self._transcribe_voice_background,
                    voice.id,
                    str(saved_path),
                    db
                )
            
            return VoiceUploadResponse(
                success=True,
                message="Voice uploaded successfully",
                voice_id=voice.id,
                voice_name=voice.name
            )
            
        except Exception as e:
            logger.error(f"Error uploading voice: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def delete_voice(self, voice_id: int, db: Session = Depends(get_db)):
        """Удалить голос"""
        voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        
        # Удаляем файл
        file_manager.delete_voice_file(voice.name)
        
        # Удаляем из базы данных
        db.delete(voice)
        db.commit()
        
        return {"message": f"Voice {voice.name} deleted successfully"}

    def get_tts_config(self):
        """Получить текущие настройки TTS"""
        from tts_service.config import config
        return TtsConfigResponse(cfg_strength=config.cfg_strength)

    def update_tts_config(self, settings: TtsConfigSchema):
        """Обновить настраиваемые параметры TTS"""
        from tts_service.config import config
        config.cfg_strength = settings.cfg_strength
        return TtsConfigResponse(cfg_strength=config.cfg_strength)

    def get_user_voices(self, user_id: int, db: Session = Depends(get_db)):
        """Получить голоса пользователя"""
        voices = db.query(VoiceModel).filter(
            VoiceModel.owner_id == user_id
        ).all()
        return [VoiceSchema.from_orm(voice) for voice in voices]

    def get_global_voices(self, db: Session = Depends(get_db)):
        """Получить глобальные голоса"""
        voices = db.query(VoiceModel).filter(
            VoiceModel.owner_id.is_(None)
        ).all()
        return [VoiceSchema.from_orm(voice) for voice in voices]
    
    def get_all_voices(self, db: Session = Depends(get_db)):
        """Получить все голоса (для админки)"""
        voices = db.query(VoiceModel).all()
        return [VoiceSchema.from_orm(voice) for voice in voices]

    async def _transcribe_voice_background(self, voice_id: int, file_path: str, db: Session):
        """Фоновая транскрипция голоса"""
        try:
            if not tts_engine_manager.transcriber:
                return
            
            text = tts_engine_manager.transcribe(file_path)
            
            # Обновляем запись в базе данных
            voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
            if voice:
                voice.reference_text = text
                db.commit()
                logger.info(f"Transcribed voice {voice.name}: {text[:50]}...")
                
        except Exception as e:
            logger.error(f"Error transcribing voice {voice_id}: {e}")

    async def restart_engine(self):
        """Перезагрузить TTS движок"""
        try:
            logger.info("Restarting TTS engine...")
            
            # Останавливаем текущий движок
            await tts_engine_manager.shutdown()
            
            # Инициализируем заново
            await tts_engine_manager.initialize()
            
            logger.info("TTS engine restarted successfully")
            return {"message": "TTS engine restarted successfully", "status": "ready"}
            
        except Exception as e:
            logger.error(f"Error restarting TTS engine: {e}")
            return {"error": f"Failed to restart TTS engine: {str(e)}", "status": "error"}

# Глобальный экземпляр
tts_api = TTSAPIEndpoints()
