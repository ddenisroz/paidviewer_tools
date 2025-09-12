import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
import os
import hashlib
from pathlib import Path
from typing import Optional
import soundfile as sf
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    def __init__(self):
        logger.info("Initializing Chatterbox TTS Service...")

        self.cache_path = settings.AUDIO_CACHE_PATH
        self.voices_path = settings.VOICES_PATH

        self.cache_path.mkdir(exist_ok=True)
        self.voices_path.mkdir(exist_ok=True)

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Chatterbox TTS using device: {self.device}")

        try:
            self.model = ChatterboxMultilingualTTS.from_pretrained(
                device=self.device)
            logger.info("Chatterbox Multilingual TTS model loaded successfully.")
        except Exception as e:
            logger.error(
                f"ERROR: Failed to load Chatterbox model. Error: {e}", exc_info=True)
            self.model = None

        self.default_voice_path = self.voices_path / "default.wav"
        if not self.default_voice_path.exists():
            logger.warning("="*50)
            logger.warning(
                "WARNING: Global 'default.wav' not found in 'backend/voices/'.")
            logger.warning(
                "The bot will use a generic built-in voice until a default is provided.")
            logger.warning("="*50)

    def voice_exists(self, voice_name: str, channel_name: str) -> bool:
        """Checks if a specific voice file exists for a channel."""
        if not voice_name or not channel_name:
            return False
        voice_path = self.voices_path / channel_name / f"{voice_name}.wav"
        return voice_path.exists()

    def _get_file_hash(self, text: str, voice_key: str) -> str:
        hasher = hashlib.sha256()
        hasher.update(text.encode('utf-8'))
        hasher.update(voice_key.encode('utf-8'))
        return hasher.hexdigest()

    def _get_voice_path(self, voice_name: str, channel_name: str) -> Optional[str]:
        if voice_name and voice_name != "default":
            channel_voice_path = self.voices_path / channel_name / f"{voice_name}.wav"
            if channel_voice_path.exists():
                return str(channel_voice_path)

        channel_default_path = self.voices_path / channel_name / "default.wav"
        if channel_default_path.exists():
            return str(channel_default_path)

        if self.default_voice_path.exists():
            return str(self.default_voice_path)

        return None

    def synthesize_speech(self, text: str, voice_name: str = "default", channel_name: str = "default") -> str | None:
        if not self.model:
            logger.error("Chatterbox model is not available.")
            return None

        voice_path = self._get_voice_path(voice_name, channel_name)
        cache_voice_key = str(voice_path) if voice_path else "generic_builtin"

        channel_cache_path = self.cache_path / channel_name
        channel_cache_path.mkdir(exist_ok=True)

        file_hash = self._get_file_hash(text, cache_voice_key)
        output_path = channel_cache_path / f"{file_hash}.wav"

        if output_path.exists():
            logger.info(f"Cache hit for '{text}'. Path: {output_path}")
            return str(output_path)

        logger.info(f"Cache miss for '{text}'. Synthesizing audio...")
        if voice_path:
            logger.info(f"Using voice sample: {voice_path}")
        else:
            logger.info("No voice sample found. Using generic built-in voice.")

        try:
            wav = self.model.generate(
                text=text,
                audio_prompt_path=voice_path,
                language_id="ru",
                temperature=0.75,
                repetition_penalty=5.0,
            )
            sr = self.model.sr

            wav_numpy = wav.squeeze().cpu().numpy()
            sf.write(str(output_path), wav_numpy, sr)

            logger.info(f"Audio synthesized and saved to {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Error during TTS synthesis: {e}", exc_info=True)
            return None


# tts_service_instance = TTSService()
