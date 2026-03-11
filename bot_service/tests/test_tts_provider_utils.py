import pytest

from services.tts import provider_utils


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("f5", "f5"),
        ("google-f5", "f5"),
        ("gcloud", "gcloud"),
        ("google_cloud", "gcloud"),
        ("google-cloud", "gcloud"),
        ("google", "gcloud"),
        ("qwen", "qwen"),
        ("qwen3", "qwen"),
        ("qwen-3", "qwen"),
        ("qwen3tts", "qwen"),
        ("unknown", "f5"),
        ("", "f5"),
    ],
)
def test_normalize_provider(raw: str, expected: str):
    assert provider_utils.normalize_provider(raw) == expected


@pytest.mark.parametrize(
    ("engine", "advanced_provider", "expected"),
    [
        ("f5tts", None, "f5"),
        ("qwen", None, "qwen"),
        ("gcloud", None, "gcloud"),
        ("", "qwen", "qwen"),
        ("", "gcloud", "gcloud"),
        ("unknown", None, "f5"),
    ],
)
def test_infer_provider_from_engine(engine: str, advanced_provider: str | None, expected: str):
    assert provider_utils.infer_provider_from_engine(engine, advanced_provider=advanced_provider) == expected


@pytest.mark.parametrize(
    ("mode", "expected"),
    [
        ("local", "local"),
        ("cloud", "cloud"),
        ("", "cloud"),
        ("unexpected", "cloud"),
        (None, "cloud"),
    ],
)
def test_normalize_provider_mode(mode: str | None, expected: str):
    assert provider_utils.normalize_provider_mode(mode) == expected


def test_resolve_provider_mode_for_settings_forces_local_when_use_local_true():
    provider, mode = provider_utils.resolve_provider_mode_for_settings(
        engine="f5tts",
        use_local_tts=True,
        advanced_provider="f5",
        f5_mode="cloud",
        qwen_mode="cloud",
    )
    assert provider == "f5"
    assert mode == "local"


def test_resolve_provider_mode_for_settings_uses_qwen_mode():
    provider, mode = provider_utils.resolve_provider_mode_for_settings(
        engine="qwen",
        use_local_tts=False,
        advanced_provider="qwen",
        f5_mode="local",
        qwen_mode="cloud",
    )
    assert provider == "qwen"
    assert mode == "cloud"


def test_resolve_provider_mode_for_settings_gcloud_is_always_cloud():
    provider, mode = provider_utils.resolve_provider_mode_for_settings(
        engine="gcloud",
        use_local_tts=True,
        advanced_provider="gcloud",
        f5_mode="local",
        qwen_mode="local",
    )
    assert provider == "gcloud"
    assert mode == "cloud"


def test_get_provider_service_url_prefers_qwen_url(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "qwen_tts_service_url", "http://qwen:8011")
    monkeypatch.setattr(provider_utils.settings, "f5_tts_service_url", "http://f5:8001")

    assert provider_utils.get_provider_service_url("qwen") == "http://qwen:8011"
    assert provider_utils.get_provider_service_url("f5") == "http://f5:8001"


def test_get_provider_service_url_fallbacks(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "qwen_tts_service_url", "")
    monkeypatch.setattr(provider_utils.settings, "f5_tts_service_url", "")

    assert provider_utils.get_provider_service_url("qwen") == "http://localhost:8011"
    assert provider_utils.get_provider_service_url("unknown") == "http://localhost:8011"


def test_get_provider_upstream_url_prefers_gateway_for_advanced_providers(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "tts_gateway_url", "http://gateway:8010/")
    monkeypatch.setattr(provider_utils.settings, "qwen_tts_service_url", "http://qwen:8011")
    monkeypatch.setattr(provider_utils.settings, "f5_tts_service_url", "http://f5:8001")

    assert provider_utils.get_provider_upstream_url("f5") == "http://gateway:8010"
    assert provider_utils.get_provider_upstream_url("qwen") == "http://gateway:8010"


