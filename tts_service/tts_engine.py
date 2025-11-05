# tts_service/tts_engine.py
import logging
import asyncio
from pathlib import Path
from tts_service.TTS_rus_engine.russian_tts import RussianTTS
from tts_service.config import config

logger = logging.getLogger(__name__)

class TTSEngineManager:
    def __init__(self):
        self.tts_engine = None
        self.transcriber = None
        self.is_initialized = False

    async def initialize(self):
        """Инициализация TTS движка (только F5-TTS)"""
        try:
            logger.info("Initializing AI TTS engine (F5-TTS)...")
            
            # Инициализация AI TTS движка (F5-TTS)
            self.tts_engine = RussianTTS()
            # RussianTTS инициализируется в __init__, поэтому await не нужен
            
            # Инициализация транскрипции с faster-whisper для лучшей производительности
            # Можно отключить через переменную окружения DISABLE_TRANSCRIPTION=true
            import os
            if os.getenv("DISABLE_TRANSCRIPTION", "false").lower() == "true":
                logger.info("Transcription disabled via DISABLE_TRANSCRIPTION env variable")
                self.transcriber = None
            else:
                try:
                    from faster_whisper import WhisperModel
                    
                    # Путь к кешу для faster-whisper
                    cache_dir = Path(__file__).parent / "f5_tts_cache"
                    cache_dir.mkdir(exist_ok=True)
                    
                    # Пытаемся загрузить из локального кеша сначала
                    try:
                        # Используем faster-whisper с turbo моделью для максимальной скорости
                        self.transcriber = WhisperModel(
                            "turbo", 
                            device="auto", 
                            compute_type="auto",
                            download_root=str(cache_dir),
                            local_files_only=True  # Сначала пытаемся использовать только локальные файлы
                        )
                        logger.info("Faster-Whisper turbo transcriber loaded from cache")
                    except Exception as cache_error:
                        logger.info(f"Turbo model not in cache, downloading: {cache_error}")
                        # Если в кеше нет, загружаем
                        self.transcriber = WhisperModel(
                            "turbo", 
                            device="auto", 
                            compute_type="auto",
                            download_root=str(cache_dir)
                        )
                        logger.info("Faster-Whisper turbo transcriber downloaded and loaded")
                except Exception as e:
                    logger.warning(f"Failed to load Faster-Whisper turbo model, trying base: {e}")
                    try:
                        # Fallback на base модель если turbo не загрузится
                        cache_dir = Path(__file__).parent / "f5_tts_cache"
                        cache_dir.mkdir(exist_ok=True)
                        
                        try:
                            self.transcriber = WhisperModel(
                                "base", 
                                device="auto", 
                                compute_type="auto",
                                download_root=str(cache_dir),
                                local_files_only=True
                            )
                            logger.info("Faster-Whisper base transcriber loaded from cache")
                        except Exception as cache_error:
                            self.transcriber = WhisperModel(
                                "base", 
                                device="auto", 
                                compute_type="auto",
                                download_root=str(cache_dir)
                            )
                            logger.info("Faster-Whisper base transcriber downloaded and loaded")
                    except Exception as e2:
                        logger.warning(f"Failed to load Faster-Whisper, disabling transcription: {e2}")
                        # Транскрипция не критична для TTS, можно работать без неё
                        self.transcriber = None
                        logger.info("TTS will work without transcription support")
            
            self.is_initialized = True
            logger.info("TTS engine initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize TTS engine: {e}")
            self.is_initialized = False
            raise

    async def shutdown(self):
        """Завершение работы TTS движка"""
        try:
            if self.tts_engine:
                # Проверяем, есть ли метод cleanup у движка
                if hasattr(self.tts_engine, 'cleanup'):
                    await self.tts_engine.cleanup()
                else:
                    logger.info("TTS engine does not have cleanup method, skipping")
                self.tts_engine = None
            
            self.transcriber = None
            self.is_initialized = False
            logger.info("TTS engine shutdown completed")
            
        except Exception as e:
            logger.error(f"Error during TTS engine shutdown: {e}")

    def is_ready(self) -> bool:
        """Проверка готовности движка"""
        return (self.is_initialized and 
                self.tts_engine is not None and 
                hasattr(self.tts_engine, 'is_ready') and 
                self.tts_engine.is_ready())

    async def synthesize(self, text: str, voice_name: str, output_path: str, **kwargs) -> bool:
        """Синтез речи"""
        if not self.is_ready():
            raise RuntimeError("TTS engine not initialized")
        
        try:
            return await self.tts_engine.synthesize(text, voice_name, output_path, **kwargs)
        except Exception as e:
            logger.error(f"Error during synthesis: {e}")
            raise
    
    async def synthesize_speech_async(
        self, 
        text: str, 
        voice: str = "female_1", 
        user_id: int = None,
        channel_name: str = None,
        author: str = None,
        word_filter: list = None,
        blocked_users: list = None,
        volume: float = 50.0,
        tts_settings: dict = None
    ) -> dict:
        """
        Асинхронный синтез речи для channel messages
        
        Args:
            text: Текст для озвучивания
            voice: Голос для синтеза
            user_id: ID пользователя (для логирования)
            channel_name: Имя канала
            author: Автор сообщения
            word_filter: Список запрещенных слов
            blocked_users: Список заблокированных пользователей
            volume: Уровень громкости (0-100)
            tts_settings: Дополнительные настройки TTS (включая voice_settings)
            
        Returns:
            dict: Результат синтеза {"success": bool, "audio_url": str, ...}
        """
        if not self.is_ready():
            return {"success": False, "error": "TTS engine not initialized"}
        
        try:
            logger.info(f"🎙️ Synthesizing for {channel_name} | {author}: '{text[:50]}...'")
            
            # Получаем информацию о голосе из БД
            from tts_service.database import SessionLocal, Voice as VoiceModel
            db = SessionLocal()
            try:
                voice_record = db.query(VoiceModel).filter(VoiceModel.name == voice).first()
                if not voice_record:
                    logger.warning(f"Voice '{voice}' not found in DB, using default")
                    # Используем дефолтный голос female_1
                    voice_record = db.query(VoiceModel).filter(VoiceModel.name == "female_1").first()
                    if not voice_record:
                        return {"success": False, "error": "No voices available"}
                
                ref_audio_path = voice_record.file_path
                ref_text = voice_record.reference_text or ""
                
                # Извлекаем voice_settings из tts_settings если есть
                voice_settings = (tts_settings or {}).get("voice_settings", {}) if tts_settings else {}
                cfg_strength = voice_settings.get("cfg_strength") or voice_record.cfg_strength
                speed_preset = voice_settings.get("speed_preset") or voice_record.speed_preset
                
                if voice_settings:
                    logger.info(f"🎛️ Using custom voice settings: cfg={cfg_strength}, speed={speed_preset}")
                
            finally:
                db.close()
            
            # Выполняем синтез в executor для неблокирующей работы
            loop = asyncio.get_event_loop()
            audio_path = await loop.run_in_executor(
                None,
                self.tts_engine.synthesize_speech,
                text,
                ref_audio_path,  # ✅ Путь к референсному аудио из БД
                ref_text,  # ✅ Референсный текст из БД
                None,  # speed (определяется автоматически)
                None,  # nfe_step (определяется автоматически)
                None,  # fix_duration
                False,  # remove_silence
                None,  # seed
                cfg_strength,  # ✅ Применяем персональный cfg_strength
                None,  # target_rms (определяется автоматически)
                speed_preset  # ✅ Применяем персональный speed_preset
            )
            
            if audio_path and Path(audio_path).exists():
                logger.info(f"✅ Speech synthesized: {audio_path}")
                # Формируем URL для аудио относительно audio директории
                from tts_service.config import config
                audio_path_obj = Path(audio_path).resolve()
                abs_audio_path = config.audio_path.resolve()
                
                try:
                    # Получаем относительный путь от audio директории
                    relative_path = audio_path_obj.relative_to(abs_audio_path)
                    audio_url = f"/audio/{relative_path.as_posix()}"
                except ValueError:
                    # Если файл находится вне audio, используем только имя файла
                    audio_url = f"/audio/{audio_path_obj.name}"
                
                return {
                    "success": True,
                    "audio_url": audio_url,
                    "audio_path": str(audio_path),  # Сохраняем также полный путь для совместимости
                    "voice": voice,
                    "duration": 0,  # TODO: вычислить реальную длительность
                    "tts_type": "f5"
                }
            else:
                logger.error("❌ TTS synthesis failed: no audio file generated")
                return {"success": False, "error": "No audio file generated"}
                
        except Exception as e:
            logger.error(f"❌ TTS synthesis error: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def synthesize_with_conversion_async(
        self, 
        text: str, 
        voice: str = "female_1", 
        user_id: int = None,
        target_format: str = "wav",
        target_sample_rate: int = 22050
    ) -> str:
        """
        Асинхронный синтез с конвертацией аудио
        
        Args:
            text: Текст для озвучивания
            voice: Голос для синтеза
            user_id: ID пользователя
            target_format: Целевой формат аудио
            target_sample_rate: Целевая частота дискретизации
            
        Returns:
            str: Путь к сгенерированному и сконвертированному аудио файлу
        """
        try:
            # Импортируем асинхронные компоненты
            from async_tts_engine import async_tts_engine
            from async_audio_converter import async_audio_converter
            
            # Синтезируем речь
            synthesis_task_id = await async_tts_engine.synthesize_speech_async(
                text=text,
                voice=voice,
                user_id=user_id
            )
            
            # Ждем завершения синтеза
            synthesis_result = None
            max_wait_time = 30  # 30 секунд максимум
            wait_time = 0
            
            while wait_time < max_wait_time:
                synthesis_result = await async_tts_engine.get_task_result(synthesis_task_id)
                if synthesis_result:
                    break
                await asyncio.sleep(0.5)
                wait_time += 0.5
            
            if not synthesis_result:
                logger.error("Synthesis task did not complete in time")
                return None
            
            # Определяем путь для конвертированного файла
            original_path = Path(synthesis_result)
            converted_path = original_path.parent / f"{original_path.stem}_converted.{target_format}"
            
            # Конвертируем аудио
            conversion_task_id = await async_audio_converter.convert_audio_async(
                input_path=str(original_path),
                output_path=str(converted_path),
                target_format=target_format,
                target_sample_rate=target_sample_rate
            )
            
            # Ждем завершения конвертации
            conversion_result = None
            wait_time = 0
            
            while wait_time < max_wait_time:
                conversion_result = await async_audio_converter.get_conversion_result(conversion_task_id)
                if conversion_result:
                    break
                await asyncio.sleep(0.5)
                wait_time += 0.5
            
            if not conversion_result:
                logger.error("Audio conversion task did not complete in time")
                return synthesis_result  # Возвращаем оригинальный файл
            
            # Удаляем оригинальный файл после успешной конвертации
            try:
                if original_path.exists():
                    original_path.unlink()
                    logger.info(f"Removed original file after conversion: {original_path}")
            except Exception as e:
                logger.warning(f"Failed to remove original file: {e}")
            
            logger.info(f"Speech synthesized and converted successfully: {conversion_result}")
            return conversion_result
            
        except Exception as e:
            logger.error(f"Async synthesis with conversion error: {e}")
            return None

    def transcribe(self, audio_path: str) -> str:
        """Транскрипция аудио с оптимизацией для русского языка"""
        if not self.transcriber:
            raise RuntimeError("Transcriber not available")
        
        try:
            # Проверяем тип транскрибера (faster-whisper или оригинальный whisper)
            if hasattr(self.transcriber, 'transcribe') and hasattr(self.transcriber.transcribe, '__call__'):
                # Faster-Whisper API
                segments, info = self.transcriber.transcribe(
                    audio_path,
                    language="ru",  # Явно указываем русский язык
                    task="transcribe",  # Только транскрибация, не перевод
                    beam_size=5,  # Оптимальный баланс скорости и качества
                    best_of=5,  # Количество попыток для лучшего результата
                    patience=1,  # Быстрая обработка
                    length_penalty=1,  # Нормальная длина
                    temperature=0.0,  # Детерминированный результат
                    compression_ratio_threshold=2.4,  # Фильтр повторений
                    log_prob_threshold=-1.0,  # Минимальный порог вероятности
                    no_speech_threshold=0.6,  # Порог для определения речи
                    condition_on_previous_text=True,  # Учитывать предыдущий текст
                    prompt_reset_on_temperature=0.5,  # Сброс промпта при высокой температуре
                    initial_prompt=None,  # Без начального промпта
                    prefix=None,  # Без префикса
                    suppress_blank=True,  # Подавлять пустые сегменты
                    suppress_tokens=[-1],  # Подавлять токены
                    without_timestamps=True,  # Без временных меток
                    max_initial_timestamp=0.0,  # Максимальная начальная метка
                    word_timestamps=False,  # Без временных меток слов
                    vad_filter=True,  # Фильтр VAD для лучшего качества
                    vad_parameters=dict(min_silence_duration_ms=500)  # Параметры VAD
                )
                
                # Собираем текст из сегментов
                text_parts = []
                for segment in segments:
                    text_parts.append(segment.text.strip())
                
                text = " ".join(text_parts)
                
            else:
                # Оригинальный Whisper API (fallback)
                result = self.transcriber.transcribe(
                    audio_path,
                    language="ru",  # Явно указываем русский язык
                    task="transcribe",  # Только транскрибация, не перевод
                    fp16=False,  # Используем fp32 для лучшего качества
                    verbose=False  # Отключаем подробный вывод
                )
                
                # Очищаем и форматируем текст
                text = result["text"].strip()
            
            # Убираем лишние пробелы и переносы строк
            text = " ".join(text.split())
            
            logger.info(f"Transcription completed: {len(text)} characters")
            return text
            
        except Exception as e:
            logger.error(f"Error during transcription: {e}")
            raise

# Глобальный экземпляр
tts_engine_manager = TTSEngineManager()
