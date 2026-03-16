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
    ("raw_model", "expected"),
    [
        (None, provider_utils.QWEN_BASE_MODEL),
        ("", provider_utils.QWEN_BASE_MODEL),
        ("default", provider_utils.QWEN_BASE_MODEL),
        ("Qwen/Qwen3-TTS-12Hz-0.6B-Base", provider_utils.QWEN_BASE_06_MODEL),
        ("Qwen/Qwen3-TTS-12Hz-1.7B-Base", provider_utils.QWEN_BASE_17_MODEL),
        ("base", provider_utils.QWEN_BASE_MODEL),
        ("Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice", provider_utils.QWEN_CUSTOMVOICE_06_MODEL),
        ("Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice", provider_utils.QWEN_CUSTOMVOICE_17_MODEL),
        ("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", provider_utils.QWEN_VOICEDESIGN_MODEL),
        ("0.6 base", provider_utils.QWEN_BASE_06_MODEL),
        ("0.6 customvoice", provider_utils.QWEN_CUSTOMVOICE_06_MODEL),
        ("customvoice", provider_utils.QWEN_CUSTOMVOICE_MODEL),
        ("voicedesign", provider_utils.QWEN_VOICEDESIGN_MODEL),
        ("Qwen/Qwen3-TTS-12Hz-9.9B-Base", "Qwen/Qwen3-TTS-12Hz-9.9B-Base"),
    ],
)
def test_normalize_qwen_model_selection(raw_model: str | None, expected: str):
    assert provider_utils.normalize_qwen_model_selection(raw_model) == expected


def test_get_qwen_model_catalog_returns_all_exact_qwen_product_options():
    catalog = provider_utils.get_qwen_model_catalog()
    assert [item["label"] for item in catalog] == [
        "0.6 Base",
        "1.7 Base",
        "0.6 CustomVoice",
        "1.7 VoiceDesign",
        "1.7 CustomVoice",
    ]
    assert catalog[0]["supports_voice_cloning"] is True
    assert catalog[3]["requires_prompt"] is True
    assert catalog[4]["requires_prompt"] is False


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


def test_resolve_provider_mode_for_settings_prefers_explicit_provider_mode_over_legacy_flag():
    provider, mode = provider_utils.resolve_provider_mode_for_settings(
        engine="f5tts",
        use_local_tts=True,
        advanced_provider="f5",
        f5_mode="cloud",
        qwen_mode="cloud",
    )
    assert provider == "f5"
    assert mode == "cloud"


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


def test_resolve_provider_mode_for_settings_uses_legacy_use_local_only_when_provider_mode_missing():
    provider, mode = provider_utils.resolve_provider_mode_for_settings(
        engine="qwen",
        use_local_tts=True,
        advanced_provider="qwen",
        f5_mode="cloud",
        qwen_mode=None,
    )
    assert provider == "qwen"
    assert mode == "local"


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


def test_get_qwen_cloud_allowed_models_parses_family_aliases_and_exact_ids(monkeypatch):
    monkeypatch.delenv("QWEN_CLOUD_ALLOWED_MODELS", raising=False)
    monkeypatch.delenv("QWEN_ALLOWED_MODELS", raising=False)
    monkeypatch.delenv("QWEN_TTS_ALLOWED_MODELS", raising=False)
    monkeypatch.setattr(
        provider_utils.settings,
        "qwen_cloud_allowed_models",
        "base, voice_design, Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
    )

    result = provider_utils.get_qwen_cloud_allowed_models()

    assert result["enabled"] is True
    assert result["families"] == ["base", "voice_design"]
    assert result["exact_ids"] == ["Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"]
    assert result["source"] == "settings"


def test_get_qwen_cloud_allowed_models_prefers_shared_alias_env(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "qwen_cloud_allowed_models", "")
    monkeypatch.delenv("QWEN_CLOUD_ALLOWED_MODELS", raising=False)
    monkeypatch.delenv("QWEN_TTS_ALLOWED_MODELS", raising=False)
    monkeypatch.setenv("QWEN_ALLOWED_MODELS", "base")

    result = provider_utils.get_qwen_cloud_allowed_models()

    assert result["enabled"] is True
    assert result["families"] == ["base"]
    assert result["source"] == "QWEN_ALLOWED_MODELS"


def test_filter_qwen_cloud_models_filters_runtime_catalog(monkeypatch):
    monkeypatch.delenv("QWEN_CLOUD_ALLOWED_MODELS", raising=False)
    monkeypatch.delenv("QWEN_ALLOWED_MODELS", raising=False)
    monkeypatch.delenv("QWEN_TTS_ALLOWED_MODELS", raising=False)
    monkeypatch.setattr(
        provider_utils.settings,
        "qwen_cloud_allowed_models",
        "base,Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
    )

    result = provider_utils.filter_qwen_cloud_models(
        [
            {"id": provider_utils.QWEN_BASE_06_MODEL, "family": "base"},
            {"id": provider_utils.QWEN_CUSTOMVOICE_06_MODEL, "family": "custom_voice"},
            {"id": provider_utils.QWEN_VOICEDESIGN_MODEL, "family": "voice_design"},
        ]
    )

    assert [item["id"] for item in result["models"]] == [
        provider_utils.QWEN_BASE_06_MODEL,
        provider_utils.QWEN_CUSTOMVOICE_06_MODEL,
    ]
    assert result["filtering"]["enabled"] is True
    assert result["filtering"]["filtered_count"] == 1
    assert result["filtering"]["source"] == "settings"


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
    monkeypatch.setattr(provider_utils.settings, "qwen_tts_service_url", "")
    with pytest.raises(provider_utils.ProviderRoutingError, match="qwen_voice_crud_not_available"):
        provider_utils.get_voice_management_upstream_url("qwen")


def test_voice_management_url_qwen_uses_qwen_voice_service(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "qwen_voice_service_url", "http://qwen-voices:8020/")
    assert provider_utils.get_voice_management_upstream_url("qwen") == "http://qwen-voices:8020"


def test_voice_management_url_qwen_falls_back_to_qwen_tts_service(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "qwen_voice_service_url", "")
    monkeypatch.setattr(provider_utils.settings, "qwen_tts_service_url", "http://qwen:8012/")
    assert provider_utils.get_voice_management_upstream_url("qwen") == "http://qwen:8012"


def test_provider_capabilities_qwen_defaults_to_no_voice_crud(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "tts_gateway_url", "http://gateway:8010")
    monkeypatch.setattr(provider_utils.settings, "qwen_voice_service_url", "")
    monkeypatch.setattr(provider_utils.settings, "qwen_tts_service_url", "")
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


def test_provider_capabilities_qwen_enables_voice_crud_with_qwen_tts_url(monkeypatch):
    monkeypatch.setattr(provider_utils.settings, "tts_gateway_url", "http://gateway:8010")
    monkeypatch.setattr(provider_utils.settings, "qwen_voice_service_url", "")
    monkeypatch.setattr(provider_utils.settings, "qwen_tts_service_url", "http://qwen:8012")
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
