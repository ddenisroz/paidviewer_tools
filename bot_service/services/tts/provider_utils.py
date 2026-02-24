"""
Helpers for provider-aware advanced TTS routing.

Supported advanced providers:
- f5
- gcloud
- qwen
"""
from __future__ import annotations

from typing import Optional, Literal

from core.config import settings

TTSProvider = Literal["f5", "gcloud", "qwen"]
ProviderMode = Literal["cloud", "local"]

_DEFAULT_PROVIDER: TTSProvider = "f5"
_DEFAULT_MODE: ProviderMode = "cloud"


def normalize_provider(provider: Optional[str]) -> TTSProvider:
    normalized = (provider or "").strip().lower()
    if normalized in {"f5", "google-f5"}:
        return "f5"
    if normalized in {"gcloud", "google_cloud", "google-cloud", "google"}:
        return "gcloud"
    if normalized in {"qwen", "qwen3", "qwen-3", "qwen3tts"}:
        return "qwen"
    return _DEFAULT_PROVIDER


def normalize_provider_mode(mode: Optional[str]) -> ProviderMode:
    normalized = (mode or "").strip().lower()
    if normalized == "local":
        return "local"
    return _DEFAULT_MODE


def normalize_engine(engine: Optional[str], provider: Optional[str] = None) -> str:
    normalized_engine = (engine or "").strip().lower()
    if normalized_engine in {"gtts", "gcloud", "f5tts", "qwen"}:
        return normalized_engine

    normalized_provider = normalize_provider(provider)
    if normalized_provider == "gcloud":
        return "gcloud"
    if normalized_provider == "qwen":
        return "qwen"
    return "f5tts"


def infer_provider_from_engine(engine: Optional[str], advanced_provider: Optional[str] = None) -> TTSProvider:
    normalized_engine = normalize_engine(engine, provider=advanced_provider)
    if normalized_engine == "gcloud":
        return "gcloud"
    if normalized_engine == "qwen":
        return "qwen"
    if normalized_engine == "f5tts":
        return "f5"
    return normalize_provider(advanced_provider)


def resolve_provider_mode_for_settings(
    *,
    engine: Optional[str],
    use_local_tts: bool,
    advanced_provider: Optional[str],
    f5_mode: Optional[str],
    qwen_mode: Optional[str],
) -> tuple[TTSProvider, ProviderMode]:
    provider = infer_provider_from_engine(engine, advanced_provider=advanced_provider)
    if provider == "gcloud":
        return provider, "cloud"

    if provider == "qwen":
        preferred = normalize_provider_mode(qwen_mode)
    else:
        preferred = normalize_provider_mode(f5_mode)

    if use_local_tts:
        return provider, "local"
    return provider, preferred


def get_provider_service_url(provider: Optional[str]) -> str:
    normalized_provider = normalize_provider(provider)
    if normalized_provider == "qwen":
        qwen_url = (settings.qwen_tts_service_url or "").strip()
        if qwen_url:
            return qwen_url

    f5_url = (settings.f5_tts_service_url or "").strip()
    if f5_url:
        return f5_url
    return "http://localhost:8001"
