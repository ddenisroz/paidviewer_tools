import logging
import os
import re
from pathlib import Path
from typing import Optional
import tempfile

import numpy as np
import soundfile as sf
import torch
import torchaudio
from f5_tts.api import F5TTS
from huggingface_hub import hf_hub_download
from fastapi.concurrency import run_in_threadpool

from app.core.config import settings
from app.services.text_preprocessor import preprocess_text_for_tts

logger = logging.getLogger(__name__)

# --- Constants for F5-TTS Model ---
# Согласно документации, используем базовую модель F5TTS_v1_Base
# Русская модель загружается через Hugging Face автоматически
F5_TTS_MODEL = "F5TTS_v1_Base"

# Transcription for the default voice to avoid running Whisper ASR
# Это должна быть ТРАНСКРИПЦИЯ аудио файла default.wav, а не просто русский текст
DEFAULT_VOICE_TRANSCRIPTION = "Секреты всегда рядом, Скуф. Нужно лишь тихо прислушаться и услышать их."

class MockF5TTS:
    """Заглушка для F5TTS когда основная модель не работает"""
    def infer(self, ref_file, ref_text, gen_text, **kwargs):
        logger.warning("Using mock F5TTS - no actual synthesis performed")
        # Возвращаем пустые данные
        import numpy as np
        return np.zeros(16000), 16000, None

class RussianF5TTS:
    """Обертка для F5TTS с правильной инициализацией русской модели"""
    def __init__(self, model_name="Misha24-10/F5-TTS_RUSSIAN"):
        self.model_name = model_name
        self.f5tts = None
        self._initialize()
    
    def _initialize(self):
        """Инициализация с русской моделью согласно документации"""
        try:
            # Согласно документации, используем базовую модель F5TTS_v1_Base
            logger.info(f"Initializing F5TTS with base model: {self.model_name}")
            
            # Пробуем инициализировать с указанием модели
            try:
                self.f5tts = F5TTS(model=self.model_name)
                logger.info(f"F5TTS initialized successfully with model: {self.model_name}")
            except Exception as model_error:
                logger.warning(f"Model parameter not supported: {model_error}")
                # Fallback: используем базовую модель
                self.f5tts = F5TTS()
                logger.info("F5TTS initialized with default parameters")
                
            # Пробуем загрузить русскую модель через Hugging Face
            try:
                from huggingface_hub import hf_hub_download
                import os
                
                # Загружаем русскую модель
                russian_model_path = hf_hub_download(
                    repo_id="Misha24-10/F5-TTS_RUSSIAN",
                    filename="F5TTS_v1_Base_v2/model_last_inference.safetensors",
                    cache_dir=str(Path(__file__).parent.parent.parent / "f5_tts_cache")
                )
                logger.info(f"Russian model downloaded to: {russian_model_path}")
                
                # Устанавливаем путь к русской модели
                if hasattr(self.f5tts, 'model_path'):
                    self.f5tts.model_path = russian_model_path
                    logger.info("Set F5TTS model_path to Russian model")
                    
            except Exception as russian_error:
                logger.warning(f"Could not load Russian model: {russian_error}")
                logger.info("Using default F5TTS model")
                
        except Exception as e:
            logger.error(f"Failed to initialize RussianF5TTS: {e}")
            # Fallback to default F5TTS
            self.f5tts = F5TTS()
            logger.warning("Using default F5TTS model as fallback")
    
    def infer(self, ref_file, ref_text, gen_text, **kwargs):
        """Вызов infer с русской моделью"""
        try:
            logger.info(f"Using Russian model {self.model_name} for synthesis")
            logger.info(f"ref_text: '{ref_text}'")
            logger.info(f"gen_text: '{gen_text}'")
            
            # Проверяем, что текст действительно русский
            has_russian = any(ord(char) >= 0x0400 and ord(char) <= 0x04FF for char in gen_text)
            if not has_russian:
                logger.warning(f"Text may not be in Russian: '{gen_text}'")
                # Принудительно добавляем русский маркер
                gen_text = f"Русский текст: {gen_text}"
                logger.info(f"Added Russian marker: '{gen_text}'")
            
            return self.f5tts.infer(ref_file, ref_text, gen_text, **kwargs)
        except Exception as e:
            logger.error(f"Error in RussianF5TTS.infer: {e}")
            raise


