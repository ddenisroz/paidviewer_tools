#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Cloud Text-to-Speech integration.
Provides higher-quality TTS with a fallback path handled by TTSManager.
"""

from __future__ import annotations

import base64
import logging
import re
import time
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List

import httpx
from pydub import AudioSegment

from core.config import settings
from core.project_paths import TEMP_DIR
from services.tts.basic_tts import get_basic_tts

logger = logging.getLogger(__name__)

_DEFAULT_VOICES = {
    "ru": ("ru-RU", "ru-RU-Standard-D"),
    "en": ("en-US", "en-US-Standard-C"),
}

_VOICES_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
_VOICES_CACHE_TTL = 6 * 60 * 60


def _parse_voice_name(voice_name: str) -> Optional[Tuple[str, str]]:
    """Parse voice name like ru-RU-Standard-D into (language_code, voice_name)."""
    if not voice_name:
        return None
    match = re.match(r"^([a-z]{2}-[A-Z]{2})-.+", voice_name)
    if not match:
        return None
    return match.group(1), voice_name


class GoogleCloudTTS:
    """Google Cloud TTS client."""

    def __init__(self, temp_dir: Optional[Path] = None):
        self.temp_dir = temp_dir or (TEMP_DIR / "tts_audio")
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.basic_tts = get_basic_tts()
        logger.info("[OK] Google Cloud TTS initialized. Temp dir: %s", self.temp_dir)

    @staticmethod
    def _get_api_key() -> Optional[str]:
        """
        Return API key intended for Google Cloud TTS.
        youtube_api_key is intentionally excluded to avoid false-positive
        availability when YouTube key is configured without TTS API access.
        """
        return settings.google_cloud_api_key or settings.google_tts_api_key

    async def synthesize_speech(
        self,
        text: str,
        volume_level: float = 50.0,
        speed: float = 1.0,
        voice_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Synthesize speech via Google Cloud TTS and return audio path/metadata."""
        api_key = self._get_api_key()
        if not api_key:
            return {"success": False, "error": "GOOGLE_CLOUD_API_KEY is not configured"}

        processed_text = self.basic_tts.preprocess_text(text)
        if not processed_text:
            return {"success": False, "error": "Empty or filtered text"}

        detected_lang = self.basic_tts.detect_language(processed_text)
        language_code, default_voice = _DEFAULT_VOICES.get(detected_lang, _DEFAULT_VOICES["ru"])

        parsed_voice = _parse_voice_name(voice_name or "")
        if parsed_voice:
            language_code, voice_name = parsed_voice
        else:
            voice_name = default_voice

        payload = {
            "input": {"text": processed_text},
            "voice": {"languageCode": language_code, "name": voice_name},
            "audioConfig": {
                "audioEncoding": "MP3",
                "speakingRate": max(0.25, min(4.0, float(speed)))
            }
        }

        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code != 200:
                    log_fn = logger.warning if response.status_code in {400, 401, 403} else logger.error
                    log_fn("[ERROR] Google TTS error %s: %s", response.status_code, response.text)
                    return {"success": False, "error": f"Google TTS error: {response.status_code}"}

                data = response.json()
                audio_b64 = data.get("audioContent")
                if not audio_b64:
                    return {"success": False, "error": "No audioContent in response"}

                audio_bytes = base64.b64decode(audio_b64)

            timestamp = int(time.time() * 1000)
            temp_mp3 = self.temp_dir / f"gcloud_tts_{timestamp}.mp3"
            output_wav = self.temp_dir / f"gcloud_tts_{timestamp}.wav"

            temp_mp3.write_bytes(audio_bytes)

            audio = AudioSegment.from_mp3(str(temp_mp3))

            if volume_level != 50.0:
                db_change = ((volume_level - 50) / 50) * 10
                audio = audio + db_change

            # Add short tail silence to avoid abrupt cut
            audio = audio + AudioSegment.silent(duration=300)

            audio.export(
                str(output_wav),
                format="wav",
                parameters=["-ar", "24000", "-ac", "1"]
            )

            try:
                temp_mp3.unlink()
            except Exception as exc:
                logger.warning("Failed to delete temp mp3: %s", exc)

            return {
                "success": True,
                "audio_path": str(output_wav.resolve()),
                "voice": voice_name,
                "language_code": language_code
            }

        except Exception as exc:
            logger.error("[ERROR] Google TTS synthesis failed: %s", exc, exc_info=True)
            return {"success": False, "error": str(exc)}

    async def list_voices(self, language_code: Optional[str] = None) -> Dict[str, Any]:
        """Fetch available voices from Google Cloud TTS (cached)."""
        api_key = self._get_api_key()
        if not api_key:
            return {
                "success": False,
                "error": "GOOGLE_CLOUD_API_KEY is not configured",
                "voices": [],
                "cached": False,
                "status_code": None,
            }

        cache_key = language_code or "all"
        cached = _VOICES_CACHE.get(cache_key)
        now = time.time()
        if cached and cached[0] > now:
            return {"success": True, "voices": cached[1], "cached": True}

        url = f"https://texttospeech.googleapis.com/v1/voices?key={api_key}"
        params = {}
        if language_code:
            params["languageCode"] = language_code

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    log_fn = logger.warning if response.status_code in {400, 401, 403} else logger.error
                    log_fn("[ERROR] Google TTS voices error %s: %s", response.status_code, response.text)
                    return {
                        "success": False,
                        "error": f"Google TTS error: {response.status_code}",
                        "voices": [],
                        "cached": False,
                        "status_code": response.status_code,
                    }

                data = response.json()
                voices = data.get("voices", [])

            _VOICES_CACHE[cache_key] = (now + _VOICES_CACHE_TTL, voices)
            return {"success": True, "voices": voices, "cached": False}
        except Exception as exc:
            logger.error("[ERROR] Google TTS voices fetch failed: %s", exc, exc_info=True)
            return {"success": False, "error": str(exc), "voices": [], "cached": False, "status_code": None}


_google_cloud_tts_instance: Optional[GoogleCloudTTS] = None


def get_google_cloud_tts() -> GoogleCloudTTS:
    """Singleton accessor for GoogleCloudTTS."""
    global _google_cloud_tts_instance
    if _google_cloud_tts_instance is None:
        _google_cloud_tts_instance = GoogleCloudTTS()
    return _google_cloud_tts_instance
