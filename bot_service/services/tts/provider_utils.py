"""
Helpers for provider-aware advanced TTS routing.

Supported advanced providers:
- f5
- gcloud
- qwen
"""

from __future__ import annotations

import ipaddress
import os
from typing import Any, Dict, Literal, Optional
from urllib.parse import urlparse, urlunparse

from core.config import settings

TTSProvider = Literal["f5", "gcloud", "qwen"]
ProviderMode = Literal["cloud", "local"]
ProviderPublicMode = Literal["cloud", "self_host"]

_DEFAULT_PROVIDER: TTSProvider = "f5"
_DEFAULT_MODE: ProviderMode = "cloud"
_DEFAULT_PUBLIC_MODE: ProviderPublicMode = "cloud"

QWEN_BASE_06_MODEL = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
QWEN_BASE_17_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
QWEN_CUSTOMVOICE_06_MODEL = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
QWEN_CUSTOMVOICE_17_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
QWEN_BASE_MODEL = QWEN_BASE_17_MODEL
QWEN_VOICEDESIGN_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
QWEN_CUSTOMVOICE_MODEL = QWEN_CUSTOMVOICE_17_MODEL
QWEN_PROMPT_MODEL = QWEN_VOICEDESIGN_MODEL
QWEN_DEFAULT_MODEL = QWEN_BASE_MODEL

_QWEN_MODEL_ALIASES = {
    "default": QWEN_DEFAULT_MODEL,
    "qwen/qwen3-tts-12hz-0.6b-base": QWEN_BASE_06_MODEL,
    "qwen/qwen3-tts-12hz-1.7b-base": QWEN_BASE_17_MODEL,
    "qwen/qwen3-tts-12hz-0.6b-customvoice": QWEN_CUSTOMVOICE_06_MODEL,
    "qwen/qwen3-tts-12hz-1.7b-customvoice": QWEN_CUSTOMVOICE_17_MODEL,
    "qwen/qwen3-tts-12hz-1.7b-voicedesign": QWEN_VOICEDESIGN_MODEL,
    "0.6 base": QWEN_BASE_06_MODEL,
    "0.6base": QWEN_BASE_06_MODEL,
    "06 base": QWEN_BASE_06_MODEL,
    "06base": QWEN_BASE_06_MODEL,
    "1.7 base": QWEN_BASE_MODEL,
    "1.7base": QWEN_BASE_MODEL,
    "base": QWEN_BASE_MODEL,
    "0.6 customvoice": QWEN_CUSTOMVOICE_06_MODEL,
    "0.6customvoice": QWEN_CUSTOMVOICE_06_MODEL,
    "06 customvoice": QWEN_CUSTOMVOICE_06_MODEL,
    "06customvoice": QWEN_CUSTOMVOICE_06_MODEL,
    "1.7 customvoice": QWEN_CUSTOMVOICE_17_MODEL,
    "1.7customvoice": QWEN_CUSTOMVOICE_17_MODEL,
    "customvoice": QWEN_CUSTOMVOICE_MODEL,
    "1.7 voicedesign": QWEN_VOICEDESIGN_MODEL,
    "1.7voicedesign": QWEN_VOICEDESIGN_MODEL,
    "voice_design": QWEN_VOICEDESIGN_MODEL,
    "voicedesign": QWEN_VOICEDESIGN_MODEL,
    "prompt": QWEN_VOICEDESIGN_MODEL,
}

_QWEN_FAMILY_ALIASES = {
    "base": "base",
    "customvoice": "custom_voice",
    "custom_voice": "custom_voice",
    "voice_design": "voice_design",
    "voicedesign": "voice_design",
    "prompt": "voice_design",
}

