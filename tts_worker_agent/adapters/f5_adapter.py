"""F5 local runtime adapter."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urljoin

import requests

from .base import BaseAdapter, SynthesisResult

LOGGER = logging.getLogger("tts_worker_agent")


class F5Adapter(BaseAdapter):
    provider_name = "f5"

    def __init__(
        self,
        *,
        endpoint_url: str,
        api_key: str,
        mixed_language_endpoint_url: str = "",
        timeout_sec: float = 90.0,
    ) -> None:
        super().__init__(endpoint_url=endpoint_url, api_key=api_key, timeout_sec=timeout_sec)
        self.mixed_language_endpoint_url = mixed_language_endpoint_url.rstrip("/")

    def _resolve_endpoint(self, payload_data: dict[str, Any]) -> str:
        tts_settings = payload_data.get("tts_settings")
        language_routing = (
            tts_settings.get("language_routing")
            if isinstance(tts_settings, dict) and isinstance(tts_settings.get("language_routing"), dict)
            else {}
        )
        requires_bilingual = bool(language_routing.get("requires_bilingual_checkpoint"))
        if requires_bilingual and self.mixed_language_endpoint_url:
            return self.mixed_language_endpoint_url
        return self.endpoint_url

    def _fetch_audio_bytes(self, endpoint_url: str, audio_url: str) -> tuple[bytes, str]:
        resolved_url = audio_url
        if not resolved_url.startswith(("http://", "https://")):
            resolved_url = urljoin(f"{endpoint_url}/", resolved_url.lstrip("/"))
        response = requests.get(
            resolved_url,
            headers=self.build_headers(),
            timeout=self.timeout_sec,
        )
        response.raise_for_status()
        return response.content, str(response.headers.get("content-type") or "audio/wav")

    def synthesize(self, job: dict[str, Any]) -> SynthesisResult:
        payload_data = dict(job.get("payload") or {})
        endpoint_url = self._resolve_endpoint(payload_data)
        voice_settings = (
            payload_data.get("tts_settings", {}).get("voice_settings")
            if isinstance(payload_data.get("tts_settings"), dict)
            and isinstance(payload_data.get("tts_settings", {}).get("voice_settings"), dict)
            else {}
        )
        language_routing = (
            payload_data.get("tts_settings", {}).get("language_routing")
            if isinstance(payload_data.get("tts_settings"), dict)
            and isinstance(payload_data.get("tts_settings", {}).get("language_routing"), dict)
            else {}
        )
        request_payload: dict[str, Any] = {
            "channel_name": str(payload_data.get("channel_name") or "worker-agent"),
            "text": str(job.get("text") or ""),
            "author": str(payload_data.get("author") or "worker-agent"),
            "user_id": payload_data.get("user_id"),
            "volume_level": float(payload_data.get("volume_level") or 50.0),
            "tts_settings": dict(payload_data.get("tts_settings") or {}),
            "word_filter": list(payload_data.get("word_filter") or []),
            "blocked_users": list(payload_data.get("blocked_users") or []),
            "provider": "f5",
            "voice": job.get("voice"),
            "voice_map": dict(payload_data.get("voice_map") or {}),
            "request_id": job.get("id"),
        }
        LOGGER.info(
            "F5 adapter request job=%s endpoint=%s route_target=%s detected_language=%s bilingual=%s voice=%s speed_preset=%s cfg_strength=%s",
            job.get("id"),
            endpoint_url,
            language_routing.get("route_target") or "-",
            language_routing.get("detected_language") or "-",
            bool(language_routing.get("requires_bilingual_checkpoint")),
            job.get("voice") or request_payload.get("voice") or "-",
            voice_settings.get("speed_preset") or "-",
            voice_settings.get("cfg_strength") if voice_settings.get("cfg_strength") is not None else "-",
        )

        response = requests.post(
            f"{endpoint_url}/api/tts/synthesize-channel",
            json=request_payload,
            headers=self.build_headers(),
            timeout=self.timeout_sec,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict) or payload.get("success") is False:
            raise RuntimeError(str(payload.get("error") or payload.get("detail") or "F5 synthesis failed"))

        audio_url = str(payload.get("audio_url") or "").strip()
        if not audio_url:
            raise RuntimeError("F5 runtime returned success payload without audio_url")

        audio_bytes, content_type = self._fetch_audio_bytes(endpoint_url, audio_url)
        LOGGER.info(
            "F5 adapter result job=%s endpoint=%s audio_url=%s duration=%s",
            job.get("id"),
            endpoint_url,
            audio_url,
            payload.get("duration") or "-",
        )
        return SynthesisResult(
            audio_bytes=audio_bytes,
            content_type=content_type,
            source_url=audio_url,
            result_payload={
                "selected_voice": payload.get("selected_voice") or payload.get("voice") or job.get("voice"),
                "voice": payload.get("voice") or job.get("voice"),
                "tts_type": payload.get("tts_type") or "ai_f5",
                "duration": payload.get("duration"),
                "provider": "f5",
                "endpoint_used": endpoint_url,
                "language_route_target": language_routing.get("route_target"),
                "meta": {
                    "endpoint_used": endpoint_url,
                    "language_route_target": language_routing.get("route_target"),
                    "detected_language": language_routing.get("detected_language"),
                    "requires_bilingual_checkpoint": bool(language_routing.get("requires_bilingual_checkpoint")),
                    "speed_preset": voice_settings.get("speed_preset"),
                    "cfg_strength": voice_settings.get("cfg_strength"),
                },
                "speed_preset": voice_settings.get("speed_preset"),
            },
        )
