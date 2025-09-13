import logging
import os
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

# --- Constants for F5-TTS Russian Model ---
F5_TTS_MODEL = "Misha24-10/F5-TTS_RUSSIAN"
F5_TTS_SUBFOLDER = "F5TTS_v1_Base_v2"
RUSSIAN_MODEL_CHECKPOINT = "model_last_inference.safetensors"

# Transcription for the default voice to avoid running Whisper ASR
DEFAULT_VOICE_TRANSCRIPTION = "Секреты всегда рядом, Скуф. Нужно лишь тихо прислушаться и услышать их."


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
        self._load_models()

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

    async def synthesize_speech(self, text: str, voice_name: str, channel_name: str) -> Optional[str]:
        """Synthesizes speech using the F5-TTS Russian model in a non-blocking way."""
        if not self.f5tts:
            logger.error("TTS Service is not ready. F5-TTS model is not loaded.")
            return None
            
        voice_path = self._get_voice_path(voice_name, channel_name)
        if not voice_path:
            return None

        # Determine the reference text to avoid ASR
        ref_text_to_use = ""  # Default to ASR for custom voices
        if Path(voice_path).name == 'default.wav':
            ref_text_to_use = DEFAULT_VOICE_TRANSCRIPTION
            logger.info("Using pre-defined transcription for default voice.")

        # --- Text preprocessing for better TTS ---
        processed_text = preprocess_text_for_tts(text.strip())
        if processed_text and not processed_text.endswith(('.', '!', '?')):
            processed_text += '.'

        logger.info(f"Synthesizing audio for: '{processed_text}' using voice '{voice_path}'")

        try:
            # Create output directory
            output_dir = Path("audio_cache") / channel_name
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # Create a unique filename
            output_filename = f"{hash(text + voice_name)}.wav"
            output_path = output_dir / output_filename

            # Use F5-TTS to synthesize speech in a thread pool to avoid blocking
            wav, sr, spect = await run_in_threadpool(
                self.f5tts.infer,
                ref_file=voice_path,
                ref_text=ref_text_to_use,  # Use pre-defined or empty text
                gen_text=processed_text,
                cross_fade_duration=0.15,
                speed=1.0
            )

            # Add a small amount of silence to the end of the audio to prevent cut-offs
            silence_duration_ms = 200
            silence_samples = int(sr * (silence_duration_ms / 1000.0))
            silence = np.zeros(silence_samples, dtype=np.float32)
            wav_padded = np.concatenate([wav, silence])

            # Save the generated audio
            sf.write(str(output_path), wav_padded, sr)
            
            logger.info(f"Audio synthesized and saved to {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Error during F5-TTS synthesis: {e}", exc_info=True)
            return None