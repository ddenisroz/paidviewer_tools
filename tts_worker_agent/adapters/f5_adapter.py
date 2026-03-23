"""F5 local runtime adapter."""

from __future__ import annotations

from typing import Any

import requests

from .base import BaseAdapter, SynthesisResult


class F5Adapter(BaseAdapter):
    provider_name = "f5"

    def synthesize(self, job: dict[str, Any]) -> SynthesisResult:
        payload_data = dict(job.get("payload") or {})
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

        response = requests.post(
            f"{self.endpoint_url}/api/tts/synthesize-channel",
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

        audio_bytes, content_type = self.fetch_audio_bytes(audio_url)
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
            },
        )