QWEN_MODEL_CATALOG = [
    {
        "id": QWEN_BASE_06_MODEL,
        "label": "0.6 Base",
        "family": "base",
        "supports_voice_cloning": True,
        "requires_ref_audio": True,
        "requires_prompt": False,
        "description": "Fast Base runtime for voice cloning from a stored sample and reference_text.",
    },
    {
        "id": QWEN_BASE_MODEL,
        "label": "1.7 Base",
        "family": "base",
        "supports_voice_cloning": True,
        "requires_ref_audio": True,
        "requires_prompt": False,
        "description": "Позволяет клонировать голос через загруженные sample-ы и reference_text.",
    },
    {
        "id": QWEN_CUSTOMVOICE_06_MODEL,
        "label": "0.6 CustomVoice",
        "family": "custom_voice",
        "supports_voice_cloning": False,
        "requires_ref_audio": False,
        "requires_prompt": False,
        "description": "Lightweight runtime with built-in speaker presets.",
    },
    {
        "id": QWEN_VOICEDESIGN_MODEL,
        "label": "1.7 VoiceDesign",
        "family": "voice_design",
        "supports_voice_cloning": False,
        "requires_ref_audio": False,
        "requires_prompt": True,
        "description": "Позволяет описать голос через prompt.",
    },
    {
        "id": QWEN_CUSTOMVOICE_MODEL,
        "label": "1.7 CustomVoice",
        "family": "custom_voice",
        "supports_voice_cloning": False,
        "requires_ref_audio": False,
        "requires_prompt": False,
        "description": "Генерация голоса по текстовому prompt.",
    },
]

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
_LOOPBACK_LOCAL_TTS_HOSTS = {"localhost", "127.0.0.1", "::1"}


class ProviderRoutingError(ValueError):
    """Raised when provider routing is invalid for current deployment contract."""


