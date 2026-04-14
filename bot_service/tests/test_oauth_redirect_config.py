from urllib.parse import parse_qs, urlparse


def _redirect_uri(location: str) -> str:
    return parse_qs(urlparse(location).query)["redirect_uri"][0]


def test_twitch_login_uses_configured_redirect_uri(client, monkeypatch):
    import auth.twitch_auth as twitch_auth

    expected = "http://127.0.0.1/auth/twitch/callback"
    monkeypatch.setattr(twitch_auth, "TWITCH_CLIENT_ID", "test_client_id")
    monkeypatch.setattr(twitch_auth, "TWITCH_REDIRECT_URI", expected)

    response = client.get("/auth/twitch/login", follow_redirects=False)

    assert response.status_code == 307
    assert _redirect_uri(response.headers["location"]) == expected
    assert "oauth_state=" in response.headers.get("set-cookie", "")


def test_vk_login_uses_configured_redirect_uri(client, monkeypatch):
    import auth.vk_auth as vk_auth

    expected = "http://127.0.0.1/auth/vk/callback"
    monkeypatch.setattr(vk_auth, "VK_CLIENT_ID", "test_client_id")
    monkeypatch.setattr(vk_auth, "VK_REDIRECT_URI", expected)

    response = client.get("/auth/vk/login", follow_redirects=False)

    assert response.status_code == 307
    assert _redirect_uri(response.headers["location"]) == expected
    assert "oauth_state_vk=" in response.headers.get("set-cookie", "")
