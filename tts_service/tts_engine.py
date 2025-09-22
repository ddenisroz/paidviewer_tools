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
            
            # Инициализация транскрипции (если нужно)
            try:
                import whisper
                self.transcriber = whisper.load_model("base")
                logger.info("Whisper transcriber loaded successfully")
            except Exception as e:
                logger.warning(f"Failed to load Whisper transcriber: {e}")
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
        return self.is_initialized and self.tts_engine is not None

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
        """Транскрипция аудио"""
        if not self.transcriber:
            raise RuntimeError("Transcriber not available")
        
        try:
            result = self.transcriber.transcribe(audio_path)
            return result["text"].strip()
        except Exception as e:
            logger.error(f"Error during transcription: {e}")
            raise

# Глобальный экземпляр
tts_engine_manager = TTSEngineManager()
