"""Qwen local runtime adapter."""

from __future__ import annotations

from typing import Any

import requests

from .base import BaseAdapter, SynthesisResult


class QwenAdapter(BaseAdapter):
    provider_name = "qwen"

    def synthesize(self, job: dict[str, Any]) -> SynthesisResult:
        payload_data = dict(job.get("payload") or {})
        tts_settings = dict(payload_data.get("tts_settings") or {})
        prepare_payload = {
            "model": str(tts_settings.get("qwen_model") or "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"),
            "text": str(job.get("text") or ""),
            "language": str(tts_settings.get("qwen_language") or "Russian"),
            "temperature": str(tts_settings.get("qwen_temperature") or 0.9),
            "instruction": str(tts_settings.get("qwen_instruction") or payload_data.get("instruction") or ""),
            "speaker": str(job.get("voice") or tts_settings.get("qwen_voice") or "default"),
            "tenant_id": str(payload_data.get("tenant_id") or ""),
            "channel_name": str(payload_data.get("channel_name") or "worker-agent"),
            "author": str(payload_data.get("author") or "worker-agent"),
            "user_id": str(payload_data.get("user_id") or ""),
            "request_id": str(job.get("id") or ""),
            "event_id": str(payload_data.get("event_id") or ""),
        }

        prepare_response = requests.post(
            f"{self.endpoint_url}/api/prepare",
            data=prepare_payload,
            headers=self.build_headers(),
            timeout=self.timeout_sec,
        )
        prepare_response.raise_for_status()
        prepare_data = prepare_response.json()
        stream_id = str(prepare_data.get("stream_id") or "").strip()
        if not stream_id:
            raise RuntimeError("Qwen runtime returned no stream_id")

        stream_response = requests.get(
            f"{self.endpoint_url}/api/stream/{stream_id}",
            headers=self.build_headers(),
            timeout=self.timeout_sec,
        )
        stream_response.raise_for_status()
        if not stream_response.content:
            raise RuntimeError("Qwen stream returned empty audio payload")

        return SynthesisResult(
            audio_bytes=stream_response.content,
            content_type=str(stream_response.headers.get("content-type") or "audio/wav"),
            source_url=f"{self.endpoint_url}/api/stream/{stream_id}",
            result_payload={
                "selected_voice": prepare_payload["speaker"],
                "voice": prepare_payload["speaker"],
                "tts_type": "ai_qwen",
                "provider": "qwen",
                "stream_id": stream_id,
                "model": prepare_payload["model"],
            },
        )
