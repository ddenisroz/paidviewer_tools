"""Configuration loading for the worker-agent."""

from __future__ import annotations

import base64
import ctypes
import json
import os
import platform
import shutil
from ctypes import wintypes
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


PROVISIONING_KIND = "paidviewer_worker_provisioning"
PAIRING_CODE_PLACEHOLDER = "PASTE-FIRST-PAIRING-CODE-HERE"
SECRET_PREFIX = "dpapi:"

DEFAULT_CONFIG_PATH = Path(
    os.environ.get(
        "PAIDVIEWER_TTS_AGENT_CONFIG",
        Path(__file__).with_name("config.json"),
    )
)
DEFAULT_CONFIG_TEMPLATE_PATH = Path(__file__).with_name("config.example.json")


class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_char)),
    ]


def _is_windows() -> bool:
    return platform.system().lower() == "windows"


def _create_blob(raw_bytes: bytes) -> tuple[_DataBlob, ctypes.Array[ctypes.c_char]]:
    buffer = ctypes.create_string_buffer(raw_bytes)
    return _DataBlob(len(raw_bytes), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_char))), buffer


def _protect_secret(value: str) -> str:
    if not value or value.startswith(SECRET_PREFIX) or not _is_windows():
        return value

    crypt32 = getattr(ctypes, "windll", None)
    if crypt32 is None:
        return value

    input_blob, input_buffer = _create_blob(value.encode("utf-8"))
    output_blob = _DataBlob()
    description = ctypes.c_wchar_p("PaidviewerTTSAgent")
    if not ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(input_blob),
        description,
        None,
        None,
        None,
        0,
        ctypes.byref(output_blob),
    ):
        return value

    try:
        protected_bytes = ctypes.string_at(output_blob.pbData, output_blob.cbData)
        return f"{SECRET_PREFIX}{base64.b64encode(protected_bytes).decode('ascii')}"
    finally:
        del input_buffer
        if output_blob.pbData:
            ctypes.windll.kernel32.LocalFree(output_blob.pbData)


def _unprotect_secret(value: str) -> str:
    if not value or not value.startswith(SECRET_PREFIX) or not _is_windows():
        return value

    encoded_payload = value[len(SECRET_PREFIX):].strip()
    if not encoded_payload:
        return ""

    crypt32 = getattr(ctypes, "windll", None)
    if crypt32 is None:
        return value

    protected_bytes = base64.b64decode(encoded_payload.encode("ascii"))
    input_blob, input_buffer = _create_blob(protected_bytes)
    output_blob = _DataBlob()
    if not ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(input_blob),
        None,
        None,
        None,
        None,
        0,
        ctypes.byref(output_blob),
    ):
        return value

    try:
        raw_secret = ctypes.string_at(output_blob.pbData, output_blob.cbData)
        return raw_secret.decode("utf-8")
    finally:
        del input_buffer
        if output_blob.pbData:
            ctypes.windll.kernel32.LocalFree(output_blob.pbData)


@dataclass
class ProviderRuntimeConfig:
    enabled: bool = False
    endpoint_url: str = ""
    api_key: str = ""

    @classmethod
    def from_dict(cls, payload: dict[str, Any] | None) -> "ProviderRuntimeConfig":
        payload = payload or {}
        return cls(
            enabled=bool(payload.get("enabled", False)),
            endpoint_url=str(payload.get("endpoint_url") or "").strip(),
            api_key=_unprotect_secret(str(payload.get("api_key") or "").strip()),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": bool(self.enabled),
            "endpoint_url": self.endpoint_url,
            "api_key": _protect_secret(self.api_key),
        }


@dataclass
class AgentConfig:
    server_base_url: str
    pairing_code: str = ""
    worker_token: str = ""
    worker_key: str = ""
    required_agent_version: str = ""
    recommended_agent_version: str = ""
    label: str = "TTS Worker"
    poll_interval_sec: int = 2
    max_jobs_per_poll: int = 1
    wait_for_jobs: bool = True
    providers: dict[str, ProviderRuntimeConfig] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "AgentConfig":
        providers_raw = payload.get("providers") or {}
        providers = {
            "f5": ProviderRuntimeConfig.from_dict(providers_raw.get("f5")),
            "qwen": ProviderRuntimeConfig.from_dict(providers_raw.get("qwen")),
        }
        return cls(
            server_base_url=str(payload.get("server_base_url") or "").strip().rstrip("/"),
            pairing_code=cls._normalize_pairing_code(_unprotect_secret(str(payload.get("pairing_code") or "").strip())),
            worker_token=_unprotect_secret(str(payload.get("worker_token") or "").strip()),
            worker_key=_unprotect_secret(str(payload.get("worker_key") or "").strip()),
            required_agent_version=str(payload.get("required_agent_version") or "").strip(),
            recommended_agent_version=str(payload.get("recommended_agent_version") or "").strip(),
            label=str(payload.get("label") or "TTS Worker").strip() or "TTS Worker",
            poll_interval_sec=max(1, int(payload.get("poll_interval_sec") or 2)),
            max_jobs_per_poll=max(1, min(int(payload.get("max_jobs_per_poll") or 1), 10)),
            wait_for_jobs=bool(payload.get("wait_for_jobs", True)),
            providers=providers,
        )

    @staticmethod
    def _normalize_pairing_code(value: Any) -> str:
        normalized = str(value or "").strip()
        if normalized == PAIRING_CODE_PLACEHOLDER:
            return ""
        return normalized

    def to_dict(self) -> dict[str, Any]:
        return {
            "server_base_url": self.server_base_url,
            "pairing_code": _protect_secret(self.pairing_code),
            "worker_token": _protect_secret(self.worker_token),
            "worker_key": _protect_secret(self.worker_key),
            "required_agent_version": self.required_agent_version,
            "recommended_agent_version": self.recommended_agent_version,
            "label": self.label,
            "poll_interval_sec": int(self.poll_interval_sec),
            "max_jobs_per_poll": int(self.max_jobs_per_poll),
            "wait_for_jobs": bool(self.wait_for_jobs),
            "providers": {
                "f5": self.providers.get("f5", ProviderRuntimeConfig()).to_dict(),
                "qwen": self.providers.get("qwen", ProviderRuntimeConfig()).to_dict(),
            },
        }

    def validate(self) -> None:
        if not self.server_base_url:
            raise ValueError("server_base_url is required")
        enabled_providers = [
            provider_name
            for provider_name, provider_cfg in self.providers.items()
            if provider_cfg.enabled and provider_cfg.endpoint_url
        ]
        if not enabled_providers:
            raise ValueError("At least one provider runtime must be enabled and configured")


