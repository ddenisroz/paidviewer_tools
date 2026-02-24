#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Provider-aware TTS manager for bot_service.

Priority order:
1. Advanced providers (F5/Qwen/GCloud) based on current settings.
2. Basic gTTS as always-on fallback.
"""

from __future__ import annotations

import asyncio
import logging
import random
import re
import time
from pathlib import Path
from typing import Dict, Optional

import aiohttp

from constants import (
    TTS_DEFAULT_VOLUME,
    TTS_HEALTH_CHECK_INTERVAL,
    TTS_MAX_RETRIES,
    TTS_RETRY_DELAY,
)
from core.config import settings
from services.tts.basic_tts import get_basic_tts
from services.tts.google_cloud_tts import (
    get_google_cloud_tts,
    is_gemini_or_chirp_voice,
    normalize_gcloud_mood,
)
from services.tts.provider_utils import (
    get_provider_service_url,
    infer_provider_from_engine,
    normalize_local_tts_endpoint_url,
    normalize_provider,
    normalize_provider_mode,
)

logger = logging.getLogger(__name__)
_GEMINI_SPEAKER_PATTERN = re.compile(r"^[A-Z][A-Za-z0-9_]{1,63}$")


def _gcloud_voice_quality_rank(voice_name: Optional[str]) -> int:
    key = (voice_name or "").lower()
    if _GEMINI_SPEAKER_PATTERN.match(voice_name or ""):
        return 0
    if "gemini" in key:
        return 0
    if "chirp3-hd" in key:
        return 1
    if "neural2" in key:
        return 2
    if "wavenet" in key:
        return 3
    if "studio" in key:
        return 4
    if "journey" in key:
        return 5
    if "standard" in key:
        return 9
    return 6


class TTSManager:
    """Coordinates provider synthesis and fallback to basic TTS."""

    def __init__(self):
        self.f5_tts_service_url = get_provider_service_url("f5")
        self.qwen_tts_service_url = get_provider_service_url("qwen")
        self.backend_url = settings.backend_url

        self.basic_tts = get_basic_tts()
        self.google_cloud_tts = get_google_cloud_tts()

        # Cache health per effective endpoint to avoid cross-endpoint poisoning:
        # a failing local endpoint must not mark the cloud endpoint as unhealthy.
        self._provider_health: Dict[tuple[str, str], bool] = {}
        self._provider_last_health_check: Dict[tuple[str, str], float] = {}
        self._health_check_interval = TTS_HEALTH_CHECK_INTERVAL

        logger.info(
            "[OK] TTS manager initialized: f5_url=%s qwen_url=%s",
            self.f5_tts_service_url,
            self.qwen_tts_service_url,
        )

    async def get_user_tts_endpoint(
        self,
        user_id: int,
        db_session,
        provider: str = "f5",
    ) -> Optional[str]:
        """Return healthy local endpoint for provider if configured."""
        try:
            from repositories.local_tts_repository import LocalTTSRepository

            repo = LocalTTSRepository(db_session)
            normalized_provider = normalize_provider(provider)
            local_config = repo.get_healthy(user_id=user_id, provider=normalized_provider)

            if local_config:
                try:
                    normalized_endpoint = normalize_local_tts_endpoint_url(local_config.endpoint_url)
                except ValueError as error:
                    logger.warning(
                        "[WARN] Ignoring invalid local endpoint for user_id=%s provider=%s: %s",
                        user_id,
                        normalized_provider,
                        error,
                    )
                    return None

                logger.info(
                    "[LOCAL] Using local endpoint for user_id=%s provider=%s endpoint=%s",
                    user_id,
                    normalized_provider,
                    normalized_endpoint,
                )
                return normalized_endpoint

            return None
        except Exception:
            logger.exception("Error getting user local TTS endpoint")
            return None

    async def check_tts_service_health(
        self,
        force_check: bool = False,
        provider: str = "f5",
        endpoint_override: Optional[str] = None,
    ) -> bool:
        """Health check for remote/local provider endpoint with endpoint-aware cache."""
        normalized_provider = normalize_provider(provider)
        if endpoint_override:
            try:
                endpoint = normalize_local_tts_endpoint_url(endpoint_override)
            except ValueError as error:
                if not force_check:
                    logger.warning(
                        "[WARN] Invalid endpoint override for health check provider=%s error=%s",
                        normalized_provider,
                        error,
                    )
                return False
        else:
            endpoint = get_provider_service_url(normalized_provider).rstrip("/")
        cache_key = (normalized_provider, endpoint)
        current_time = time.time()
        last_check = self._provider_last_health_check.get(cache_key, 0.0)

        if (not force_check) and (current_time - last_check < self._health_check_interval):
            return self._provider_health.get(cache_key, True)

        try:
            timeout = aiohttp.ClientTimeout(total=5, connect=2)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                health_payload = None
                last_status = None
                for health_path in ("/api/health", "/health"):
                    async with session.get(f"{endpoint}{health_path}") as response:
                        last_status = response.status
                        if response.status != 200:
                            continue
                        health_payload = await response.json()
                        break

                if health_payload is None:
                    if not force_check:
                        logger.warning(
                            "[WARN] %s health check failed status=%s endpoint=%s",
                            normalized_provider,
                            last_status,
                            endpoint,
                        )
                    self._provider_health[cache_key] = False
                    self._provider_last_health_check[cache_key] = current_time
                    return False

                is_healthy = bool(
                    health_payload.get("tts_engine_loaded", False)
                    or health_payload.get("status") == "healthy"
                    or health_payload.get("tts_engine") == "ready"
                )

                previous_state = self._provider_health.get(cache_key)
                if previous_state is not None and previous_state != is_healthy:
                    if is_healthy:
                        logger.info("[OK] %s service is healthy again", normalized_provider)
                    else:
                        logger.warning("[WARN] %s service is unhealthy", normalized_provider)

                self._provider_health[cache_key] = is_healthy
                self._provider_last_health_check[cache_key] = current_time
                return is_healthy

        except asyncio.TimeoutError:
            if not force_check:
                logger.warning("[WARN] %s health check timeout endpoint=%s", normalized_provider, endpoint)
        except aiohttp.ClientError as error:
            if not force_check:
                logger.warning(
                    "[WARN] %s health check connection error endpoint=%s error=%s",
                    normalized_provider,
                    endpoint,
                    error,
                )
        except Exception:
            if not force_check:
                logger.exception("[ERROR] %s health check failed endpoint=%s", normalized_provider, endpoint)

        self._provider_health[cache_key] = False
        self._provider_last_health_check[cache_key] = current_time
        return False

    async def synthesize_tts(
        self,
        channel_name: str,
        text: str,
        author: str,
        user_id: int = None,
        volume_level: float = TTS_DEFAULT_VOLUME,
        use_ai_tts: bool = False,
        use_basic_tts: bool = True,
        connection_manager=None,
        tts_settings: dict = None,
        word_filter: list = None,
        blocked_users: list = None,
        db_session=None,
        engine: Optional[str] = None,
    ) -> Dict:
        """Synthesize speech with advanced provider first and mandatory basic fallback."""
        _ = use_basic_tts  # kept for backwards compatibility, fallback is always enabled

        settings_dict = tts_settings or {}
        resolved_engine = (engine or ("f5tts" if use_ai_tts else "gtts")).strip().lower()
        logger.info("[MIC] Engine resolved: %s", resolved_engine)

        # Priority A: Google Cloud TTS
        if resolved_engine == "gcloud":
            try:
                result = await self._synthesize_via_google_cloud_tts(
                    text=text,
                    volume_level=volume_level,
                    tts_settings=settings_dict,
                )
                if result.get("success"):
                    logger.info("[OK] Google Cloud TTS synthesis succeeded")
                    self.cleanup_old_files_if_needed()
                    return result
                logger.warning("[WARN] Google Cloud TTS failed: %s", result.get("error"))
            except Exception:
                logger.exception("[ERROR] Google Cloud TTS execution failed")

        # Priority B: Advanced providers (F5/Qwen) with retries
        elif resolved_engine in {"f5tts", "qwen"} and use_ai_tts:
            provider = infer_provider_from_engine(
                resolved_engine,
                advanced_provider=settings_dict.get("advanced_provider"),
            )
            provider_mode_key = "qwen_mode" if provider == "qwen" else "f5_mode"
            preferred_mode = normalize_provider_mode(settings_dict.get(provider_mode_key))
            use_local_flag = bool(settings_dict.get("use_local_tts", False))
            resolved_mode = "local" if use_local_flag else preferred_mode

            endpoint = get_provider_service_url(provider)
            has_explicit_local_endpoint = False

            if resolved_mode == "local":
                if user_id and db_session:
                    local_endpoint = await self.get_user_tts_endpoint(
                        user_id=user_id,
                        db_session=db_session,
                        provider=provider,
                    )
                    if local_endpoint:
                        endpoint = local_endpoint
                        has_explicit_local_endpoint = True
                if not has_explicit_local_endpoint:
                    logger.warning(
                        "[WARN] No local endpoint configured for provider=%s user_id=%s; fallback to basic TTS",
                        provider,
                        user_id,
                    )

            if resolved_mode != "local" or has_explicit_local_endpoint:
                max_retries = TTS_MAX_RETRIES
                base_retry_delay = TTS_RETRY_DELAY

                is_healthy = await self.check_tts_service_health(
                    provider=provider,
                    endpoint_override=endpoint,
                )
                if not is_healthy:
                    logger.warning(
                        "[WARN] Provider unhealthy provider=%s endpoint=%s; fallback to basic TTS",
                        provider,
                        endpoint,
                    )
                else:
                    for attempt in range(1, max_retries + 1):
                        try:
                            result = await self._synthesize_via_tts_service(
                                channel_name=channel_name,
                                text=text,
                                author=author,
                                user_id=user_id,
                                volume_level=volume_level,
                                connection_manager=connection_manager,
                                tts_settings=settings_dict,
                                word_filter=word_filter,
                                blocked_users=blocked_users,
                                provider=provider,
                                tts_endpoint=endpoint,
                            )
                            if result.get("success"):
                                logger.info(
                                    "[OK] Advanced synthesis succeeded provider=%s attempt=%s/%s",
                                    provider,
                                    attempt,
                                    max_retries,
                                )
                                self.cleanup_old_files_if_needed()
                                return result

                            logger.warning(
                                "[WARN] Advanced synthesis failed provider=%s attempt=%s/%s error=%s",
                                provider,
                                attempt,
                                max_retries,
                                result.get("error"),
                            )
                        except asyncio.TimeoutError:
                            logger.warning(
                                "[WARN] Advanced synthesis timeout provider=%s attempt=%s/%s",
                                provider,
                                attempt,
                                max_retries,
                            )
                        except aiohttp.ClientError as error:
                            logger.warning(
                                "[WARN] Advanced synthesis connection error provider=%s attempt=%s/%s error=%s",
                                provider,
                                attempt,
                                max_retries,
                                error,
                            )
                        except Exception:
                            logger.exception(
                                "[ERROR] Advanced synthesis exception provider=%s attempt=%s/%s",
                                provider,
                                attempt,
                                max_retries,
                            )

                        if attempt < max_retries:
                            delay = base_retry_delay * (2 ** (attempt - 1))
                            await asyncio.sleep(delay)

                    logger.warning(
                        "[WARN] Advanced provider exhausted retries provider=%s; fallback to basic TTS",
                        provider,
                    )

        # Priority C: Basic fallback (always available)
        try:
            result = await self._synthesize_via_basic_tts(text, volume_level)
            if result.get("success"):
                logger.info("[OK] Basic TTS synthesis succeeded")
                self.cleanup_old_files_if_needed()
                return result
            logger.error("[ERROR] Basic TTS synthesis failed: %s", result.get("error"))
            return {"success": False, "error": "Basic TTS synthesis failed"}
        except Exception as error:
            logger.exception("[ERROR] Basic TTS execution failed")
            return {"success": False, "error": f"Basic TTS error: {error}"}

    async def _synthesize_via_tts_service(
        self,
        channel_name: str,
        text: str,
        author: str,
        user_id: int = None,
        volume_level: float = TTS_DEFAULT_VOLUME,
        connection_manager=None,
        tts_settings: dict = None,
        word_filter: list = None,
        blocked_users: list = None,
        provider: str = "f5",
        tts_endpoint: str = None,
    ) -> Dict:
        """Synthesize through remote provider service endpoint."""
        normalized_provider = normalize_provider(provider)
        tts_type = "ai_qwen" if normalized_provider == "qwen" else "ai_f5"

        try:
            if tts_endpoint:
                try:
                    endpoint = normalize_local_tts_endpoint_url(tts_endpoint)
                except ValueError as error:
                    logger.warning(
                        "[WARN] Invalid local endpoint during synthesis provider=%s error=%s",
                        normalized_provider,
                        error,
                    )
                    return {"success": False, "error": "Invalid local endpoint configuration"}
            else:
                gateway_url = (settings.tts_gateway_url or "").strip()
                if gateway_url and normalized_provider in {"f5", "qwen"}:
                    endpoint = gateway_url.rstrip("/")
                else:
                    endpoint = get_provider_service_url(normalized_provider).rstrip("/")
            timeout = aiohttp.ClientTimeout(total=30, connect=10)

            request_settings = dict(tts_settings or {})
            request_settings.setdefault("advanced_provider", normalized_provider)
            f5_voice = str(request_settings.get("voice") or "").strip()
            qwen_voice = str(request_settings.get("qwen_voice") or "").strip() or f5_voice
            voice_map = {}
            if f5_voice:
                voice_map["f5"] = f5_voice
            if qwen_voice:
                voice_map["qwen"] = qwen_voice
            selected_request_voice = (
                voice_map.get(normalized_provider)
                or f5_voice
                or ("default" if normalized_provider == "qwen" else "female_1")
            )

            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"{endpoint}/api/tts/synthesize-channel"
                payload = {
                    "channel_name": channel_name,
                    "text": text,
                    "author": author,
                    "user_id": user_id,
                    "volume_level": volume_level,
                    "tts_settings": request_settings,
                    "word_filter": word_filter or [],
                    "blocked_users": blocked_users or [],
                    "provider": normalized_provider,
                    "voice": selected_request_voice,
                    "voice_map": voice_map,
                }

                async with session.post(url, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(
                            "[ERROR] Provider returned error provider=%s status=%s body=%s",
                            normalized_provider,
                            response.status,
                            error_text,
                        )
                        return {
                            "success": False,
                            "error": f"Provider error: {response.status}",
                        }

                    result = await response.json()
                    selected_voice = result.get("selected_voice") or result.get("voice")
                    raw_audio_url = result.get("audio_url")

                    if raw_audio_url:
                        if raw_audio_url.startswith(("http://", "https://")):
                            audio_url = raw_audio_url
                        elif raw_audio_url.startswith("/"):
                            audio_url = f"{endpoint}{raw_audio_url}"
                        else:
                            audio_url = f"{endpoint}/api/tts/audio/{raw_audio_url}"
                    else:
                        audio_url = None

                    # Preserve existing behavior: if voice has a per-channel priority volume,
                    # trigger one more provider request with that volume.
                    if connection_manager and selected_voice:
                        priority_volume = connection_manager.get_voice_volume(channel_name, selected_voice)
                        if priority_volume != TTS_DEFAULT_VOLUME:
                            payload["volume_level"] = priority_volume
                            async with session.post(url, json=payload, timeout=timeout) as priority_response:
                                if priority_response.status == 200:
                                    await priority_response.json()
                                    return {
                                        "success": True,
                                        "voice": selected_voice,
                                        "volume": priority_volume,
                                        "tts_type": tts_type,
                                        "audio_url": audio_url,
                                    }

                    return {
                        "success": True,
                        "voice": selected_voice,
                        "volume": volume_level,
                        "tts_type": tts_type,
                        "audio_url": audio_url,
                    }

        except asyncio.TimeoutError:
            logger.warning("[WARN] Provider request timeout provider=%s", normalized_provider)
            return {"success": False, "error": "Request timeout"}
        except aiohttp.ClientError as error:
            logger.warning("[WARN] Provider request connection error provider=%s error=%s", normalized_provider, error)
            return {"success": False, "error": f"Connection error: {error}"}
        except Exception:
            logger.exception("[ERROR] Provider request failed provider=%s", normalized_provider)
            return {"success": False, "error": "Internal server error"}

    async def _synthesize_via_basic_tts(self, text: str, volume_level: float) -> Dict:
        """Synthesize through local basic gTTS implementation."""
        try:
            audio_path = self.basic_tts.synthesize_speech(
                text=text,
                volume_level=volume_level,
                speed=1.0,
            )

            if not audio_path:
                logger.error("[ERROR] Basic TTS synthesize_speech returned no path")
                return {"success": False, "error": "Basic TTS synthesis failed"}

            filename = Path(audio_path).name
            audio_url = f"{self.backend_url}/api/tts/audio/{filename}"

            return {
                "success": True,
                "voice": "basic_gtts",
                "volume": volume_level,
                "tts_type": "basic_gtts",
                "audio_url": audio_url,
                "audio_path": audio_path,
            }

        except Exception:
            logger.exception("[ERROR] Basic TTS synthesis exception")
            return {"success": False, "error": "Internal server error"}

    async def _synthesize_via_google_cloud_tts(
        self,
        text: str,
        volume_level: float,
        tts_settings: dict,
    ) -> Dict:
        """Synthesize via Google Cloud TTS provider."""
        try:
            voice_pool = []
            if tts_settings:
                voice_pool = tts_settings.get("gcloud_voices") or tts_settings.get("gcloudVoices") or []

            cleaned_voice_pool = [
                str(voice).strip()
                for voice in voice_pool
                if isinstance(voice, str) and str(voice).strip()
            ]
            filtered_voice_pool = [
                voice
                for voice in cleaned_voice_pool
                if is_gemini_or_chirp_voice(voice)
            ]

            if cleaned_voice_pool and not filtered_voice_pool:
                logger.warning(
                    "[WARN] All saved Google voices are legacy/non-premium. Gemini/Chirp only is supported."
                )

            gemini_voice_pool = [
                voice
                for voice in filtered_voice_pool
                if _gcloud_voice_quality_rank(voice) == 0
            ]
            random_pool = gemini_voice_pool or filtered_voice_pool

            fallback_voice = tts_settings.get("voice") if tts_settings else None
            if fallback_voice and not is_gemini_or_chirp_voice(fallback_voice):
                fallback_voice = None

            voice_name = random.choice(random_pool) if random_pool else fallback_voice
            gcloud_mood = normalize_gcloud_mood(
                (tts_settings or {}).get("gcloud_mood")
                or (tts_settings or {}).get("gcloudMood")
            )

            result = await self.google_cloud_tts.synthesize_speech(
                text=text,
                volume_level=volume_level,
                speed=1.0,
                voice_name=voice_name,
                mood=gcloud_mood,
            )

            if not result.get("success"):
                return result

            if result.get("fallback_used"):
                logger.warning(
                    "[WARN] Google Cloud runtime fallback requested_model=%s resolved_voice=%s",
                    result.get("requested_model") or "-",
                    result.get("voice") or "-",
                )

            audio_path = result.get("audio_path")
            if not audio_path:
                return {"success": False, "error": "No audio_path returned"}

            filename = Path(audio_path).name
            audio_url = f"{self.backend_url}/api/tts/audio/{filename}"

            return {
                "success": True,
                "voice": result.get("voice") or "google_cloud",
                "volume": volume_level,
                "tts_type": "google_cloud",
                "audio_url": audio_url,
                "audio_path": audio_path,
                "auth_mode": result.get("auth_mode"),
                "requested_model": result.get("requested_model"),
                "fallback_used": bool(result.get("fallback_used")),
            }

        except Exception:
            logger.exception("[ERROR] Google Cloud TTS synthesis exception")
            return {"success": False, "error": "Internal server error"}

    async def _upload_to_tts_service(self, audio_path: str) -> Optional[str]:
        """Upload an audio file to the F5 service for temporary serving."""
        try:
            import aiofiles

            filename = Path(audio_path).name
            target_url = get_provider_service_url("f5").rstrip("/")

            async with aiofiles.open(audio_path, "rb") as file_handle:
                audio_data = await file_handle.read()

            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                data = aiohttp.FormData()
                data.add_field("file", audio_data, filename=filename, content_type="audio/wav")

                async with session.post(f"{target_url}/api/upload-audio", data=data) as response:
                    if response.status != 200:
                        logger.warning("[WARN] Could not upload audio to F5 service status=%s", response.status)
                        return None

                    await response.json()
                    return f"{target_url}/api/audio/{filename}"

        except Exception:
            logger.exception("[ERROR] Upload to provider service failed")
            return None

    def cleanup_old_files(self):
        """Clean old temporary files from basic TTS runtime."""
        try:
            self.basic_tts.cleanup_old_files()
        except Exception:
            logger.exception("[ERROR] Basic TTS cleanup failed")

    def cleanup_old_files_if_needed(self):
        """Periodic cleanup every 10 synthesis operations."""
        if not hasattr(self, "_synthesis_count"):
            self._synthesis_count = 0

        self._synthesis_count += 1
        if self._synthesis_count % 10 == 0:
            self.cleanup_old_files()


_tts_manager_instance = None


def get_tts_manager() -> TTSManager:
    """Return singleton TTS manager instance."""
    global _tts_manager_instance
    if _tts_manager_instance is None:
        _tts_manager_instance = TTSManager()
    return _tts_manager_instance
