"""
Helpers for provider-aware advanced TTS routing.

Supported advanced providers:
- f5
- gcloud
- qwen
"""
from __future__ import annotations

import ipaddress
from typing import Optional, Literal
from urllib.parse import urlparse

from core.config import settings

TTSProvider = Literal["f5", "gcloud", "qwen"]
ProviderMode = Literal["cloud", "local"]

_DEFAULT_PROVIDER: TTSProvider = "f5"
_DEFAULT_MODE: ProviderMode = "cloud"

_DEFAULT_LOCAL_TTS_ALLOWED_HOSTS = (
    "localhost",
    "127.0.0.1",
    "::1",
    "host.docker.internal",
    "f5_tts",
    "tts_service",
    "qwen_tts",
    "qwen_service",
)
_DEFAULT_LOCAL_TTS_ALLOWED_CIDRS = ("127.0.0.0/8", "::1/128")


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


def get_local_tts_allowed_hosts() -> set[str]:
    raw = getattr(settings, "local_tts_allowed_hosts", "") or ""
    values = [item.strip().lower() for item in raw.split(",") if item.strip()]
    if not values:
        values = list(_DEFAULT_LOCAL_TTS_ALLOWED_HOSTS)
    return set(values)


def get_local_tts_allowed_networks() -> tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...]:
    raw = getattr(settings, "local_tts_allowed_cidrs", "") or ""
    cidr_values = [item.strip() for item in raw.split(",") if item.strip()]
    if not cidr_values:
        cidr_values = list(_DEFAULT_LOCAL_TTS_ALLOWED_CIDRS)

    networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for value in cidr_values:
        try:
            networks.append(ipaddress.ip_network(value, strict=False))
        except ValueError:
            continue
    return tuple(networks)


def is_local_tts_host_allowed(hostname: str) -> bool:
    candidate = (hostname or "").strip().lower().strip(".")
    if not candidate:
        return False

    if candidate in get_local_tts_allowed_hosts():
        return True

    try:
        host_ip = ipaddress.ip_address(candidate)
    except ValueError:
        return False

    for network in get_local_tts_allowed_networks():
        if host_ip in network:
            return True
    return False


def normalize_local_tts_endpoint_url(endpoint_url: str) -> str:
    raw_url = (endpoint_url or "").strip()
    if not raw_url:
        raise ValueError("endpoint_url is required")

    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("endpoint_url must start with http:// or https://")

    if parsed.username or parsed.password:
        raise ValueError("endpoint_url must not contain credentials")

    if not parsed.hostname:
        raise ValueError("endpoint_url host is required")

    if parsed.path not in {"", "/"}:
        raise ValueError("endpoint_url must not contain path")

    if parsed.params or parsed.query or parsed.fragment:
        raise ValueError("endpoint_url must not contain query, params, or fragment")

    host = parsed.hostname.strip().lower().strip(".")
    if not is_local_tts_host_allowed(host):
        raise ValueError("endpoint_url host is not allowed by LOCAL_TTS_ALLOWED_HOSTS/CIDRS")

    port = parsed.port
    if port is not None and not (1 <= port <= 65535):
        raise ValueError("endpoint_url port is invalid")

    host_for_url = f"[{host}]" if ":" in host and not host.startswith("[") else host
    netloc = f"{host_for_url}:{port}" if port else host_for_url
    return f"{parsed.scheme}://{netloc}"
