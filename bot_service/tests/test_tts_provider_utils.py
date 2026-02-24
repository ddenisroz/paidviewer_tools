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

    assert provider_utils.get_provider_service_url("qwen") == "http://localhost:8001"
    assert provider_utils.get_provider_service_url("unknown") == "http://localhost:8001"


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