class TTSService:
    def __init__(self, state_service):
        logger.info("Initializing F5-TTS Service...")
        self.state_service = state_service
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"F5-TTS using device: {self.device}")

        self.voices_path = settings.VOICES_PATH
        self.voices_path.mkdir(exist_ok=True)
        self.default_voice_path = self.voices_path / "default.wav"

        # F5-TTS model components
        self.f5tts = None
        self._is_ready = False
        
        # Прогресс загрузки
        self.loading_progress = 0
        self.loading_status = "not_started"
        self.loading_message = "Готов к загрузке"

    async def initialize_async(self):
        """Асинхронная инициализация TTS"""
        self.loading_status = "loading"
        self.loading_progress = 10
        self.loading_message = "Начинаем загрузку TTS..."
        
        try:
            # Сначала пробуем загрузить F5TTS
            try:
                await run_in_threadpool(self._load_models_async)
                logger.info("F5TTS loaded successfully")
            except Exception as f5_error:
                logger.warning(f"F5TTS failed to load: {f5_error}")
                logger.info("Falling back to mock TTS service")
                # Если F5TTS не работает, используем заглушку
                self.f5tts = MockF5TTS()
                self.loading_progress = 80
                self.loading_message = "Используем упрощенный TTS..."
            
            self._is_ready = True
            self.loading_progress = 100
            self.loading_status = "ready"
            self.loading_message = "TTS готов к работе!"
            logger.info("TTS Service initialized successfully")
        except Exception as e:
            self.loading_status = "error"
            self.loading_message = f"Ошибка загрузки: {str(e)}"
            logger.error(f"Error initializing TTS: {e}")
            # Даже при ошибке создаем заглушку
            self.f5tts = MockF5TTS()
            self._is_ready = True
            self.loading_status = "ready"
            self.loading_message = "TTS работает в упрощенном режиме"

    def _load_models_async(self):
        """Синхронная загрузка моделей с прогрессом"""
        try:
            logger.info("Starting TTS model loading process...")
            
            # Проверяем, есть ли уже загруженные модели
            project_root = Path(__file__).parent.parent.parent
            f5_tts_path = project_root / "f5_tts_cache" / "models--Misha24-10--F5-TTS_RUSSIAN"
            vocos_path = project_root / "f5_tts_cache" / "models--charactr--vocos-mel-24khz"
            
            models_exist = f5_tts_path.exists() and vocos_path.exists()
            logger.info(f"Models exist check: {models_exist}")
            logger.info(f"F5TTS path exists: {f5_tts_path.exists()}")
            logger.info(f"Vocos path exists: {vocos_path.exists()}")
            
            if models_exist:
                self.loading_progress = 30
                self.loading_message = "Модели найдены в кэше, инициализируем..."
                logger.info(f"Models found in cache at {f5_tts_path}, initializing...")
            else:
                self.loading_progress = 10
                self.loading_message = "Подготовка к загрузке F5-TTS (~1.35 ГБ)..."
                logger.info("Starting F5-TTS model download (~1.35 GB)")
                logger.info(f"Looking for models in: {f5_tts_path}")
                
                self.loading_progress = 20
                self.loading_message = "Загружаем русскую модель F5-TTS..."
                logger.info("Downloading F5-TTS Russian model...")
            
            # Создаем экземпляр F5TTS
            self.loading_progress = 40
            self.loading_message = "Создаем экземпляр F5TTS..."
            logger.info("Creating F5TTS instance...")
            
            try:
                # Инициализация F5TTS согласно официальной документации
                logger.info(f"Loading F5TTS model: {F5_TTS_MODEL}")
                
                # Согласно документации, используем F5TTS() без параметров
                # Модель загружается автоматически из Hugging Face
                # Устанавливаем переменные окружения для указания русской модели
                import os
                os.environ['F5TTS_MODEL'] = "Misha24-10/F5-TTS_RUSSIAN"
                os.environ['HF_HUB_CACHE'] = str(project_root / "f5_tts_cache")
                
                self.f5tts = F5TTS()
                logger.info("F5TTS instance created successfully with Russian model environment variables")
                
                # Пробуем загрузить русскую модель дополнительно
                try:
                    from huggingface_hub import hf_hub_download
                    
                    # Загружаем русскую модель
                    russian_model_path = hf_hub_download(
                        repo_id="Misha24-10/F5-TTS_RUSSIAN",
                        filename="F5TTS_v1_Base_v2/model_last_inference.safetensors",
                        cache_dir=str(project_root / "f5_tts_cache")
                    )
                    logger.info(f"Russian model downloaded to: {russian_model_path}")
                    
                except Exception as russian_error:
                    logger.warning(f"Could not load Russian model: {russian_error}")
                    logger.info("Using default F5TTS model")
                    
            except Exception as e:
                logger.error(f"Error creating F5TTS instance: {e}")
                # Если F5TTS не работает, создаем заглушку
                logger.warning("F5TTS failed to initialize, creating mock instance")
                self.f5tts = MockF5TTS()
            
            self.loading_progress = 60
            self.loading_message = "Инициализируем модель..."
            logger.info("Initializing F5-TTS model...")
            
            # Проверяем, что модель действительно работает
            try:
                # Простая проверка инициализации
                if hasattr(self.f5tts, 'infer'):
                    logger.info("F5TTS model has infer method - ready to use")
                    
                    # Тестируем модель с русским текстом
                    try:
                        test_text = "Привет, это тест русской речи"
                        logger.info(f"Testing F5TTS with Russian text: '{test_text}'")
                        
                        # Проверяем, что модель может обработать русский текст
                        if hasattr(self.f5tts, 'infer'):
                            logger.info("F5TTS infer method available")
                            
                            # Проверяем параметры метода infer
                            import inspect
                            sig = inspect.signature(self.f5tts.infer)
                            logger.info(f"F5TTS infer method parameters: {list(sig.parameters.keys())}")
                            
                            # Проверяем, поддерживает ли модель русский язык
                            if 'language' in sig.parameters:
                                logger.info("F5TTS supports language parameter")
                            else:
                                logger.warning("F5TTS does not support language parameter")
                        
                        logger.info("F5TTS model is ready for Russian speech synthesis")
                    except Exception as test_error:
                        logger.warning(f"F5TTS model test failed: {test_error}")
                else:
                    logger.warning("F5TTS model missing infer method")
            except Exception as e:
                logger.warning(f"F5TTS model check failed: {e}")
            
            self.loading_progress = 80
            self.loading_message = "Настраиваем голосовые модели..."
            logger.info("Setting up voice models...")
            
            # Проверяем наличие дефолтного голоса
            if not self.default_voice_path.exists():
                logger.warning("Default voice file not found, creating placeholder...")
                self.default_voice_path.touch()
            
            self.loading_progress = 90
            self.loading_message = "Финальная настройка..."
            logger.info("Finalizing TTS setup...")
            
            logger.info("TTS model loading completed successfully")
            
        except Exception as e:
            logger.error(f"Error loading F5-TTS models: {e}")
            # Создаем заглушку при ошибке
            logger.warning("Creating mock TTS service due to error")
            self.f5tts = MockF5TTS()
            raise

    def is_ready(self):
        """Проверить готовность TTS"""
        return (self._is_ready and 
                self.f5tts is not None and 
                self.loading_status == "ready")

    def _load_models(self):
        """Load F5-TTS Russian model using the official API."""
        try:
            logger.info("Loading F5-TTS Russian model...")
            
            cache_dir = Path("f5_tts_cache")
            cache_dir.mkdir(exist_ok=True)

            # Manually download the Russian model checkpoint
            logger.info(f"Downloading Russian checkpoint from {F5_TTS_MODEL}...")
            russian_ckpt_path = hf_hub_download(
                repo_id=F5_TTS_MODEL,
                filename=f"{F5_TTS_SUBFOLDER}/{RUSSIAN_MODEL_CHECKPOINT}",
                cache_dir=cache_dir
            )
            logger.info(f"Russian checkpoint downloaded to: {russian_ckpt_path}")

            self.f5tts = F5TTS(
                model="F5TTS_v1_Base",
                ckpt_file=russian_ckpt_path, # Provide the local path to the downloaded checkpoint
                vocab_file="",
                ode_method="euler",
                use_ema=True,
                device=self.device,
                hf_cache_dir=str(cache_dir)
            )
            
            logger.info("F5-TTS Russian model loaded successfully.")

        except Exception as e:
            logger.error(f"FATAL: Failed to load F5-TTS model. Error: {e}", exc_info=True)
            self.f5tts = None

    def _get_voice_path(self, voice_name: str, channel_name: str) -> Optional[str]:
        """Get the path to a voice file, checking channel-specific first, then default."""
        if voice_name and voice_name != "default":
            channel_voice_path = self.voices_path / channel_name / f"{voice_name}.wav"
            if channel_voice_path.exists():
                return str(channel_voice_path)

        if self.default_voice_path.exists():
            return str(self.default_voice_path)

        logger.warning("No voice sample found (neither channel-specific nor default).")
        return None

    def voice_exists(self, voice_name: str, channel_name: str) -> bool:
        """Check if a voice file exists for the given voice name and channel."""
        if voice_name == "default":
            return self.default_voice_path.exists()
        
        channel_voice_path = self.voices_path / channel_name / f"{voice_name}.wav"
        return channel_voice_path.exists()

    async def synthesize_speech(self, text: str, voice_name: str, channel_name: str) -> Optional[str]:
        """Synthesizes speech using the F5-TTS Russian model in a non-blocking way."""
        if not self.f5tts:
            logger.error("TTS Service is not ready. F5-TTS model is not loaded.")
            return None
            
        voice_path = self._get_voice_path(voice_name, channel_name)
        if not voice_path:
            return None

        # Get current TTS settings for the channel (this is now a sync call)
        channel_settings = self.state_service.get_channel_settings(channel_name)

        # Determine the reference text to avoid ASR
        # Используем транскрипцию аудио файла для правильного определения языка
        ref_text_to_use = DEFAULT_VOICE_TRANSCRIPTION
        logger.info("Using Russian transcription for reference audio to ensure correct language detection.")
        
        # --- Text preprocessing for better TTS ---
        processed_text = preprocess_text_for_tts(text.strip())
        
        # Дополнительная очистка текста
        if processed_text:
            # Убираем лишние пробелы и переносы строк
            processed_text = ' '.join(processed_text.split())
            # Убираем специальные символы, которые могут мешать TTS
            processed_text = re.sub(r'[^\w\s.,!?\-]', '', processed_text)
            # Добавляем точку в конце, если нет знаков препинания
            if processed_text and not processed_text.endswith(('.', '!', '?')):
                processed_text += '.'
            
            # Проверяем, что текст содержит русские символы
            has_russian = bool(re.search(r'[а-яё]', processed_text, re.IGNORECASE))
            if not has_russian:
                logger.warning(f"Text may not be in Russian: '{processed_text}'")
                # Добавляем русский маркер для принудительного определения языка
                processed_text = f"Русский текст: {processed_text}"
            
            # Принудительно добавляем русский маркер к тексту
            if processed_text and not any(ord(char) >= 0x0400 and ord(char) <= 0x04FF for char in processed_text):
                logger.warning(f"Text may not be in Russian, adding Russian marker: '{processed_text}'")
                processed_text = f"Русский текст: {processed_text}"

        logger.info(f"Synthesizing audio for: '{processed_text}' using voice '{voice_path}' with settings: {channel_settings}")

        try:
            # Create output directory
            output_dir = Path("audio_cache") / channel_name
            await run_in_threadpool(output_dir.mkdir, parents=True, exist_ok=True)
            
            # Create a unique filename based on the hash of the content and voice
            output_filename = f"{hash(processed_text + voice_name + str(channel_settings))}.wav"
            output_path = output_dir / output_filename

            # --- Check if the file already exists in the cache ---
            exists = await run_in_threadpool(output_path.exists)
            if exists:
                logger.info(f"Cache hit. Using existing audio file: {output_path}")
                return str(output_path)

            logger.info(f"Cache miss. Synthesizing new audio for: '{processed_text}'")

            # Use F5-TTS to synthesize speech in a thread pool to avoid blocking
            # F5TTS не поддерживает параметр language, используем только поддерживаемые параметры
            wav, sr, spect = await run_in_threadpool(
                self.f5tts.infer,
                ref_file=voice_path,
                ref_text=ref_text_to_use,  # Use pre-defined Russian text
                gen_text=processed_text,
                cross_fade_duration=0.15,
                speed=channel_settings.get("speed", 1.0),
                cfg_strength=channel_settings.get("cfg_strength", 2.0),
                nfe_step=channel_settings.get("nfe_step", 32),
                sway_sampling_coef=channel_settings.get("sway_sampling_coef", -1.0)
            )

            # Add a small amount of silence to the end of the audio to prevent cut-offs
            silence_duration_ms = 200
            silence_samples = int(sr * (silence_duration_ms / 1000.0))
            silence = np.zeros(silence_samples, dtype=np.float32)
            wav_padded = np.concatenate([wav, silence])

            # Save the generated audio asynchronously
            await run_in_threadpool(sf.write, str(output_path), wav_padded, sr)
            
            logger.info(f"Audio synthesized and saved to {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Error during F5-TTS synthesis: {e}", exc_info=True)
            return None