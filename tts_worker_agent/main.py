"""Windows-first worker-agent entry point."""

from __future__ import annotations

import argparse
import logging
import platform
import socket
import sys
import time
from pathlib import Path
from typing import Any

from requests import HTTPError

try:
    from .adapters import F5Adapter, QwenAdapter
    from .client import ControlPlaneClient
    from .config import AgentConfig, DEFAULT_CONFIG_PATH, load_config, save_config
except ImportError:  # pragma: no cover - direct script execution fallback
    from adapters import F5Adapter, QwenAdapter
    from client import ControlPlaneClient
    from config import AgentConfig, DEFAULT_CONFIG_PATH, load_config, save_config


LOGGER = logging.getLogger("tts_worker_agent")


def build_runtime_metadata() -> dict[str, Any]:
    return {
        "hostname": socket.gethostname(),
        "platform": platform.system(),
        "platform_release": platform.release(),
        "python_version": platform.python_version(),
    }


def build_adapters(config: AgentConfig):
    adapters = {}
    f5_cfg = config.providers.get("f5")
    if f5_cfg and f5_cfg.enabled and f5_cfg.endpoint_url:
        adapters["f5"] = F5Adapter(endpoint_url=f5_cfg.endpoint_url, api_key=f5_cfg.api_key)

    qwen_cfg = config.providers.get("qwen")
    if qwen_cfg and qwen_cfg.enabled and qwen_cfg.endpoint_url:
        adapters["qwen"] = QwenAdapter(endpoint_url=qwen_cfg.endpoint_url, api_key=qwen_cfg.api_key)

    return adapters


def build_capabilities(config: AgentConfig) -> dict[str, Any]:
    providers = []
    for provider_name, provider_cfg in config.providers.items():
        if provider_cfg.enabled and provider_cfg.endpoint_url:
            providers.append(provider_name)

    return {
        "providers": providers,
        "label": config.label,
        "runtime": "python-agent",
        "supports_voice_management": True,
    }


def activate_if_needed(client: ControlPlaneClient, config: AgentConfig, config_path: Path, adapters: dict[str, Any]) -> None:
    if config.worker_token:
        return
    if not config.pairing_code:
        raise RuntimeError("worker_token is empty and pairing_code is missing")

    capabilities = build_capabilities(config)
    runtime_metadata = build_runtime_metadata()
    activation = client.activate(
        pairing_code=config.pairing_code,
        label=config.label,
        supports_f5="f5" in adapters,
        supports_qwen="qwen" in adapters,
        capabilities=capabilities,
        runtime_metadata=runtime_metadata,
    )
    worker = activation.get("worker") or {}
    config.worker_token = str(activation.get("auth_token") or "").strip()
    config.worker_key = str(worker.get("worker_key") or "").strip()
    config.pairing_code = ""
    save_config(config, config_path)
    LOGGER.info("Worker activated successfully worker_key=%s", config.worker_key or "-")


def run_agent(config_path: Path) -> int:
    config = load_config(config_path)
    adapters = build_adapters(config)
    if not adapters:
        raise RuntimeError("No provider adapters are enabled")

    client = ControlPlaneClient(server_base_url=config.server_base_url, worker_token=config.worker_token)
    activate_if_needed(client, config, config_path, adapters)

    while True:
        capabilities = build_capabilities(config)
        runtime_metadata = build_runtime_metadata()
        try:
            poll_payload = client.poll(
                max_jobs=config.max_jobs_per_poll,
                wait_for_jobs=config.wait_for_jobs,
                supports_f5="f5" in adapters,
                supports_qwen="qwen" in adapters,
                capabilities=capabilities,
                runtime_metadata=runtime_metadata,
            )
            jobs = list(poll_payload.get("jobs") or [])
            if not jobs:
                time.sleep(config.poll_interval_sec)
                continue

            for job in jobs:
                provider = str(job.get("provider") or "").strip().lower()
                adapter = adapters.get(provider)
                if adapter is None:
                    client.fail_job(
                        job_id=str(job.get("id") or ""),
                        error_code="provider_not_configured",
                        error_message=f"Provider {provider or '-'} is not configured on this agent",
                        retryable=True,
                    )
                    continue

                try:
                    result = adapter.synthesize(job)
                    client.complete_job(
                        job_id=str(job.get("id") or ""),
                        audio_bytes=result.audio_bytes,
                        content_type=result.content_type,
                        source_url=result.source_url,
                        result_payload=result.result_payload,
                    )
                    LOGGER.info("Completed job=%s provider=%s", job.get("id"), provider)
                except Exception as error:
                    LOGGER.exception("Provider execution failed job=%s provider=%s", job.get("id"), provider)
                    client.fail_job(
                        job_id=str(job.get("id") or ""),
                        error_code="local_runtime_failed",
                        error_message=str(error),
                        retryable=True,
                    )
        except HTTPError as error:
            LOGGER.error("Control plane request failed: %s", error)
            time.sleep(max(config.poll_interval_sec, 5))
        except Exception:
            LOGGER.exception("Unexpected worker-agent failure")
            time.sleep(max(config.poll_interval_sec, 5))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Paidviewer TTS worker agent")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to config.json")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    try:
        return run_agent(Path(args.config))
    except KeyboardInterrupt:
        LOGGER.info("Worker agent stopped")
        return 0
    except Exception:
        LOGGER.exception("Worker agent terminated with an error")
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
