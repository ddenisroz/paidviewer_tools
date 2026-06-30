"""Windows-first worker-agent entry point."""

from __future__ import annotations

import argparse
import logging
import platform
import socket
import sys
from pathlib import Path
from typing import Any

from requests import HTTPError

try:
    from .adapters import F5Adapter
    from .client import ControlPlaneClient
    from .config import (
        AgentConfig,
        DEFAULT_CONFIG_PATH,
        auto_apply_latest_provisioning_bundle,
        is_timestamp_expired,
        load_config,
        save_config,
    )
    from .local_api import AgentRuntimeState, LocalAgentApiServer
    from .version import AGENT_VERSION, is_version_compatible
except ImportError:  # pragma: no cover - direct script execution fallback
    from adapters import F5Adapter
    from client import ControlPlaneClient
    from config import (
        AgentConfig,
        DEFAULT_CONFIG_PATH,
        auto_apply_latest_provisioning_bundle,
        is_timestamp_expired,
        load_config,
        save_config,
    )
    from local_api import AgentRuntimeState, LocalAgentApiServer
    from version import AGENT_VERSION, is_version_compatible


LOGGER = logging.getLogger("tts_worker_agent")


def build_runtime_metadata() -> dict[str, Any]:
    return {
        "agent_version": AGENT_VERSION,
        "hostname": socket.gethostname(),
        "platform": platform.system(),
        "platform_release": platform.release(),
        "python_version": platform.python_version(),
    }


def build_adapters(config: AgentConfig):
    adapters = {}
    f5_cfg = config.providers.get("f5")
    if f5_cfg and f5_cfg.enabled and f5_cfg.endpoint_url:
        adapters["f5"] = F5Adapter(
            endpoint_url=f5_cfg.endpoint_url,
            mixed_language_endpoint_url=f5_cfg.mixed_language_endpoint_url,
            api_key=f5_cfg.api_key,
        )

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
        "agent_version": AGENT_VERSION,
        "official_mode": "self_host",
        "recommended_path": "tts_worker_agent",
    }


def ensure_agent_version(config: AgentConfig) -> None:
    required_version = str(config.required_agent_version or "").strip()
    if required_version and not is_version_compatible(AGENT_VERSION, required_version):
        raise RuntimeError(
            f"version_mismatch: worker-agent {AGENT_VERSION} is older than required version {required_version}"
        )


def activate_if_needed_v2(
    client: ControlPlaneClient,
    config: AgentConfig,
    config_path: Path,
    adapters: dict[str, Any],
) -> AgentConfig:
    if config.worker_token or not config.pairing_code:
        return config

    activation = client.activate(
        pairing_code=config.pairing_code,
        label=config.label,
        supports_f5="f5" in adapters,
        capabilities=build_capabilities(config),
        runtime_metadata=build_runtime_metadata(),
    )
    worker = activation.get("worker") or {}
    config.worker_token = str(activation.get("auth_token") or "").strip()
    config.worker_key = str(worker.get("worker_key") or "").strip()
    config.pairing_code = ""
    save_config(config, config_path)
    LOGGER.info("Worker activated successfully worker_key=%s", config.worker_key or "-")
    return config


def clear_expired_pairing_if_needed(config: AgentConfig, config_path: Path) -> AgentConfig:
    if not config.worker_token and config.pairing_code and is_timestamp_expired(config.pairing_expires_at):
        config.pairing_code = ""
        config.pairing_expires_at = ""
        save_config(config, config_path)
        LOGGER.warning("Pairing code expired. Download a fresh pairing bundle from Local TTS.")
    return config


def _wait_for_runtime_signal_v2(runtime_state: AgentRuntimeState, timeout_sec: float) -> None:
    runtime_state.wake_event.wait(timeout=max(timeout_sec, 1))
    runtime_state.wake_event.clear()