def test_get_provider_upstream_url_falls_back_to_provider_service_without_gateway(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "tts_gateway_url", "")
    monkeypatch.setattr(provider_utils.settings, "qwen_tts_service_url", "http://qwen:8011")
    monkeypatch.setattr(provider_utils.settings, "f5_tts_service_url", "http://f5:8001")

    assert provider_utils.get_provider_upstream_url("f5") == "http://f5:8001"
    with pytest.raises(provider_utils.ProviderRoutingError, match="qwen_gateway_required"):
        provider_utils.get_provider_upstream_url("qwen")


def test_get_provider_upstream_params_includes_provider_only_for_gateway(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "tts_gateway_url", "http://gateway:8010")
    assert provider_utils.get_provider_upstream_params("f5") == {"provider": "f5"}
    assert provider_utils.get_provider_upstream_params("qwen", {"user_id": 42}) == {"user_id": 42, "provider": "qwen"}

    monkeypatch.setattr(provider_utils.settings, "tts_gateway_url", "")
    assert provider_utils.get_provider_upstream_params("f5") == {}
    assert provider_utils.get_provider_upstream_params("qwen", {"user_id": 42}) == {"user_id": 42}


def test_voice_management_url_qwen_requires_qwen_voice_service(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "qwen_voice_service_url", "")
    with pytest.raises(provider_utils.ProviderRoutingError, match="qwen_voice_crud_not_available"):
        provider_utils.get_voice_management_upstream_url("qwen")


def test_voice_management_url_qwen_uses_qwen_voice_service(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "qwen_voice_service_url", "http://qwen-voices:8020/")
    assert provider_utils.get_voice_management_upstream_url("qwen") == "http://qwen-voices:8020"


def test_provider_capabilities_qwen_defaults_to_no_voice_crud(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "tts_gateway_url", "http://gateway:8010")
    monkeypatch.setattr(provider_utils.settings, "qwen_voice_service_url", "")
    capabilities = provider_utils.get_provider_capabilities("qwen")
    assert capabilities["provider"] == "qwen"
    assert capabilities["synthesis_available"] is True
    assert capabilities["synthesis_requires_gateway"] is True
    assert capabilities["voice_crud"] is False


def test_provider_capabilities_qwen_enables_voice_crud_with_voice_url(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "tts_gateway_url", "http://gateway:8010")
    monkeypatch.setattr(provider_utils.settings, "qwen_voice_service_url", "http://qwen-voices:8020")
    capabilities = provider_utils.get_provider_capabilities("qwen")
    assert capabilities["voice_crud"] is True
    assert capabilities["voice_admin"] is True


def test_normalize_local_tts_endpoint_url_accepts_allowed_host(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "local_tts_allowed_hosts", "localhost")
    monkeypatch.setattr(provider_utils.settings, "local_tts_allowed_cidrs", "127.0.0.0/8")

    assert provider_utils.normalize_local_tts_endpoint_url("http://localhost:8001/") == "http://localhost:8001"


def test_normalize_local_tts_endpoint_url_rejects_path(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "local_tts_allowed_hosts", "localhost")
    monkeypatch.setattr(provider_utils.settings, "local_tts_allowed_cidrs", "127.0.0.0/8")

    with pytest.raises(ValueError, match="must not contain path"):
        provider_utils.normalize_local_tts_endpoint_url("http://localhost:8001/api/health")


def test_normalize_local_tts_endpoint_url_rejects_disallowed_host(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "local_tts_allowed_hosts", "localhost")
    monkeypatch.setattr(provider_utils.settings, "local_tts_allowed_cidrs", "127.0.0.0/8")

    with pytest.raises(ValueError, match="host is not allowed"):
        provider_utils.normalize_local_tts_endpoint_url("http://evil.example:9000")


def test_normalize_local_tts_endpoint_url_allows_host_from_cidr(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "local_tts_allowed_hosts", "")
    monkeypatch.setattr(provider_utils.settings, "local_tts_allowed_cidrs", "10.0.0.0/8")

    assert provider_utils.normalize_local_tts_endpoint_url("http://10.5.6.7:8011") == "http://10.5.6.7:8011"
