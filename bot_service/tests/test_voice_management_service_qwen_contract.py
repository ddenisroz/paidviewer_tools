import httpx
import pytest
from fastapi import HTTPException

from services.voice_management_service import VoiceManagementService


@pytest.mark.asyncio
async def test_get_voice_info_returns_504_on_qwen_timeout(monkeypatch):
    captured_timeouts: list[float] = []

    class _FakeAsyncClient:
        def __init__(self, timeout=None, **kwargs):
            _ = kwargs
            captured_timeouts.append(float(timeout))

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, *args, **kwargs):
            _ = (args, kwargs)
            raise httpx.ReadTimeout("voice service busy")

    service = VoiceManagementService(db=object())
    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)
    monkeypatch.setattr(service, "_provider_tts_api_base", lambda provider: "http://localhost:8012/api/tts")
    monkeypatch.setattr(service, "_tts_auth_headers", lambda provider: {})
    monkeypatch.setattr(service, "_provider_request_params", lambda provider, extra=None: extra or {})

    with pytest.raises(HTTPException) as exc_info:
        await service.get_voice_info(voice_id=2, provider="qwen")

    assert exc_info.value.status_code == 504
    assert "warming up" in str(exc_info.value.detail).lower()
    assert captured_timeouts == [30.0]


@pytest.mark.asyncio
async def test_admin_upload_voice_uses_extended_timeout_for_qwen(monkeypatch):
    captured_timeouts: list[float] = []

    class _FakeAsyncClient:
        def __init__(self, timeout=None, **kwargs):
            _ = kwargs
            captured_timeouts.append(float(timeout))

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            _ = (args, kwargs)
            return httpx.Response(200, json={"success": True, "voice": {"id": 3}})

    service = VoiceManagementService(db=object())
    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)
    monkeypatch.setattr(service, "_provider_admin_api_base", lambda provider: "http://localhost:8012/api/admin")
    monkeypatch.setattr(service, "_tts_auth_headers", lambda provider: {})
    monkeypatch.setattr(service, "_provider_request_params", lambda provider, extra=None: extra or {})

    result = await service.admin_upload_voice(
        name="sample",
        filename="sample.wav",
        content=b"RIFFdata",
        content_type="audio/wav",
        provider="qwen",
    )

    assert result["success"] is True
    assert captured_timeouts == [240.0]


@pytest.mark.asyncio
async def test_admin_upload_voice_returns_504_on_qwen_timeout(monkeypatch):
    class _FakeAsyncClient:
        def __init__(self, timeout=None, **kwargs):
            _ = (timeout, kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            _ = (args, kwargs)
            raise httpx.ReadTimeout("upload still processing")

    service = VoiceManagementService(db=object())
    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)
    monkeypatch.setattr(service, "_provider_admin_api_base", lambda provider: "http://localhost:8012/api/admin")
    monkeypatch.setattr(service, "_tts_auth_headers", lambda provider: {})
    monkeypatch.setattr(service, "_provider_request_params", lambda provider, extra=None: extra or {})

    with pytest.raises(HTTPException) as exc_info:
        await service.admin_upload_voice(
            name="sample",
            filename="sample.wav",
            content=b"RIFFdata",
            content_type="audio/wav",
            provider="qwen",
        )

    assert exc_info.value.status_code == 504
    assert "processing the uploaded sample" in str(exc_info.value.detail).lower()