def run_agent_v2(config_path: Path, *, provisioning_path: Path | None = None) -> int:
    config = load_config(config_path)
    config, imported_bundle_path = auto_apply_latest_provisioning_bundle(
        config,
        config_path=config_path,
        provisioning_path=provisioning_path,
    )
    if imported_bundle_path is not None:
        LOGGER.info("Imported provisioning bundle from %s", imported_bundle_path)

    if not build_adapters(config):
        raise RuntimeError("No provider adapters are enabled")

    runtime_state = AgentRuntimeState(config_path=config_path, config=config)
    local_api_server = LocalAgentApiServer(runtime_state)
    local_api_server.start()

    awaiting_pairing_logged = False

    try:
        while True:
            config = runtime_state.get_config_snapshot()
            try:
                ensure_agent_version(config)
            except RuntimeError as error:
                runtime_state.record_error(str(error))
                LOGGER.error(str(error))
                _wait_for_runtime_signal_v2(runtime_state, max(config.poll_interval_sec, 5))
                continue

            if not config.worker_token and not config.pairing_code:
                config, imported_bundle_path = auto_apply_latest_provisioning_bundle(
                    config,
                    config_path=config_path,
                    provisioning_path=provisioning_path,
                )
                if imported_bundle_path is not None:
                    LOGGER.info("Imported provisioning bundle from %s", imported_bundle_path)
                    runtime_state.update_config(config)
                    provisioning_path = None

            config = runtime_state.get_config_snapshot()
            previous_pairing_code = config.pairing_code
            previous_pairing_expires_at = config.pairing_expires_at
            config = clear_expired_pairing_if_needed(config, config_path)
            if (
                config.pairing_code != previous_pairing_code
                or config.pairing_expires_at != previous_pairing_expires_at
            ):
                runtime_state.update_config(config)
            adapters = build_adapters(config)
            if not adapters:
                raise RuntimeError("No provider adapters are enabled")

            if not config.worker_token:
                if not config.pairing_code:
                    if not awaiting_pairing_logged:
                        LOGGER.info("Worker agent is awaiting provisioning from Local TTS")
                        awaiting_pairing_logged = True
                    _wait_for_runtime_signal_v2(runtime_state, config.poll_interval_sec)
                    continue

                try:
                    client = ControlPlaneClient(
                        server_base_url=config.server_base_url,
                        worker_token=config.worker_token,
                    )
                    config = activate_if_needed_v2(client, config, config_path, adapters)
                    runtime_state.activation_completed(config)
                    awaiting_pairing_logged = False
                except HTTPError as error:
                    runtime_state.record_error(str(error))
                    LOGGER.error("Worker activation failed: %s", error)
                    _wait_for_runtime_signal_v2(runtime_state, max(config.poll_interval_sec, 5))
                    continue
                except Exception as error:
                    runtime_state.record_error(str(error))
                    LOGGER.exception("Unexpected activation failure")
                    _wait_for_runtime_signal_v2(runtime_state, max(config.poll_interval_sec, 5))
                    continue

            config = runtime_state.get_config_snapshot()
            adapters = build_adapters(config)
            client = ControlPlaneClient(server_base_url=config.server_base_url, worker_token=config.worker_token)

            try:
                poll_payload = client.poll(
                    max_jobs=config.max_jobs_per_poll,
                    wait_for_jobs=config.wait_for_jobs,
                    supports_f5="f5" in adapters,
                    capabilities=build_capabilities(config),
                    runtime_metadata=build_runtime_metadata(),
                )
                jobs = list(poll_payload.get("jobs") or [])
                if not jobs:
                    _wait_for_runtime_signal_v2(runtime_state, config.poll_interval_sec)
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
                runtime_state.record_error(str(error))
                LOGGER.error("Control plane request failed: %s", error)
                _wait_for_runtime_signal_v2(runtime_state, max(config.poll_interval_sec, 5))
            except Exception as error:
                runtime_state.record_error(str(error))
                LOGGER.exception("Unexpected worker-agent failure")
                _wait_for_runtime_signal_v2(runtime_state, max(config.poll_interval_sec, 5))
    finally:
        local_api_server.stop()


def main_v2(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Paidviewer TTS worker agent")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to config.json")
    parser.add_argument("--provisioning-file", default="", help="Optional provisioning bundle JSON path")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    try:
        provisioning_path = Path(args.provisioning_file) if str(args.provisioning_file or "").strip() else None
        return run_agent_v2(Path(args.config), provisioning_path=provisioning_path)
    except KeyboardInterrupt:
        LOGGER.info("Worker agent stopped")
        return 0
    except Exception:
        LOGGER.exception("Worker agent terminated with an error")
        return 1


def activate_if_needed(client: ControlPlaneClient, config: AgentConfig, config_path: Path, adapters: dict[str, Any]) -> AgentConfig:
    """Compatibility wrapper kept for legacy imports; routes everything through the production runtime."""

    return activate_if_needed_v2(client, config, config_path, adapters)


def run_agent(config_path: Path, *, provisioning_path: Path | None = None) -> int:
    """Compatibility wrapper kept for legacy entrypoints; the production loop is run_agent_v2."""

    return run_agent_v2(config_path, provisioning_path=provisioning_path)


def main(argv: list[str] | None = None) -> int:
    """Single public CLI entrypoint for the worker agent."""

    return main_v2(argv)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
