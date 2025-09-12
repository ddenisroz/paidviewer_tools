import torch
from TTS.api import TTS
import os
from pathlib import Path
from typing import Optional
import soundfile as sf
import logging
import tempfile
import numpy as np
from scipy import signal

from app.core.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    def __init__(self):
        logger.info("Initializing Coqui TTS Service...")

        self.voices_path = settings.VOICES_PATH
        self.voices_path.mkdir(exist_ok=True)

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Coqui TTS using device: {self.device}")

        try:
            # Initialize Coqui TTS with XTTS v2 (reliable multilingual model)
            self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(self.device)
            logger.info("Using XTTS v2 model for TTS")
            
            # XTTS v2 model is ready to use
                    
            logger.info("Coqui TTS model loaded successfully.")
        except Exception as e:
            logger.error(f"ERROR: Failed to load Coqui TTS model. Error: {e}", exc_info=True)
            self.tts = None

        self.default_voice_path = self.voices_path / "default.wav"
        if not self.default_voice_path.exists():
            logger.warning("="*50)
            logger.warning("WARNING: Global 'default.wav' not found in 'backend/voices/'.")
            logger.warning("The bot will use a generic built-in voice until a default is provided.")

    def voice_exists(self, voice_name: str, channel_name: str) -> bool:
        """Checks if a specific voice file exists for a channel."""
        if not voice_name or not channel_name:
            return False
        voice_path = self.voices_path / channel_name / f"{voice_name}.wav"
        return voice_path.exists()

    def _get_voice_path(self, voice_name: str, channel_name: str) -> Optional[str]:
        """Get the path to a voice file, checking channel-specific first, then default."""
        if voice_name and voice_name != "default":
            # Check for channel-specific voice first
            channel_voice_path = self.voices_path / channel_name / f"{voice_name}.wav"
            if channel_voice_path.exists():
                return str(channel_voice_path)

        # Fall back to default voice
        if self.default_voice_path.exists():
            return str(self.default_voice_path)

        return None

    def synthesize_speech(self, text: str, voice_name: str = "default", channel_name: str = "default",
                          temperature: float = 0.75, length_penalty: float = 1.0, repetition_penalty: float = 5.0,
                          top_k: int = 50, top_p: float = 0.85) -> str | None:
        """Synthesize speech using Coqui TTS with improved parameters."""
        if not self.tts:
            logger.error("Coqui TTS model is not available.")
            return None

        # Preprocess text
        text = text.strip()
        if not text:
            return None
        if len(text) > 250:  # Increased limit slightly
            text = text[:250]

        # Get voice path
        voice_path = self._get_voice_path(voice_name, channel_name)

        if not voice_path:
            logger.warning("No voice sample found (neither channel-specific nor default). Cannot perform TTS.")
            return None

        output_path = Path(tempfile.mktemp(suffix=".wav"))

        logger.info(f"Synthesizing audio for: '{text}'")
        logger.info(f"Using voice sample: {voice_path}")
        logger.info(
            f"TTS params: temp={temperature}, len_penalty={length_penalty}, rep_penalty={repetition_penalty}, "
            f"top_k={top_k}, top_p={top_p}"
        )

        try:
            # Generate audio with XTTS v2 using proper voice cloning parameters
            wav = self.tts.tts(
                text=text,
                speaker_wav=voice_path,
                language="ru",
                speed=1.0,
                split_sentences=True,
                temperature=temperature,
                length_penalty=length_penalty,
                repetition_penalty=repetition_penalty,
                top_k=top_k,
                top_p=top_p,
            )

            # The model's native sample rate is 24000 Hz.
            model_sample_rate = 24000

            # Simple normalization to prevent clipping
            wav_np = np.array(wav)
            wav_final = wav_np / (np.max(np.abs(wav_np)) + 1e-6) * 0.95

            # Save audio with the correct sample rate and format
            sf.write(str(output_path), wav_final, model_sample_rate, subtype='PCM_16')

            logger.info(f"Audio synthesized and saved to {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Error during TTS synthesis: {e}", exc_info=True)
            return None