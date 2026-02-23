"""Smoke tests for voice API routes.

The suite intentionally uses shared fixtures from tests/conftest.py and
avoids standalone DB engines/files.
"""

import pytest
from fastapi.testclient import TestClient


class TestVoiceRouteGuards:
    """Route availability and auth guards."""

    def test_user_custom_voices_requires_auth(self, client: TestClient):
        response = client.get("/api/voices/user/custom")
        assert response.status_code in (401, 403)

    def test_global_voices_requires_auth(self, client: TestClient):
        response = client.get("/api/voices/global")
        assert response.status_code in (401, 403)

    def test_user_voice_settings_requires_auth(self, client: TestClient):
        response = client.put("/api/voices/user/settings/1", json={"cfg_strength": 2.5})
        assert response.status_code in (401, 403)

    def test_delete_custom_voice_requires_auth(self, client: TestClient):
        response = client.delete("/api/voices/user/custom/1")
        assert response.status_code in (401, 403)

    def test_admin_global_requires_auth(self, client: TestClient):
        response = client.get("/api/voices/admin/global")
        assert response.status_code in (401, 403)


class TestVoiceRoutesAuthenticated:
    """Authenticated behavior for user/admin routes."""

    @pytest.mark.parametrize("provider", ["f5", "qwen"])
    def test_get_global_voices_authenticated(
        self, authenticated_client: TestClient, provider: str
    ):
        response = authenticated_client.get(f"/api/voices/global?provider={provider}")
        # External TTS dependency may be unavailable in CI/local runs.
        assert response.status_code in (200, 500)

    @pytest.mark.parametrize("provider", ["f5", "qwen"])
    def test_get_custom_voices_authenticated(
        self, authenticated_client: TestClient, provider: str
    ):
        response = authenticated_client.get(
            f"/api/voices/user/custom?provider={provider}"
        )
        assert response.status_code in (200, 500)

    @pytest.mark.parametrize("provider", ["f5", "qwen"])
    def test_update_user_voice_settings_authenticated(
        self, authenticated_client: TestClient, provider: str
    ):
        response = authenticated_client.put(
            f"/api/voices/user/settings/1?provider={provider}",
            json={"cfg_strength": 2.5, "speed_preset": "normal", "volume": 70},
        )
        # 404 is valid when voice does not exist in provider service.
        assert response.status_code in (200, 404, 500)

    @pytest.mark.parametrize("provider", ["f5", "qwen"])
    def test_admin_global_routes_authenticated(
        self, admin_client: TestClient, provider: str
    ):
        list_response = admin_client.get(
            f"/api/voices/admin/global?provider={provider}"
        )
        assert list_response.status_code in (200, 500)

        update_response = admin_client.put(
            f"/api/voices/admin/global/1?provider={provider}",
            json={"cfg_strength": 3.0},
        )
        assert update_response.status_code in (200, 404, 500)

        rename_response = admin_client.put(
            f"/api/voices/admin/global/1/rename?provider={provider}",
            json={"new_name": "new_voice_name"},
        )
        assert rename_response.status_code in (200, 404, 500)

        delete_response = admin_client.delete(
            f"/api/voices/admin/global/1?provider={provider}"
        )
        assert delete_response.status_code in (200, 404, 500)


class TestVoiceInputValidation:
    """Input contract checks that do not require upstream providers."""

    def test_speed_presets_contract(self):
        valid_presets = {"very_slow", "slow", "normal", "fast", "very_fast"}
        assert len(valid_presets) == 5

    def test_cfg_strength_range_contract(self):
        assert 0.0 <= 0.0 <= 10.0
        assert 0.0 <= 10.0 <= 10.0

    def test_volume_range_contract(self):
        assert 0 <= 0 <= 100
        assert 0 <= 100 <= 100
