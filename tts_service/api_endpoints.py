# tts_service/api_endpoints.py
import logging
import time
import json
import os
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional

from tts_service.database import get_db, Voice as VoiceModel, User as UserModel
from tts_service.models import *
from tts_service.tts_engine import tts_engine_manager
from tts_service.file_manager import file_manager
from tts_service.background_tasks import background_task_manager
from tts_service.prometheus_metrics import tts_prometheus_metrics
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
            
            # Записываем метрики
            tts_prometheus_metrics.record_tts_request(
                voice=request.voice_name,
                platform="api",
                status="submitted",
                processing_type="async"
            )
            if request.user_id:
                tts_prometheus_metrics.record_tts_request_by_user(request.user_id, "api")
            
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
        
        logger.info(f"🎙️ [CHANNEL TTS] {channel_name} | {author}: {text[:50]}...")
        
        # Используем tts_engine_manager для синтеза
        result = await tts_engine_manager.synthesize_speech_async(
            text=text,
            voice="default",
            user_id=user_id,
            channel_name=channel_name,
            author=author,
            word_filter=word_filter,
            blocked_users=blocked_users,
            volume=volume_level,
            tts_settings=tts_settings
        )
        
        if result.get("success"):
            # Обновляем метрики
            tts_prometheus_metrics.tts_synthesis_success.inc()
            logger.info(f"✅ [CHANNEL TTS] Синтез успешен для {channel_name}")
            
            return {
                "success": True,
                "selected_voice": result.get("voice", "default"),
                "audio_url": result.get("audio_url"),
                "duration": result.get("duration"),
                "tts_type": result.get("tts_type", "f5")
            }
        else:
            tts_prometheus_metrics.tts_synthesis_errors.inc()
            logger.error(f"❌ [CHANNEL TTS] Синтез не удался: {result.get('error')}")
            raise HTTPException(status_code=500, detail=result.get("error", "Synthesis failed"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [CHANNEL TTS] Ошибка: {e}")
        tts_prometheus_metrics.tts_synthesis_errors.inc()
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
