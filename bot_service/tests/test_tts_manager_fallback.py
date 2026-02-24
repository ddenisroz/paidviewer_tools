from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from services.tts.tts_manager import TTSManager


@pytest.fixture
def manager(monkeypatch):
    monkeypatch.setattr(
        "services.tts.tts_manager.get_basic_tts",
        lambda: SimpleNamespace(cleanup_old_files=lambda: None),
    )
    monkeypatch.setattr(
        "services.tts.tts_manager.get_google_cloud_tts",
        lambda: SimpleNamespace(),
    )
    return TTSManager()


@pytest.mark.asyncio
async def test_f5_cloud_unhealthy_falls_back_to_basic(manager):
    manager.check_tts_service_health = AsyncMock(return_value=False)
    manager._synthesize_via_tts_service = AsyncMock(return_value={"success": True})
    manager._synthesize_via_basic_tts = AsyncMock(
        return_value={"success": True, "tts_type": "basic_gtts"}
    )

    result = await manager.synthesize_tts(
        channel_name="chan",
        text="hello",
        author="user",
        user_id=1,
        use_ai_tts=True,
        engine="f5tts",
        tts_settings={
            "advanced_provider": "f5",
            "f5_mode": "cloud",
            "use_local_tts": False,
        },
    )

    assert result["success"] is True
    manager.check_tts_service_health.assert_awaited_once()
    manager._synthesize_via_tts_service.assert_not_awaited()
    manager._synthesize_via_basic_tts.assert_awaited_once()


@pytest.mark.asyncio
async def test_qwen_local_without_endpoint_falls_back_to_basic(manager):
    manager.get_user_tts_endpoint = AsyncMock(return_value=None)
    manager.check_tts_service_health = AsyncMock(return_value=True)
    manager._synthesize_via_tts_service = AsyncMock(return_value={"success": True})
    manager._synthesize_via_basic_tts = AsyncMock(
        return_value={"success": True, "tts_type": "basic_gtts"}
    )

    result = await manager.synthesize_tts(
        channel_name="chan",
        text="hello",
        author="user",
        user_id=7,
        db_session=object(),
        use_ai_tts=True,
        engine="qwen",
        tts_settings={
            "advanced_provider": "qwen",
            "qwen_mode": "local",
            "use_local_tts": False,
        },
    )

    assert result["success"] is True
    manager.get_user_tts_endpoint.assert_awaited_once()
    manager.check_tts_service_health.assert_not_awaited()
    manager._synthesize_via_tts_service.assert_not_awaited()
    manager._synthesize_via_basic_tts.assert_awaited_once()


@pytest.mark.asyncio
async def test_gcloud_failure_falls_back_to_basic(manager):
    manager._synthesize_via_google_cloud_tts = AsyncMock(
        return_value={"success": False, "error": "provider down"}
    )
    manager._synthesize_via_basic_tts = AsyncMock(
        return_value={"success": True, "tts_type": "basic_gtts"}
    )

    result = await manager.synthesize_tts(
        channel_name="chan",
        text="hello",
        author="user",
        user_id=1,
        use_ai_tts=False,
        engine="gcloud",
        tts_settings={"gcloud_voices": ["ru-RU-Chirp3-HD-Zephyr"]},
    )

    assert result["success"] is True
    manager._synthesize_via_google_cloud_tts.assert_awaited_once()
    manager._synthesize_via_basic_tts.assert_awaited_once()


@pytest.mark.asyncio
async def test_health_cache_scoped_by_endpoint(manager, monkeypatch):
    calls: list[str] = []
    responses = {
        "http://endpoint-a/api/health": (200, {"status": "offline"}),
        "http://endpoint-b/api/health": (200, {"status": "healthy"}),
    }

    class _FakeResponse:
        def __init__(self, status: int, payload: dict):
            self.status = status
            self._payload = payload

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def json(self):
            return self._payload

    class _FakeClientSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def get(self, url: str):
            calls.append(url)
            status, payload = responses[url]
            return _FakeResponse(status, payload)

    monkeypatch.setattr(
        "services.tts.tts_manager.aiohttp.ClientSession",
        lambda timeout=None: _FakeClientSession(),
    )
    monkeypatch.setattr(
        "services.tts.provider_utils.settings.local_tts_allowed_hosts",
        "endpoint-a,endpoint-b",
    )
    monkeypatch.setattr(
        "services.tts.provider_utils.settings.local_tts_allowed_cidrs",
        "",
    )

    result_a = await manager.check_tts_service_health(
        provider="f5",
        endpoint_override="http://endpoint-a",
    )
    result_b = await manager.check_tts_service_health(
        provider="f5",
        endpoint_override="http://endpoint-b",
    )

    assert result_a is False
    assert result_b is True
    assert "http://endpoint-b/api/health" in calls

    calls_before_cached = len(calls)
    cached_result = await manager.check_tts_service_health(
        provider="f5",
        endpoint_override="http://endpoint-b",
    )
    assert cached_result is True
    assert len(calls) == calls_before_cached