def qwen_voice_crud_not_available_detail() -> Dict[str, str]:
    return {
        "code": "qwen_voice_crud_not_available",
        "message": "Qwen voice CRUD is not available in this deployment.",
        "hint": "Configure QWEN_TTS_SERVICE_URL or QWEN_VOICE_SERVICE_URL to enable qwen voice/admin endpoints.",
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


def normalize_qwen_model_selection(raw_model: Optional[str]) -> str:
    candidate = str(raw_model or "").strip()
    if not candidate:
        return QWEN_DEFAULT_MODEL

    normalized = candidate.lower().strip()
    compact = normalized.replace("_", "").replace(" ", "")

    for alias, resolved in _QWEN_MODEL_ALIASES.items():
        alias_compact = alias.lower().replace("_", "").replace(" ", "")
        if normalized == alias or compact == alias_compact:
            return resolved
    return candidate


def get_qwen_model_family(raw_model: Optional[str]) -> str:
    model = normalize_qwen_model_selection(raw_model)
    normalized = model.lower()
    if "voicedesign" in normalized:
        return "voice_design"
    if "customvoice" in normalized:
        return "custom_voice"
    return "base"


def get_qwen_model_catalog() -> list[Dict[str, Any]]:
    return [dict(item) for item in QWEN_MODEL_CATALOG]


def normalize_qwen_model_family_alias(raw_family: Optional[str]) -> Optional[str]:
    candidate = str(raw_family or "").strip().lower()
    if not candidate:
        return None
    compact = candidate.replace(" ", "").replace("-", "_")
    return _QWEN_FAMILY_ALIASES.get(compact)


def get_qwen_cloud_allowed_models() -> Dict[str, Any]:
    raw = ""
    source: str | None = None
    for env_name in ("QWEN_CLOUD_ALLOWED_MODELS", "QWEN_ALLOWED_MODELS", "QWEN_TTS_ALLOWED_MODELS"):
        candidate = str(os.getenv(env_name, "") or "").strip()
        if candidate:
            raw = candidate
            source = env_name
            break

    if not raw:
        candidate = str(getattr(settings, "qwen_cloud_allowed_models", "") or "").strip()
        if candidate:
            raw = candidate
            source = "settings"

    if not raw:
        return {
            "enabled": False,
            "tokens": [],
            "families": [],
            "exact_ids": [],
            "source": None,
        }

    tokens = [item.strip() for item in raw.split(",") if item.strip()]
    families: set[str] = set()
    exact_ids: set[str] = set()

    for token in tokens:
        family = normalize_qwen_model_family_alias(token)
        if family:
            families.add(family)
            continue
        exact_ids.add(normalize_qwen_model_selection(token))

    return {
        "enabled": bool(families or exact_ids),
        "tokens": tokens,
        "families": sorted(families),
        "exact_ids": sorted(exact_ids),
        "source": source,
    }


def is_qwen_cloud_model_allowed(
    model: Dict[str, Any],
    *,
    allowed_families: set[str],
    allowed_exact_ids: set[str],
) -> bool:
    if not allowed_families and not allowed_exact_ids:
        return True

    model_id = str(model.get("id") or "").strip()
    if model_id and model_id in allowed_exact_ids:
        return True

    explicit_family = normalize_qwen_model_family_alias(model.get("family"))
    family = explicit_family or get_qwen_model_family(model_id)
    return family in allowed_families


def filter_qwen_cloud_models(models: list[Dict[str, Any]]) -> Dict[str, Any]:
    allow_config = get_qwen_cloud_allowed_models()
    if not allow_config["enabled"]:
        return {
            "models": [dict(model) for model in models],
            "filtering": {
                "enabled": False,
                "tokens": [],
                "families": [],
                "exact_ids": [],
                "filtered_count": 0,
                "source": allow_config["source"],
            },
        }

    allowed_families = set(allow_config["families"])
    allowed_exact_ids = set(allow_config["exact_ids"])
    filtered_models = [
        dict(model)
        for model in models
        if is_qwen_cloud_model_allowed(
            model,
            allowed_families=allowed_families,
            allowed_exact_ids=allowed_exact_ids,
        )
    ]
    return {
        "models": filtered_models,
        "filtering": {
            "enabled": True,
            "tokens": allow_config["tokens"],
            "families": allow_config["families"],
            "exact_ids": allow_config["exact_ids"],
            "filtered_count": max(0, len(models) - len(filtered_models)),
            "source": allow_config["source"],
        },
    }


def normalize_provider_mode(mode: Optional[str]) -> ProviderMode:
    normalized = (mode or "").strip().lower()
    if normalized in {"local", "self_host", "self-host"}:
        return "local"
    return _DEFAULT_MODE


def to_public_provider_mode(mode: Optional[str]) -> ProviderPublicMode:
    return "self_host" if normalize_provider_mode(mode) == "local" else _DEFAULT_PUBLIC_MODE


def get_official_mode_path(provider: Optional[str], public_mode: Optional[str]) -> Optional[str]:
    normalized_provider = normalize_provider(provider)
    normalized_public_mode = to_public_provider_mode(public_mode)

    if normalized_provider == "gcloud":
        return "internal" if normalized_public_mode == "cloud" else None

    if normalized_public_mode == "cloud":
        return "tts-gateway"
    return "tts_worker_agent"


def resolve_cloud_slot_policy(
    provider: Optional[str],
    *,
    is_whitelisted: bool = False,
) -> Dict[str, Any]:
    normalized_provider = normalize_provider(provider)
    policy = str(getattr(settings, "tts_cloud_slot_mode", "open") or "open").strip().lower()
    if policy not in {"open", "whitelist"}:
        policy = "open"

    if normalized_provider == "gcloud":
        return {
            "provider": normalized_provider,
            "policy": "internal",
            "slot_allowed": True,
            "degraded_reason": None,
            "error_code": None,
        }

    if policy == "whitelist" and not is_whitelisted:
        return {
            "provider": normalized_provider,
            "policy": policy,
            "slot_allowed": False,
            "degraded_reason": "Cloud capacity is limited right now. A self-host slot is recommended for this channel.",
            "error_code": "cloud_slot_required",
        }

    return {
        "provider": normalized_provider,
        "policy": policy,
        "slot_allowed": True,
        "degraded_reason": None,
        "error_code": None,
    }


def build_tts_mode_contract(
    provider: Optional[str],
    mode: Optional[str],
    *,
    available: bool,
    is_whitelisted: bool = False,
    degraded_reason: Optional[str] = None,
    error_code: Optional[str] = None,
    recommended_path: Optional[str] = None,
    capabilities: Optional[Dict[str, Any]] = None,
    upstream: Optional[Dict[str, Any]] = None,
    status: Optional[str] = None,
) -> Dict[str, Any]:
    normalized_provider = normalize_provider(provider)
    normalized_mode = normalize_provider_mode(mode)
    public_mode = to_public_provider_mode(normalized_mode)
    resolved_capabilities = dict(capabilities or get_provider_capabilities(normalized_provider))
    slot_policy = resolve_cloud_slot_policy(
        normalized_provider,
        is_whitelisted=is_whitelisted,
    ) if public_mode == "cloud" else {
        "provider": normalized_provider,
        "policy": "n/a",
        "slot_allowed": True,
        "degraded_reason": None,
        "error_code": None,
    }

    slot_allowed = bool(slot_policy["slot_allowed"])
    final_error_code = error_code or slot_policy["error_code"]
    final_degraded_reason = degraded_reason or slot_policy["degraded_reason"]
    final_available = bool(available) and slot_allowed

    official_path = get_official_mode_path(normalized_provider, public_mode)
    final_recommended_path = recommended_path or (
        get_official_mode_path(normalized_provider, "self_host")
        if public_mode == "cloud" and not slot_allowed
        else official_path
    )

    resolved_status = status
    if not resolved_status:
        if final_available:
            resolved_status = "healthy"
        elif final_error_code or final_degraded_reason:
            resolved_status = "degraded"
        else:
            resolved_status = "unavailable"

    payload = {
        "provider": normalized_provider,
        "mode": normalized_mode,
        "official_mode": public_mode,
        "available": final_available,
        "healthy": final_available,
        "status": resolved_status,
        "degraded_reason": final_degraded_reason,
        "slot_allowed": slot_allowed,
        "recommended_path": final_recommended_path,
        "official_path": official_path,
        "error_code": final_error_code,
        "capabilities": resolved_capabilities,
    }
    if upstream is not None:
        payload["upstream"] = upstream
    payload["slot_policy"] = {
        "policy": slot_policy["policy"],
        "slot_allowed": slot_allowed,
    }
    return payload


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

    preferred_mode_raw = qwen_mode if provider == "qwen" else f5_mode
    if preferred_mode_raw is not None:
        return provider, normalize_provider_mode(preferred_mode_raw)

    if use_local_tts:
        return provider, "local"
    return provider, _DEFAULT_MODE


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
    voice_url = (settings.qwen_voice_service_url or "").strip().rstrip("/")
    if voice_url:
        return voice_url
    return (settings.qwen_tts_service_url or "").strip().rstrip("/")


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
            "supports_streaming": False,
            "supports_voice_clone": False,
            "supports_voice_design": False,
            "supports_models": False,
            "supports_global_voices": False,
            "supports_user_voices": False,
            "official_modes": ["cloud"],
            "official_cloud_path": "internal",
            "official_self_host_path": None,
            "legacy_raw_endpoint_supported": False,
            "mode_contract": {
                "cloud": {"supported": True, "path": "internal", "legacy_alias": "cloud"},
                "self_host": {"supported": False, "path": None, "legacy_alias": "local"},
            },
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
            "supports_streaming": True,
            "supports_voice_clone": True,
            "supports_voice_design": True,
            "supports_models": True,
            "supports_global_voices": qwen_voice_enabled,
            "supports_user_voices": qwen_voice_enabled,
            "official_modes": ["cloud", "self_host"],
            "official_cloud_path": "tts-gateway",
            "official_self_host_path": "tts_worker_agent",
            "legacy_raw_endpoint_supported": True,
            "mode_contract": {
                "cloud": {"supported": True, "path": "tts-gateway", "legacy_alias": "cloud"},
                "self_host": {"supported": True, "path": "tts_worker_agent", "legacy_alias": "local"},
            },
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
        "supports_streaming": False,
        "supports_voice_clone": True,
        "supports_voice_design": False,
        "supports_models": False,
        "supports_global_voices": True,
        "supports_user_voices": True,
        "official_modes": ["cloud", "self_host"],
        "official_cloud_path": "tts-gateway",
        "official_self_host_path": "tts_worker_agent",
        "legacy_raw_endpoint_supported": True,
        "mode_contract": {
            "cloud": {"supported": True, "path": "tts-gateway", "legacy_alias": "cloud"},
            "self_host": {"supported": True, "path": "tts_worker_agent", "legacy_alias": "local"},
        },
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


def get_local_tts_probe_endpoints(endpoint_url: str, provider: Optional[str] = None) -> list[str]:
    """Return safe server-side probe URLs for a user-facing local endpoint.

    Browser users naturally enter localhost for a host-machine TTS runtime. When
    bot_service runs in Docker, that same hostname points back at the container,
    so health checks need a Docker-aware fallback without storing a different URL.
    """

    endpoint = normalize_local_tts_endpoint_url(endpoint_url)
    parsed = urlparse(endpoint)
    host = (parsed.hostname or "").strip().lower().strip(".")
    if host not in _LOOPBACK_LOCAL_TTS_HOSTS:
        return [endpoint]

    normalized_provider = normalize_provider(provider)
    docker_service_host = "qwen_tts" if normalized_provider == "qwen" else "tts_service"
    candidates = [endpoint]

    for replacement_host in ("host.docker.internal", docker_service_host):
        if not is_local_tts_host_allowed(replacement_host):
            continue
        host_for_url = f"[{replacement_host}]" if ":" in replacement_host else replacement_host
        netloc = f"{host_for_url}:{parsed.port}" if parsed.port else host_for_url
        candidate = urlunparse((parsed.scheme, netloc, "", "", "", ""))
        if candidate not in candidates:
            candidates.append(candidate)

    return candidates
