import pytest
from fastapi import HTTPException

from api.tts import local_routes as tts_local_routes


@pytest.mark.asyncio
async def test_get_local_tts_config_exposes_qwen_provider_contract(monkeypatch):
    class DummyRepo:
        def __init__(self, _db):
            pass

        def get_by_user_id(self, _user_id, provider=None):
            assert provider == "qwen"
            return None

    monkeypatch.setattr(tts_local_routes, "LocalTTSRepository", DummyRepo)

    result = await tts_local_routes.get_local_tts_config(
        user={"id": 1},
        db=None,
        provider="qwen",
    )

    assert result["configured"] is False
    assert result["provider_contract"]["upstream_parity_ready"] is False
    assert result["provider_contract"]["requires_compatibility_adapter"] is True
    assert result["provider_contract"]["managed_topology"] == "gateway_managed"
    assert result["provider_contract"]["project_hosted_direct_supported"] is True
    assert result["provider_contract"]["supports_native_strict_api_key"] is False
    assert result["provider_contract"]["supports_native_health_endpoint"] is True


@pytest.mark.asyncio
async def test_qwen_test_connection_returns_contract_error_when_health_endpoint_missing(monkeypatch):
    async def _failed_health(*_args, **_kwargs):
        return {"healthy": False, "error": "HTTP 404"}

    monkeypatch.setattr(tts_local_routes, "check_local_tts_health", _failed_health)

    request = type(
        "Req",
        (),
        {"endpoint_url": "http://localhost:8012", "api_key": None, "provider": "qwen"},
    )()

    with pytest.raises(HTTPException) as exc_info:
        await tts_local_routes.test_local_tts_connection(request=request, user={"id": 1}, db=None)

    assert exc_info.value.status_code == 502
    assert "compatibility adapter" in exc_info.value.detail
    assert "voice CRUD" in exc_info.value.detail


@pytest.mark.asyncio
async def test_qwen_test_connection_returns_warning_metadata_on_success(monkeypatch):
    async def _healthy_qwen(*_args, **_kwargs):
        return {
            "healthy": True,
            "status": "healthy",
            "compatibility_mode": "qwen_prepare_stream",
            "warning": "compat note",
            "status_data": None,
        }

    monkeypatch.setattr(tts_local_routes, "check_local_tts_health", _healthy_qwen)

    request = type(
        "Req",
        (),
        {"endpoint_url": "http://localhost:8012", "api_key": None, "provider": "qwen"},
    )()

    result = await tts_local_routes.test_local_tts_connection(request=request, user={"id": 1}, db=None)

    assert result["success"] is True
    assert result["provider_contract"]["upstream_parity_ready"] is False
    assert result["warnings"]
    assert "self-hosted" in result["message"].lower()
    assert "compatibility path" in result["message"]
    assert result["status_data"] is None
