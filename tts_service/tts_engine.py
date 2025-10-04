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
        """Инициализация TTS движка"""
        try:
            logger.info("Initializing TTS engine...")
            
            # Инициализация TTS движка
            self.tts_engine = RussianTTS()
            # RussianTTS инициализируется в __init__, поэтому await не нужен
            
            # Инициализация транскрипции с faster-whisper для лучшей производительности
            try:
                from faster_whisper import WhisperModel
                # Используем faster-whisper с turbo моделью для максимальной скорости
                self.transcriber = WhisperModel("turbo", device="auto", compute_type="auto")
                logger.info("Faster-Whisper turbo transcriber loaded successfully")
            except Exception as e:
                logger.warning(f"Failed to load Faster-Whisper turbo model, trying base: {e}")
                try:
                    # Fallback на base модель если medium не загрузится
                    self.transcriber = WhisperModel("base", device="auto", compute_type="auto")
                    logger.info("Faster-Whisper base transcriber loaded as fallback")
                except Exception as e2:
                    logger.warning(f"Failed to load Faster-Whisper, trying original Whisper: {e2}")
                    try:
                        # Fallback на оригинальный Whisper
                        import whisper
                        self.transcriber = whisper.load_model("base")
                        logger.info("Original Whisper base transcriber loaded as final fallback")
                    except Exception as e3:
                        logger.warning(f"Failed to load any transcriber: {e3}")
                        self.transcriber = None
            
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
