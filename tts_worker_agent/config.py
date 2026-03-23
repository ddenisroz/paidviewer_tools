"""Configuration loading for the worker-agent."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


DEFAULT_CONFIG_PATH = Path(
    os.environ.get(
        "PAIDVIEWER_TTS_AGENT_CONFIG",
        Path(__file__).with_name("config.json"),
    )
)


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
            api_key=str(payload.get("api_key") or "").strip(),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": bool(self.enabled),
            "endpoint_url": self.endpoint_url,
            "api_key": self.api_key,
        }


@dataclass
class AgentConfig:
    server_base_url: str
    pairing_code: str = ""
    worker_token: str = ""
    worker_key: str = ""
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
            pairing_code=str(payload.get("pairing_code") or "").strip(),
            worker_token=str(payload.get("worker_token") or "").strip(),
            worker_key=str(payload.get("worker_key") or "").strip(),
            label=str(payload.get("label") or "TTS Worker").strip() or "TTS Worker",
            poll_interval_sec=max(1, int(payload.get("poll_interval_sec") or 2)),
            max_jobs_per_poll=max(1, min(int(payload.get("max_jobs_per_poll") or 1), 10)),
            wait_for_jobs=bool(payload.get("wait_for_jobs", True)),
            providers=providers,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "server_base_url": self.server_base_url,
            "pairing_code": self.pairing_code,
            "worker_token": self.worker_token,
            "worker_key": self.worker_key,
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
