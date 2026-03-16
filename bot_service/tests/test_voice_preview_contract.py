from types import SimpleNamespace
import shutil
from pathlib import Path
from urllib.parse import urlparse

import httpx
import pytest
from fastapi import HTTPException

from api.tts import voices_routes


class _FakeVoiceService:
    db = object()

    async def get_voice_info(self, voice_id: int, provider: str):
        assert voice_id == 1
        assert provider in {"qwen", "f5"}
        return {"id": 1, "name": "voice_one", "owner_id": 1, "is_global": False}


@pytest.mark.asyncio
async def test_qwen_voice_preview_fails_fast_on_worker_warmup(monkeypatch):
    captured_timeouts: list[float] = []
    captured_models: list[str] = []

    class _FakeAsyncClient:
        def __init__(self, timeout=None, **kwargs):
            _ = kwargs
            captured_timeouts.append(float(timeout))

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            captured_models.append(str(kwargs.get("data", {}).get("model")))
            raise httpx.ReadTimeout("worker is loading")

    class _FakeSettingsRepo:
        def __init__(self, db):
            _ = db

        def get_or_create(self, user_id: int):
            assert user_id == 1
            return SimpleNamespace(qwen_model="Qwen/Qwen3-TTS-12Hz-1.7B-Base")

    monkeypatch.setattr(voices_routes.httpx, "AsyncClient", _FakeAsyncClient)
    monkeypatch.setattr(voices_routes, "_provider_base_url", lambda provider: "http://localhost:8012")
    monkeypatch.setattr(voices_routes, "_provider_upstream_params", lambda provider, extra_params=None: extra_params or {})
    monkeypatch.setattr(voices_routes, "_tts_auth_headers", lambda provider: {})
    monkeypatch.setattr(voices_routes, "TTSSettingsRepository", _FakeSettingsRepo)

    with pytest.raises(HTTPException) as exc_info:
        await voices_routes.test_voice(
            voice_id=1,
            payload={"text": "Привет"},
            current_user={"id": 1},
            service=_FakeVoiceService(),
            provider="qwen",
        )

    assert exc_info.value.status_code == 504
    assert "still loading" in str(exc_info.value.detail).lower()
    assert captured_timeouts == [voices_routes.QWEN_VOICE_PREVIEW_TIMEOUT_SECONDS]
    assert captured_models == ["Qwen/Qwen3-TTS-12Hz-1.7B-Base"]


@pytest.mark.asyncio
async def test_f5_voice_preview_localizes_provider_audio_to_bot_service(monkeypatch):
    class _FakeAsyncClient:
        def __init__(self, timeout=None, **kwargs):
            _ = (timeout, kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            _ = (args, kwargs)
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "audio_url": "/api/tts/audio/provider-preview.wav",
                    "voice": "female_1",
                    "selected_voice": "female_1",
                    "tts_type": "ai_f5",
                },
            )

        async def get(self, *args, **kwargs):
            _ = (args, kwargs)
            return httpx.Response(
                200,
                content=b"RIFFfakewav",
                headers={"content-type": "audio/wav"},
            )

    temp_root = Path("H:/Programming/raw_code/AI/Python/TTS_TTV_0.02/.pytest_tmp/voice_preview_localized")
    shutil.rmtree(temp_root, ignore_errors=True)
    temp_root.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(voices_routes.httpx, "AsyncClient", _FakeAsyncClient)
    monkeypatch.setattr(voices_routes, "_provider_base_url", lambda provider: "http://localhost:8011")
    monkeypatch.setattr(voices_routes, "_provider_upstream_params", lambda provider, extra_params=None: extra_params or {})
    monkeypatch.setattr(voices_routes, "_tts_auth_headers", lambda provider: {})
    monkeypatch.setattr(voices_routes.settings, "backend_url", "http://localhost:8000")
    monkeypatch.setattr(voices_routes, "TEMP_DIR", temp_root)

    try:
        result = await voices_routes.test_voice(
            voice_id=1,
            payload={"text": "Привет"},
            current_user={"id": 1},
            service=_FakeVoiceService(),
            provider="f5",
        )

        assert result["success"] is True
        assert result["audio_url"].startswith("http://localhost:8000/api/tts/audio/preview_f5_")
        saved_files = list((temp_root / "tts_audio").glob("preview_f5_*"))
        assert saved_files
        assert Path(urlparse(result["audio_url"]).path).name in {path.name for path in saved_files}
    finally:
        shutil.rmtree(temp_root, ignore_errors=True)
