# bot_service/tests/test_api_tts.py
"""
API tests for current TTS routes.
"""


def _csrf_headers(authenticated_client):
    # Any GET /api/* sets csrf_token cookie via middleware.
    warmup = authenticated_client.get("/api/tts/status")
    assert warmup.status_code == 200
    token = authenticated_client.cookies.get("csrf_token")
    assert token
    return {"X-CSRF-Token": token}


class TestTTSAPI:
    """Tests for TTS API endpoints."""

    def test_tts_status(self, authenticated_client):
        response = authenticated_client.get("/api/tts/status")
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "engine_type" in data
        assert "advanced_provider" in data

    def test_tts_settings(self, authenticated_client):
        response = authenticated_client.get("/api/tts/settings")
        assert response.status_code == 200
        data = response.json()
        assert "engine" in data
        assert "advanced_provider" in data

    def test_update_tts_settings(self, authenticated_client):
        headers = _csrf_headers(authenticated_client)
        response = authenticated_client.post(
            "/api/tts/settings",
            json={"voice": "female_1", "maxMessageLength": 400},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True

    def test_tts_filtered_words(self, authenticated_client):
        response = authenticated_client.get("/api/tts/filtered-words")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert isinstance(data.get("data"), list)

    def test_add_and_remove_filtered_word(self, authenticated_client):
        headers = _csrf_headers(authenticated_client)

        add_response = authenticated_client.post(
            "/api/tts/filtered-words",
            json={"word": "test_word", "platform": "twitch"},
            headers=headers,
        )
        assert add_response.status_code in [200, 400]

        remove_response = authenticated_client.delete(
            "/api/tts/filtered-words/999999",
            headers=headers,
        )
        assert remove_response.status_code in [200, 404]

    def test_tts_synthesis_requires_text(self, authenticated_client):
        headers = _csrf_headers(authenticated_client)
        response = authenticated_client.post(
            "/api/tts/synthesize",
            json={"voice": "female_1"},
            headers=headers,
        )
        assert response.status_code == 400

    def test_tts_health_check(self, authenticated_client):
        f5_response = authenticated_client.get("/api/tts/health", params={"provider": "f5"})
        qwen_response = authenticated_client.get("/api/tts/health", params={"provider": "qwen"})
        gcloud_response = authenticated_client.get("/api/tts/health", params={"provider": "gcloud"})

        assert f5_response.status_code in [200, 500]
        assert qwen_response.status_code in [200, 500]
        assert gcloud_response.status_code in [200, 500]

    def test_youtube_settings_endpoints_absent_or_legacy(self, authenticated_client):
        get_response = authenticated_client.get("/api/tts/youtube-settings")
        assert get_response.status_code in [200, 404]
        token = authenticated_client.cookies.get("csrf_token")
        headers = {"X-CSRF-Token": token} if token else _csrf_headers(authenticated_client)

        post_response = authenticated_client.post(
            "/api/tts/youtube-settings",
            json={"playback_mode": "browser", "volume_level": 80},
            headers=headers,
        )
        assert post_response.status_code in [200, 404]