def load_config(path: Path | None = None) -> AgentConfig:
    config_path = path or DEFAULT_CONFIG_PATH
    if not config_path.exists() and DEFAULT_CONFIG_TEMPLATE_PATH.exists():
        config_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(DEFAULT_CONFIG_TEMPLATE_PATH, config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"Worker agent config was not found: {config_path}")
    with config_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    config = AgentConfig.from_dict(payload)
    config.validate()
    return config


def save_config(config: AgentConfig, path: Path | None = None) -> None:
    config_path = path or DEFAULT_CONFIG_PATH
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with config_path.open("w", encoding="utf-8") as handle:
        json.dump(config.to_dict(), handle, indent=2, ensure_ascii=True)
        handle.write("\n")


def load_provisioning_bundle(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if str(payload.get("kind") or "").strip() != PROVISIONING_KIND:
        raise ValueError(f"Provisioning file is not a {PROVISIONING_KIND} bundle: {path}")
    return payload


def find_latest_provisioning_bundle(config_path: Path) -> Path | None:
    search_roots = [config_path.parent, Path.home() / "Downloads"]
    candidates: list[Path] = []
    for root in search_roots:
        if not root.exists():
            continue
        candidates.extend(root.glob("paidviewer-worker-provisioning-*.json"))
        direct_name = root / "paidviewer-worker-provisioning.json"
        if direct_name.exists():
            candidates.append(direct_name)

    if not candidates:
        return None

    deduplicated = {candidate.resolve(): candidate for candidate in candidates if candidate.exists()}
    return max(deduplicated.values(), key=lambda candidate: candidate.stat().st_mtime)


def apply_provisioning_bundle(
    config: AgentConfig,
    *,
    bundle_payload: dict[str, Any],
    config_path: Path | None = None,
) -> AgentConfig:
    if config.worker_token:
        return config

    bundle_pairing_code = AgentConfig._normalize_pairing_code(bundle_payload.get("pairing_code"))
    if not bundle_pairing_code:
        raise ValueError("Provisioning bundle does not contain pairing_code")

    bundle_server_base_url = str(bundle_payload.get("server_base_url") or "").strip().rstrip("/")
    if bundle_server_base_url:
        config.server_base_url = bundle_server_base_url

    config.pairing_code = bundle_pairing_code
    config.required_agent_version = str(bundle_payload.get("required_agent_version") or config.required_agent_version or "").strip()
    config.recommended_agent_version = str(
        bundle_payload.get("recommended_agent_version") or config.recommended_agent_version or ""
    ).strip()
    config.label = str(bundle_payload.get("label") or config.label or "TTS Worker").strip() or "TTS Worker"
    config.poll_interval_sec = max(1, int(bundle_payload.get("poll_interval_sec") or config.poll_interval_sec))
    config.max_jobs_per_poll = max(
        1,
        min(int(bundle_payload.get("max_jobs_per_poll") or config.max_jobs_per_poll), 10),
    )
    config.wait_for_jobs = bool(bundle_payload.get("wait_for_jobs", config.wait_for_jobs))

    providers_payload = bundle_payload.get("providers") or {}
    for provider_name in ("f5", "qwen"):
        provider_payload = providers_payload.get(provider_name)
        if not isinstance(provider_payload, dict):
            continue

        current_provider = config.providers.get(provider_name, ProviderRuntimeConfig())
        if "enabled" in provider_payload:
            current_provider.enabled = bool(provider_payload.get("enabled"))

        endpoint_url = str(provider_payload.get("endpoint_url") or "").strip()
        if endpoint_url:
            current_provider.endpoint_url = endpoint_url

        api_key = str(provider_payload.get("api_key") or "").strip()
        if api_key:
            current_provider.api_key = api_key

        config.providers[provider_name] = current_provider

    if config_path is not None:
        save_config(config, config_path)
    return config


def auto_apply_latest_provisioning_bundle(
    config: AgentConfig,
    *,
    config_path: Path,
    provisioning_path: Path | None = None,
) -> tuple[AgentConfig, Path | None]:
    if config.worker_token or config.pairing_code:
        return config, None

    resolved_provisioning_path = provisioning_path or find_latest_provisioning_bundle(config_path)
    if resolved_provisioning_path is None:
        return config, None

    bundle_payload = load_provisioning_bundle(resolved_provisioning_path)
    updated_config = apply_provisioning_bundle(
        config,
        bundle_payload=bundle_payload,
        config_path=config_path,
    )
    return updated_config, resolved_provisioning_path
