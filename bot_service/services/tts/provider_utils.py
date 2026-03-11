"""
Helpers for provider-aware advanced TTS routing.

Supported advanced providers:
- f5
- gcloud
- qwen
"""

from __future__ import annotations

import ipaddress
from typing import Any, Dict, Literal, Optional
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


class ProviderRoutingError(ValueError):
    """Raised when provider routing is invalid for current deployment contract."""


def qwen_voice_crud_not_available_detail() -> Dict[str, str]:
    return {
        "code": "qwen_voice_crud_not_available",
        "message": "Qwen voice CRUD is not available in this deployment.",
        "hint": "Configure QWEN_VOICE_SERVICE_URL to enable qwen voice/admin endpoints.",
    }


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


def get_tts_gateway_url() -> str:
    """Return normalized gateway URL when configured."""
    return (settings.tts_gateway_url or "").strip().rstrip("/")


def get_provider_service_url(provider: Optional[str]) -> str:
    """Direct provider URL (not gateway) for synthesis fallback/local compatibility."""
    normalized_provider = normalize_provider(provider)
    if normalized_provider == "qwen":
        qwen_url = (settings.qwen_tts_service_url or "").strip()
        if qwen_url:
            return qwen_url

    f5_url = (settings.f5_tts_service_url or "").strip()
    if f5_url:
        return f5_url
    return "http://localhost:8011"


def get_qwen_voice_service_url() -> str:
    return (settings.qwen_voice_service_url or "").strip().rstrip("/")


def is_qwen_voice_service_enabled() -> bool:
    return bool(get_qwen_voice_service_url())


def should_route_provider_via_gateway(provider: Optional[str]) -> bool:
    """True when advanced synthesis traffic should go through gateway."""
    normalized_provider = normalize_provider(provider)
    return normalized_provider in {"f5", "qwen"} and bool(get_tts_gateway_url())


def get_synthesis_upstream_url(provider: Optional[str]) -> str:
    """Resolve synthesis upstream URL according to gateway-first contract."""
    normalized_provider = normalize_provider(provider)

    if normalized_provider == "gcloud":
        raise ProviderRoutingError("gcloud_synthesis_is_internal")

    gateway_url = get_tts_gateway_url()
    if normalized_provider == "qwen":
        if not gateway_url:
            raise ProviderRoutingError("qwen_gateway_required")
        return gateway_url

    if gateway_url:
        return gateway_url

    return get_provider_service_url(normalized_provider)


def get_synthesis_upstream_params(
    provider: Optional[str],
    extra_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build synthesis query params. Gateway mode requires explicit provider."""
    normalized_provider = normalize_provider(provider)
    params: Dict[str, Any] = dict(extra_params or {})
    if should_route_provider_via_gateway(normalized_provider):
        params.setdefault("provider", normalized_provider)
    return params


def get_voice_management_upstream_url(provider: Optional[str]) -> str:
    """Resolve voice/admin upstream URL (provider-owned, no gateway routing)."""
    normalized_provider = normalize_provider(provider)

    if normalized_provider == "gcloud":
        raise ProviderRoutingError("gcloud_voice_management_not_supported")

    if normalized_provider == "qwen":
        qwen_voice_url = get_qwen_voice_service_url()
        if not qwen_voice_url:
            raise ProviderRoutingError("qwen_voice_crud_not_available")
        return qwen_voice_url

    return get_provider_service_url("f5")


def get_voice_management_upstream_params(
    provider: Optional[str],
    extra_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Voice/admin requests are provider direct and do not require provider query param."""
    _ = provider
    return dict(extra_params or {})


def get_provider_capabilities(provider: Optional[str]) -> Dict[str, Any]:
    normalized_provider = normalize_provider(provider)
    gateway_configured = bool(get_tts_gateway_url())
    qwen_voice_enabled = is_qwen_voice_service_enabled()

    if normalized_provider == "gcloud":
        return {
            "provider": "gcloud",
            "synthesis_supported": True,
            "synthesis_available": True,
            "synthesis_requires_gateway": False,
            "synthesis_via": "internal",
            "voice_crud": False,
            "voice_admin": False,
            "voice_reason": "gcloud_managed_voices_only",
        }

    if normalized_provider == "qwen":
        payload: Dict[str, Any] = {
            "provider": "qwen",
            "synthesis_supported": True,
            "synthesis_available": gateway_configured,
            "synthesis_requires_gateway": True,
            "synthesis_via": "gateway" if gateway_configured else "unavailable",
            "voice_crud": qwen_voice_enabled,
            "voice_admin": qwen_voice_enabled,
            "voice_upstream_configured": qwen_voice_enabled,
        }
        if not qwen_voice_enabled:
            payload["voice_detail"] = qwen_voice_crud_not_available_detail()
        if not gateway_configured:
            payload["synthesis_detail"] = {
                "code": "qwen_gateway_required",
                "message": "Qwen synthesis is available only via tts-gateway.",
                "hint": "Configure TTS_GATEWAY_URL and TTS_GATEWAY_API_KEY.",
            }
        return payload

    return {
        "provider": "f5",
        "synthesis_supported": True,
        "synthesis_available": True,
        "synthesis_requires_gateway": False,
        "synthesis_via": "gateway" if gateway_configured else "direct",
        "voice_crud": True,
        "voice_admin": True,
        "voice_upstream_configured": True,
    }


def get_all_provider_capabilities() -> Dict[str, Dict[str, Any]]:
    return {
        "f5": get_provider_capabilities("f5"),
        "qwen": get_provider_capabilities("qwen"),
        "gcloud": get_provider_capabilities("gcloud"),
    }


def get_provider_upstream_url(provider: Optional[str]) -> str:
    """Backward-compatible alias for synthesis upstream resolver."""
    return get_synthesis_upstream_url(provider)


def get_provider_upstream_params(
    provider: Optional[str],
    extra_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Backward-compatible alias for synthesis upstream params."""
    return get_synthesis_upstream_params(provider, extra_params=extra_params)


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
