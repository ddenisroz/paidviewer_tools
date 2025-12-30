# tts_service/api_endpoints.py
import logging
import time
import json
import os
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from tts_service.database import get_db, Voice as VoiceModel, User as UserModel, UserVoiceEnabled
from tts_service.models import *
from tts_service.tts_engine import tts_engine_manager
from tts_service.file_manager import file_manager
from tts_service.background_tasks import background_task_manager
from tts_service.tts_limits_service import tts_limits_service

logger = logging.getLogger(__name__)

# Создаем роутер
tts_api = APIRouter(tags=["tts"])

class TTSAPIEndpoints:
    def __init__(self):
        pass

    async def health_check(self):
        """Проверка здоровья сервиса"""
        health_data = {
            "status": "healthy", 
            "tts_engine_loaded": tts_engine_manager.is_ready(),
            "timestamp": time.time()
        }
        
        # Добавляем информацию о GPU, если доступно
        try:
            from tts_service.gpu_worker_pool import gpu_worker_pool
            from tts_service.gpu_monitor import gpu_health_monitor
            
            if hasattr(gpu_worker_pool, 'running') and gpu_worker_pool.running:
                gpu_stats = gpu_worker_pool.get_stats()
                gpu_health = gpu_health_monitor.get_health_summary()
                
                health_data.update({
                    "gpu_available": True,
                    "gpu_status": gpu_health.get('status', 'unknown'),
                    "gpu_health_score": gpu_health.get('health_score', 0),
                    "gpu_memory_usage": gpu_health.get('memory_usage_percent', 0),
                    "gpu_concurrent_workers": gpu_stats.get('current_concurrent', 0)
                })
            else:
                health_data["gpu_available"] = False
                
        except Exception as e:
            health_data["gpu_available"] = False
            health_data["gpu_error"] = str(e)
        
        return health_data

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

    async def synthesize_speech_async(
        self,
        request: SynthesisRequest,
        db: Session = Depends(get_db)
    ):
        """Асинхронный синтез речи через воркеры с проверкой ограничений"""
        try:
            # Проверяем ограничения пользователя
            if request.user_id:
                is_allowed, message, limits = tts_limits_service.validate_request(
                    request.user_id, request.text, db
                )
                if not is_allowed:
                    raise HTTPException(status_code=429, detail=message)
            
            # Импортируем менеджер воркеров
            from tts_service.async_worker_manager import async_worker_manager
            
            if not async_worker_manager.running:
                raise HTTPException(status_code=503, detail="Worker manager not available")
            
            # Создаем задачу
            task_data = {
                'task_id': f"task_{int(time.time() * 1000)}_{request.user_id or 'unknown'}",
                'text': request.text,
                'voice': request.voice_name,
                'user_id': request.user_id,
                'priority': getattr(request, 'priority', 2),  # По умолчанию NORMAL
                'created_at': time.time()
            }
            
            # Отправляем в Redis Stream
            import redis
            redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'), decode_responses=True)
            redis_client.xadd('tts_requests', {'data': json.dumps(task_data)})
            
            return {
                "task_id": task_data['task_id'],
                "status": "submitted",
                "message": "Task submitted to async workers",
                "timestamp": time.time(),
                "limits": limits if request.user_id else None
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error submitting async task: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to submit task: {str(e)}")

    async def get_task_result(self, task_id: str):
        """Получить результат асинхронной задачи"""
        try:
            import redis
            redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'), decode_responses=True)
            
            # Читаем результаты из Redis Stream
            messages = redis_client.xread({'tts_results': '0'}, count=100)
            
            for stream_name, stream_messages in messages:
                for message_id, fields in stream_messages:
                    if fields.get('task_id') == task_id:
                        return {
                            "task_id": task_id,
                            "status": fields.get('status'),
                            "result_path": fields.get('result_path'),
                            "error": fields.get('error'),
                            "processing_time": float(fields.get('processing_time', 0)),
                            "completed_at": float(fields.get('completed_at', 0)),
                            "worker_id": fields.get('worker_id')
                        }
            
            return {
                "task_id": task_id,
                "status": "not_found",
                "message": "Task not found or not completed"
            }
            
        except Exception as e:
            logger.error(f"Error getting task result: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get task result: {str(e)}")

    async def synthesize_speech(
        self,
        background_tasks: BackgroundTasks,
        request: SynthesisRequest,
        db: Session = Depends(get_db)
    ):
        """Синтез речи с применением громкости к выходному файлу (legacy)"""
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
            
            logger.info(f"[RECEIVE] Request params: cfg_strength={cfg_strength}, speed_preset={speed_preset}")
            logger.info(f"[STATS] Voice defaults: cfg_strength={voice.cfg_strength}, speed_preset={voice.speed_preset}")
            
            synthesis_params = {
                "cfg_strength": cfg_strength if cfg_strength is not None else voice.cfg_strength,
                "speed_preset": speed_preset if speed_preset is not None else voice.speed_preset,
                "volume_level": getattr(request, 'volume_level', 50.0)  # Громкость по умолчанию 50%
            }
            
            logger.info(f"[SETTINGS] Final synthesis params: {synthesis_params}")
            
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
                duration=0.0
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
    
    # === TTS Limits Management ===
    
    def get_user_tts_limits(self, user_id: int, db: Session = Depends(get_db)):
        """Получить настройки TTS пользователя"""
        try:
            limits = tts_limits_service.get_user_limits(user_id, db)
            current_usage = tts_limits_service.get_daily_usage(user_id, datetime.now().date(), db)
            
            return UserTTSLimitsResponse(
                max_text_length=limits['max_text_length'],
                daily_limit=limits['daily_limit'],
                gpu_time_limit=limits['gpu_time_limit'],
                priority_level=limits['priority_level'],
                tts_enabled=limits['tts_enabled'],
                current_usage=current_usage
            )
        except Exception as e:
            logger.error(f"Error getting user TTS limits: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get user limits: {str(e)}")
    
    def update_user_tts_limits(self, user_id: int, limits: UserTTSLimitsSchema, db: Session = Depends(get_db)):
        """Обновить настройки TTS пользователя"""
        try:
            success = tts_limits_service.update_user_limits(
                user_id, 
                limits.dict(exclude_unset=True), 
                db
            )
            
            if not success:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Возвращаем обновленные настройки
            updated_limits = tts_limits_service.get_user_limits(user_id, db)
            current_usage = tts_limits_service.get_daily_usage(user_id, datetime.now().date(), db)
            
            return UserTTSLimitsResponse(
                max_text_length=updated_limits['max_text_length'],
                daily_limit=updated_limits['daily_limit'],
                gpu_time_limit=updated_limits['gpu_time_limit'],
                priority_level=updated_limits['priority_level'],
                tts_enabled=updated_limits['tts_enabled'],
                current_usage=current_usage
            )
        except Exception as e:
            logger.error(f"Error updating user TTS limits: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update user limits: {str(e)}")
    
    def get_user_tts_stats(self, user_id: int, days: int = 7, db: Session = Depends(get_db)):
        """Получить статистику использования TTS пользователя"""
        try:
            stats = tts_limits_service.get_user_stats(user_id, days, db)
            return UserTTSUsageSchema(**stats)
        except Exception as e:
            logger.error(f"Error getting user TTS stats: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get user stats: {str(e)}")
    
    def get_global_tts_stats(self, days: int = 7, db: Session = Depends(get_db)):
        """Получить глобальную статистику TTS"""
        try:
            stats = tts_limits_service.get_global_stats(days, db)
            return GlobalTTSStatsSchema(**stats)
        except Exception as e:
            logger.error(f"Error getting global TTS stats: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get global stats: {str(e)}")
    
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

    async def get_gpu_status(self):
        """Получить статус GPU Worker Pool"""
        try:
            from tts_service.gpu_worker_pool import gpu_worker_pool
            from tts_service.gpu_monitor import gpu_health_monitor
            
            if not hasattr(gpu_worker_pool, 'running') or not gpu_worker_pool.running:
                return {
                    "available": False,
                    "message": "GPU Worker Pool not available"
                }
            
            stats = gpu_worker_pool.get_stats()
            health = gpu_health_monitor.get_health_summary()
            gpu_metrics = gpu_worker_pool.get_gpu_metrics()
            
            return {
                "available": True,
                "running": gpu_worker_pool.running,
                "stats": stats,
                "health": health,
                "gpu_metrics": gpu_metrics.__dict__ if gpu_metrics else None,
                "timestamp": time.time()
            }
            
        except Exception as e:
            logger.error(f"Error getting GPU status: {e}")
            return {
                "available": False,
                "error": str(e),
                "timestamp": time.time()
            }

    async def get_gpu_health_history(self, limit: int = 50):
        """Получить историю здоровья GPU"""
        try:
            from tts_service.gpu_monitor import gpu_health_monitor
            
            history = gpu_health_monitor.get_health_history(limit)
            return {
                "history": history,
                "count": len(history),
                "timestamp": time.time()
            }
            
        except Exception as e:
            logger.error(f"Error getting GPU health history: {e}")
            return {
                "error": str(e),
                "history": [],
                "count": 0,
                "timestamp": time.time()
            }

    async def get_gpu_integration_stats(self):
        """Получить статистику GPU Integration Service"""
        try:
            from tts_service.gpu_integration import gpu_integration_service
            
            stats = gpu_integration_service.get_stats()
            cached_tasks = gpu_integration_service.get_cached_tasks()
            
            return {
                "stats": stats,
                "cached_tasks": cached_tasks,
                "cached_tasks_count": len(cached_tasks),
                "timestamp": time.time()
            }
            
        except Exception as e:
            logger.error(f"Error getting GPU integration stats: {e}")
            return {
                "error": str(e),
                "stats": {},
                "cached_tasks": {},
                "timestamp": time.time()
            }

    async def submit_gpu_task(self, text: str, voice: str = "female_1", user_id: Optional[int] = None, priority: int = 0):
        """Отправить задачу напрямую в GPU Worker Pool"""
        try:
            from tts_service.gpu_worker_pool import gpu_worker_pool
            
            if not hasattr(gpu_worker_pool, 'running') or not gpu_worker_pool.running:
                raise HTTPException(status_code=503, detail="GPU Worker Pool not available")
            
            task_id = await gpu_worker_pool.submit_task(text, voice, user_id, priority)
            
            return {
                "task_id": task_id,
                "status": "submitted",
                "message": "Task submitted to GPU Worker Pool",
                "timestamp": time.time()
            }
            
        except Exception as e:
            logger.error(f"Error submitting GPU task: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to submit GPU task: {str(e)}")

    async def get_gpu_task_result(self, task_id: str):
        """Получить результат задачи из GPU Worker Pool"""
        try:
            from tts_service.gpu_worker_pool import gpu_worker_pool
            
            if not hasattr(gpu_worker_pool, 'running') or not gpu_worker_pool.running:
                raise HTTPException(status_code=503, detail="GPU Worker Pool not available")
            
            result = await gpu_worker_pool.get_task_result(task_id)
            
            if result is None:
                raise HTTPException(status_code=404, detail="Task not found or not completed")
            
            return {
                "task_id": task_id,
                "result": result,
                "timestamp": time.time()
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting GPU task result: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get task result: {str(e)}")

@tts_api.post("/synthesize-channel")
async def synthesize_channel(request: dict):
    """
    Синтезировать аудио для канала с учетом всех настроек пользователя.
    Вызывается из bot_service для обработки сообщений в чате.
    
    Request body:
    {
        "channel_name": "yourchy",
        "text": "Hello world",
        "author": "username",
        "user_id": 1,
        "volume_level": 50,
        "tts_settings": {...},
        "word_filter": [...],
        "blocked_users": [...]
    }
    """
    try:
        channel_name = request.get("channel_name")
        text = request.get("text")
        author = request.get("author")
        user_id = request.get("user_id")
        volume_level = request.get("volume_level", 50)
        tts_settings = request.get("tts_settings", {})
        word_filter = request.get("word_filter", [])
        blocked_users = request.get("blocked_users", [])
        
        if not all([channel_name, text, author]):
            raise HTTPException(status_code=400, detail="Missing required parameters")
        
        logger.info(f"[MIC] [CHANNEL TTS] {channel_name} | {author}: {text[:50]}...")
        
        # [OK] Извлекаем голос из tts_settings, если указан
        voice = tts_settings.get("voice", "female_1") if tts_settings else "female_1"
        logger.info(f"[TTS] [CHANNEL TTS] Using voice: {voice} (from tts_settings)")
        
        # Используем tts_engine_manager для синтеза
        result = await tts_engine_manager.synthesize_speech_async(
            text=text,
            voice=voice,  # [OK] Используем голос из tts_settings
            user_id=user_id,
            channel_name=channel_name,
            author=author,
            word_filter=word_filter,
            blocked_users=blocked_users,
            volume=volume_level,
            tts_settings=tts_settings
        )
        
        if result.get("success"):
            logger.info(f"[OK] [CHANNEL TTS] Синтез успешен для {channel_name}")
            
            return {
                "success": True,
                "selected_voice": result.get("voice", "default"),
                "audio_url": result.get("audio_url"),
                "duration": result.get("duration"),
                "tts_type": result.get("tts_type", "f5")
            }
        else:
            logger.error(f"[ERROR] [CHANNEL TTS] Синтез не удался: {result.get('error')}")
            raise HTTPException(status_code=500, detail=result.get("error", "Synthesis failed"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ERROR] [CHANNEL TTS] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# Глобальный экземпляр класса (для совместимости)
tts_api_endpoints = TTSAPIEndpoints()

# Регистрируем основные эндпоинты в роутере
@tts_api.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    return await tts_api_endpoints.health_check()

@tts_api.get("/audio/{voice_name}")
async def get_audio_file(voice_name: str):
    """Получить аудио файл голоса"""
    return await tts_api_endpoints.get_audio_file(voice_name)

@tts_api.delete("/audio/{voice_name}")
async def delete_audio_file(voice_name: str):
    """Удалить аудио файл голоса"""
    return await tts_api_endpoints.delete_audio_file(voice_name)

@tts_api.get("/task/{task_id}")
async def get_task_result(task_id: str):
    """Получить результат задачи"""
    return await tts_api_endpoints.get_task_result(task_id)

@tts_api.post("/engine/restart")
async def restart_engine():
    """Перезапустить TTS движок"""
    return await tts_api_endpoints.restart_engine()

@tts_api.get("/gpu/status")
async def get_gpu_status():
    """Получить статус GPU"""
    return await tts_api_endpoints.get_gpu_status()

@tts_api.get("/gpu/health")
async def get_gpu_health_history(limit: int = 50):
    """Получить историю здоровья GPU"""
    return await tts_api_endpoints.get_gpu_health_history(limit)

@tts_api.get("/gpu/stats")
async def get_gpu_integration_stats():
    """Получить статистику GPU интеграции"""
    return await tts_api_endpoints.get_gpu_integration_stats()

@tts_api.post("/gpu/submit")
async def submit_gpu_task(text: str, voice: str = "female_1", user_id: Optional[int] = None, priority: int = 0):
    """Отправить задачу на GPU"""
    return await tts_api_endpoints.submit_gpu_task(text, voice, user_id, priority)

@tts_api.get("/gpu/task/{task_id}")
async def get_gpu_task_result(task_id: str):
    """Получить результат GPU задачи"""
    return await tts_api_endpoints.get_gpu_task_result(task_id)

@tts_api.get("/voices/global")
async def get_global_voices_endpoint(db: Session = Depends(get_db)):
    """Получить глобальные голоса (доступные всем)"""
    from tts_service.database import Voice as VoiceModel
    try:
        voices = db.query(VoiceModel).filter(VoiceModel.voice_type == 'global').all()
        return [
            {
                "id": voice.id,
                "name": voice.name,
                "voice_type": voice.voice_type,
                "file_path": voice.file_path,
                "reference_text": voice.reference_text,
                "cfg_strength": voice.cfg_strength,
                "speed_preset": voice.speed_preset,
                "created_at": voice.created_at.isoformat() if voice.created_at else None
            }
            for voice in voices
        ]
    except Exception as e:
        logger.error(f"Error getting global voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@tts_api.get("/user/voices/{user_id}")
async def get_user_voices_endpoint(user_id: int, db: Session = Depends(get_db)):
    """Получить голоса пользователя"""
    return tts_api_endpoints.get_user_voices(user_id, db)

@tts_api.post("/user/voices/upload")
async def upload_user_voice_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    user_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """Загрузить пользовательский голос с автоматической конвертацией и транскрибацией"""
    import tempfile
    import shutil
    
    temp_input_path = None
    temp_converted_path = None
    final_voice_path = None
    
    try:
        # Проверка типа файла
        allowed_extensions = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.aiff', '.au']
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Неподдерживаемый формат файла. Разрешены: {', '.join(allowed_extensions)}"
            )
        
        # Проверка дубликатов
        existing_voice = db.query(VoiceModel).filter(
            VoiceModel.name == voice_name,
            VoiceModel.owner_id == user_id
        ).first()
        if existing_voice:
            raise HTTPException(status_code=400, detail=f"Голос с именем '{voice_name}' уже существует")
        
        # Сохраняем загруженный файл во временную директорию
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_input_path = temp_file.name
        
        logger.info(f"[RECEIVE] User voice uploaded to temp: {temp_input_path}")
        
        # Конвертируем в WAV с требованиями F5-TTS
        temp_converted_path = tempfile.mktemp(suffix='.wav')
        
        from tts_service.async_audio_converter import AsyncAudioConverter
        converter = AsyncAudioConverter(max_workers=1)
        await converter.start_workers()
        
        try:
            success = converter._convert_audio_sync(temp_input_path, temp_converted_path, "user_upload_task")
            if not success:
                raise Exception("Audio conversion failed")
            
            logger.info(f"[OK] Audio converted to WAV: {temp_converted_path}")
        finally:
            await converter.stop_workers()
        
        # Автоматическая транскрибация
        reference_text = ""
        try:
            if tts_engine_manager.transcriber:
                reference_text = tts_engine_manager.transcribe(temp_converted_path)
                logger.info(f"[OK] Audio transcribed: '{reference_text[:50]}...'")
            else:
                logger.warning("[WARN] Transcriber not available, skipping transcription")
        except Exception as e:
            logger.warning(f"[WARN] Transcription failed: {e}, continuing without reference text")
        
        # Сохраняем в финальную директорию
        # [OK] Используем абсолютный путь из config для надежности
        from tts_service.config import config
        voices_dir = config.user_voices_path / str(user_id)
        voices_dir.mkdir(parents=True, exist_ok=True)
        
        # ВСЕГДА сохраняем как WAV
        safe_filename = f"{voice_name}.wav"
        final_voice_path = voices_dir / safe_filename
        
        # Копируем конвертированный файл
        shutil.copy2(temp_converted_path, final_voice_path)
        
        logger.info(f"[OK] User voice saved: {final_voice_path}")
        
        # Используем значения из конфига для дефолтных настроек
        from tts_service.config import config
        # Создаём запись в БД
        new_voice = VoiceModel(
            name=voice_name,
            voice_type='user',
            file_path=str(final_voice_path),
            reference_text=reference_text or None,
            owner_id=user_id,
            is_active=True,
            is_global=False,  # User-uploaded voices are not global
            cfg_strength=config.cfg_strength,  # Используем значение из конфига (по умолчанию 2.5)
            speed_preset='normal'  # Константа для скорости по умолчанию
        )
        db.add(new_voice)
        db.commit()
        db.refresh(new_voice)
        
        logger.info(f"[OK] User voice '{voice_name}' uploaded for user {user_id} (ID: {new_voice.id})")
        
        return {
            "status": "success",
            "message": f"Голос '{voice_name}' успешно загружен, конвертирован и транскрибирован",
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
        logger.error(f"User voice upload error: {e}")
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
            except OSError:
                pass
        
        if temp_converted_path and os.path.exists(temp_converted_path):
            try:
                os.unlink(temp_converted_path)
            except OSError:
                pass

@tts_api.delete("/user/voices/{voice_id}")
async def delete_user_voice_endpoint(voice_id: int, user_id: int, db: Session = Depends(get_db)):
    """Удалить пользовательский голос"""
    try:
        voice = db.query(VoiceModel).filter(
            VoiceModel.id == voice_id,
            VoiceModel.owner_id == user_id
        ).first()
        
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found or access denied")
        
        # Удаляем файл
        if voice.file_path and os.path.exists(voice.file_path):
            try:
                os.remove(voice.file_path)
                logger.info(f"Deleted voice file: {voice.file_path}")
            except Exception as e:
                logger.error(f"Error deleting file: {e}")
        
        # Удаляем запись из БД
        db.delete(voice)
        db.commit()
        
        return {"status": "success", "message": "Voice deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete voice error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@tts_api.put("/user/voices/{voice_id}/rename")
async def rename_user_voice_endpoint(
    voice_id: int, 
    user_id: int = Query(..., description="User ID"),
    new_name: str = Form(...), 
    db: Session = Depends(get_db)
):
    """Переименовать пользовательский голос"""
    try:
        voice = db.query(VoiceModel).filter(
            VoiceModel.id == voice_id,
            VoiceModel.owner_id == user_id
        ).first()
        
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found or access denied")
        
        # Проверка дубликатов
        existing_voice = db.query(VoiceModel).filter(
            VoiceModel.name == new_name,
            VoiceModel.owner_id == user_id,
            VoiceModel.id != voice_id
        ).first()
        if existing_voice:
            raise HTTPException(status_code=400, detail=f"Voice with name '{new_name}' already exists")
        
        voice.name = new_name
        db.commit()
        
        return {"status": "success", "message": "Voice renamed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rename voice error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@tts_api.post("/user/voices/{voice_id}/transcribe")
async def transcribe_user_voice_endpoint(voice_id: int, user_id: int, db: Session = Depends(get_db)):
    """Транскрибировать пользовательский голос"""
    try:
        voice = db.query(VoiceModel).filter(
            VoiceModel.id == voice_id,
            VoiceModel.owner_id == user_id
        ).first()
        
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found or access denied")
        
        # Проверяем, что файл существует
        if not voice.file_path or not os.path.exists(voice.file_path):
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        logger.info(f"[REFRESH] Transcribing user voice {voice_id} ({voice.name})")
        
        # Транскрибируем аудио
        reference_text = ""
        try:
            if tts_engine_manager.transcriber:
                reference_text = tts_engine_manager.transcribe(voice.file_path)
                logger.info(f"[OK] Transcribed: '{reference_text[:50]}...'")
            else:
                raise Exception("Transcriber not available")
        except Exception as e:
            logger.error(f"[ERROR] Transcription failed: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка транскрибации: {str(e)}")
        
        # Обновляем reference_text в БД
        voice.reference_text = reference_text
        db.commit()
        db.refresh(voice)
        
        return {
            "status": "success",
            "message": "Voice transcribed successfully",
            "reference_text": reference_text
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcribe voice error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@tts_api.post("/user/voices/{voice_id}/retranscribe")
async def retranscribe_user_voice_endpoint(voice_id: int, user_id: int, db: Session = Depends(get_db)):
    """Перетранскрибировать пользовательский голос"""
    try:
        voice = db.query(VoiceModel).filter(
            VoiceModel.id == voice_id,
            VoiceModel.owner_id == user_id
        ).first()
        
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found or access denied")
        
        # Проверяем, что файл существует
        if not voice.file_path or not os.path.exists(voice.file_path):
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        logger.info(f"[REFRESH] Retranscribing user voice {voice_id} ({voice.name})")
        
        # Транскрибируем аудио заново
        reference_text = ""
        try:
            if tts_engine_manager.transcriber:
                reference_text = tts_engine_manager.transcribe(voice.file_path)
                logger.info(f"[OK] Retranscribed: '{reference_text[:50]}...'")
            else:
                raise Exception("Transcriber not available")
        except Exception as e:
            logger.error(f"[ERROR] Transcription failed: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка транскрибации: {str(e)}")
        
        # Обновляем reference_text в БД
        voice.reference_text = reference_text
        db.commit()
        db.refresh(voice)
        
        return {
            "status": "success",
            "message": "Voice retranscribed successfully",
            "reference_text": reference_text
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Retranscribe voice error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@tts_api.put("/user/voices/{voice_id}/settings")
async def update_user_voice_settings_endpoint(
    voice_id: int,
    user_id: int,
    settings: dict,
    db: Session = Depends(get_db)
):
    """Обновить настройки пользовательского голоса (reference_text, cfg_strength, speed_preset)"""
    try:
        voice = db.query(VoiceModel).filter(
            VoiceModel.id == voice_id,
            VoiceModel.owner_id == user_id
        ).first()
        
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found or access denied")
        
        # Обновляем доступные настройки
        if 'reference_text' in settings:
            voice.reference_text = settings['reference_text']
        
        if 'cfg_strength' in settings:
            voice.cfg_strength = settings['cfg_strength']
        
        if 'speed_preset' in settings:
            voice.speed_preset = settings['speed_preset']
        
        db.commit()
        db.refresh(voice)
        
        logger.info(f"[OK] User voice {voice_id} settings updated")
        
        return {
            "status": "success",
            "message": "Voice settings updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update voice settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Global voices endpoints

@tts_api.get("/voices/global")
async def get_global_voices(db: Session = Depends(get_db)):
    """Get all global voices (admin-uploaded voices available to all users)"""
    try:
        voices = db.query(VoiceModel).filter(
            VoiceModel.is_global.is_(True),
            VoiceModel.is_active.is_(True)
        ).all()
        
        return [
            {
                "id": voice.id,
                "name": voice.name,
                "voice_type": voice.voice_type,
                "is_global": voice.is_global,
                "is_active": voice.is_active,
                "cfg_strength": voice.cfg_strength,
                "speed_preset": voice.speed_preset,
                "reference_text": voice.reference_text,
                "created_at": voice.created_at.isoformat() if voice.created_at else None
            }
            for voice in voices
        ]
    except Exception as e:
        logger.error(f"Error fetching global voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tts_api.get("/voices/{voice_id}")
async def get_voice_by_id(voice_id: int, db: Session = Depends(get_db)):
    """Get a specific voice by ID"""
    try:
        voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
        
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        
        return {
            "id": voice.id,
            "name": voice.name,
            "voice_type": voice.voice_type,
            "owner_id": voice.owner_id,
            "is_global": voice.is_global,
            "is_active": voice.is_active,
            "cfg_strength": voice.cfg_strength,
            "speed_preset": voice.speed_preset,
            "reference_text": voice.reference_text,
            "created_at": voice.created_at.isoformat() if voice.created_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tts_api.put("/user/voices/{voice_id}/settings")
async def update_user_voice_settings(
    voice_id: int,
    settings: dict,
    db: Session = Depends(get_db)
):
    """Update settings for a user's custom voice"""
    try:
        voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
        
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        
        # Only allow updating custom voices (not global)
        if voice.is_global:
            raise HTTPException(
                status_code=403,
                detail="Cannot modify global voice settings. Use personal settings instead."
            )
        
        # Update settings
        if 'cfg_strength' in settings:
            voice.cfg_strength = settings['cfg_strength']
        if 'speed_preset' in settings:
            voice.speed_preset = settings['speed_preset']
        
        db.commit()
        db.refresh(voice)
        
        logger.info(f"[OK] Updated custom voice {voice_id} settings")
        
        return {
            "success": True,
            "message": "Voice settings updated",
            "settings": {
                "cfg_strength": voice.cfg_strength,
                "speed_preset": voice.speed_preset
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating voice settings: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@tts_api.delete("/user/voices/{voice_id}")
async def delete_user_voice(
    voice_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Delete a user's custom voice"""
    try:
        voice = db.query(VoiceModel).filter(
            VoiceModel.id == voice_id,
            VoiceModel.owner_id == user_id,
            VoiceModel.is_global == False
        ).first()
        
        if not voice:
            raise HTTPException(
                status_code=404,
                detail="Voice not found or access denied"
            )
        
        # Delete the voice file
        if voice.file_path and os.path.exists(voice.file_path):
            try:
                os.remove(voice.file_path)
                logger.info(f"[OK] Deleted voice file: {voice.file_path}")
            except Exception as e:
                logger.warning(f"[WARN] Failed to delete voice file: {e}")
        
        # Delete from database
        db.delete(voice)
        db.commit()
        
        logger.info(f"[OK] User {user_id} deleted custom voice {voice_id}")
        
        return {
            "success": True,
            "message": "Voice deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting voice: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
