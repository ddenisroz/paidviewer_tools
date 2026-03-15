from unittest.mock import AsyncMock, patch

import httpx
import pytest

from api.tts import settings_routes


def _csrf_headers(authenticated_client):
    # Any GET /api/* sets csrf_token cookie via middleware.
    warmup = authenticated_client.get("/api/tts/status")
    assert warmup.status_code == 200
    token = authenticated_client.cookies.get("csrf_token")
    assert token
    return {"X-CSRF-Token": token}


def test_set_engine_gcloud(authenticated_client):
    headers = _csrf_headers(authenticated_client)
    with patch(
        "services.tts.tts_service.TTSService.save_tts_settings",
        new_callable=AsyncMock,
    ) as mock_save:
        mock_save.return_value = {"success": True, "version": 2}
        response = authenticated_client.post(
            "/api/tts/engine",
            json={"engine_type": "gcloud"},
            headers=headers,
        )

    assert response.status_code == 200
    assert response.json()["engine_type"] == "gcloud"
    kwargs = mock_save.await_args.kwargs
    assert kwargs["engine"] == "gcloud"
    assert kwargs["advanced_provider"] == "gcloud"
    assert kwargs["use_local_tts"] is False


def test_set_engine_alias_cloud_maps_to_f5_cloud(authenticated_client):
    headers = _csrf_headers(authenticated_client)
    with patch(
        "services.tts.tts_service.TTSService.save_tts_settings",
        new_callable=AsyncMock,
    ) as mock_save:
        mock_save.return_value = {"success": True, "version": 2}
        response = authenticated_client.post(
            "/api/tts/engine",
            json={"engine_type": "cloud"},
            headers=headers,
        )

    assert response.status_code == 200
    assert response.json()["engine_type"] == "f5_cloud"
    kwargs = mock_save.await_args.kwargs
    assert kwargs["engine"] == "f5tts"
    assert kwargs["advanced_provider"] == "f5"
    assert kwargs["f5_mode"] == "cloud"
    assert kwargs["use_local_tts"] is False


def test_set_engine_qwen_local(authenticated_client):
    headers = _csrf_headers(authenticated_client)
    with patch(
        "services.tts.tts_service.TTSService.save_tts_settings",
        new_callable=AsyncMock,
    ) as mock_save:
        mock_save.return_value = {"success": True, "version": 2}
        response = authenticated_client.post(
            "/api/tts/engine",
            json={"engine_type": "qwen_local"},
            headers=headers,
        )

    assert response.status_code == 200
    assert response.json()["engine_type"] == "qwen_local"
    kwargs = mock_save.await_args.kwargs
    assert kwargs["engine"] == "qwen"
    assert kwargs["advanced_provider"] == "qwen"
    assert kwargs["qwen_mode"] == "local"
    assert kwargs["use_local_tts"] is True


def test_set_engine_invalid_value(authenticated_client):
    headers = _csrf_headers(authenticated_client)
    response = authenticated_client.post(
        "/api/tts/engine",
        json={"engine_type": "invalid_engine"},
        headers=headers,
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_qwen_models_catalog_reports_unavailable_when_upstream_unreachable(monkeypatch):
    async def _raise_request_error(*_args, **_kwargs):
        raise httpx.ConnectError("unreachable", request=httpx.Request("GET", "http://localhost:8012/api/models"))

    monkeypatch.setattr(settings_routes.settings, "qwen_tts_service_url", "http://localhost:8012")
    monkeypatch.setattr(settings_routes, "_fetch_qwen_models_payload", _raise_request_error)

    result = await settings_routes.get_qwen_models_catalog(mode="cloud", user={"id": 1}, db=None)

    assert result["success"] is True
    assert result["available"] is False
    assert result["models"] == []
    assert result["detail"]["code"] == "qwen_models_upstream_unreachable"
    assert result["detail"]["message"] == "Qwen worker недоступен или ещё прогревается. Список моделей runtime временно недоступен."


@pytest.mark.asyncio
async def test_qwen_models_catalog_returns_exact_runtime_models_without_product_fallback(monkeypatch):
    async def _return_payload(*_args, **_kwargs):
        return {
            "success": True,
            "current_model": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
            "models": [
                {
                    "id": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
                    "label": "0.6B Base",
                    "family": "base",
                    "supports_voice_cloning": True,
                    "requires_ref_audio": True,
                    "requires_prompt": False,
                }
            ],
        }

    monkeypatch.setattr(settings_routes.settings, "qwen_tts_service_url", "http://localhost:8012")
    monkeypatch.setattr(settings_routes, "_fetch_qwen_models_payload", _return_payload)

    result = await settings_routes.get_qwen_models_catalog(mode="cloud", user={"id": 1}, db=None)

    assert result["success"] is True
    assert result["available"] is True
    assert result["current_model"] == "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
    assert result["models"] == [
        {
            "id": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
            "label": "0.6B Base",
            "family": "base",
            "supports_voice_cloning": True,
            "requires_ref_audio": True,
            "requires_prompt": False,
        }
    ]


@pytest.mark.asyncio
async def test_qwen_models_catalog_reports_local_mode_not_configured(monkeypatch):
    class _Repo:
        def __init__(self, _db):
            pass

        def get_by_user_id(self, *_args, **_kwargs):
            return None

    monkeypatch.setattr(settings_routes, "LocalTTSRepository", _Repo)

    result = await settings_routes.get_qwen_models_catalog(mode="local", user={"id": 1}, db=object())

    assert result["success"] is True
    assert result["configured"] is False
    assert result["available"] is False
    assert result["detail"]["code"] == "qwen_local_not_configured"
    assert result["detail"]["message"] == "Self-hosted Qwen endpoint не настроен для этого пользователя."
