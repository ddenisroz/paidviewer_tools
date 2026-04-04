"""Minimal localhost API for automatic worker-agent onboarding."""

from __future__ import annotations

import json
import logging
import threading
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

from requests import HTTPError

try:
    from .config import AgentConfig, apply_provisioning_bundle
    from .version import AGENT_VERSION, is_version_compatible
except ImportError:  # pragma: no cover - direct script execution fallback
    from config import AgentConfig, apply_provisioning_bundle
    from version import AGENT_VERSION, is_version_compatible


LOGGER = logging.getLogger("tts_worker_agent.local_api")

LOCAL_AGENT_HOST = "127.0.0.1"
LOCAL_AGENT_PORT = 46321


def _normalize_origin(value: Optional[str]) -> Optional[str]:
    raw_value = str(value or "").strip()
    if not raw_value:
        return None
    parsed = urlparse(raw_value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


@dataclass
class AgentRuntimeState:
    config_path: Path
    config: AgentConfig
    wake_event: threading.Event = field(default_factory=threading.Event)
    lock: threading.RLock = field(default_factory=threading.RLock)
    last_error: Optional[str] = None

    def get_config_snapshot(self) -> AgentConfig:
        with self.lock:
            return AgentConfig.from_dict(self.config.to_dict())

    def update_config(self, config: AgentConfig) -> None:
        with self.lock:
            self.config = config
            self.last_error = None
            self.wake_event.set()

    def record_error(self, message: str) -> None:
        with self.lock:
            self.last_error = message

    def apply_provisioning(self, provisioning_bundle: dict[str, Any]) -> AgentConfig:
        with self.lock:
            self.config = apply_provisioning_bundle(
                self.config,
                bundle_payload=provisioning_bundle,
                config_path=self.config_path,
            )
            self.last_error = None
            self.wake_event.set()
            return AgentConfig.from_dict(self.config.to_dict())

    def activation_completed(self, config: AgentConfig) -> None:
        self.update_config(config)

    @staticmethod
    def _error_code_from_message(message: Optional[str]) -> Optional[str]:
        normalized = str(message or "").strip().lower()
        if not normalized:
            return None
        if "version_mismatch" in normalized:
            return "version_mismatch"
        if "auth" in normalized:
            return "auth_failed"
        if "provider" in normalized and "configured" in normalized:
            return "provider_not_configured"
        if "runtime" in normalized or "failed" in normalized:
            return "local_runtime_failed"
        return "agent_error"

    def build_diagnostics_payload(self) -> dict[str, Any]:
        config = self.get_config_snapshot()
        required_version = str(config.required_agent_version or "").strip()
        version_ok = is_version_compatible(AGENT_VERSION, required_version) if required_version else True
        provider_diagnostics: dict[str, Any] = {}
        for provider_name, provider_cfg in config.providers.items():
            provider_diagnostics[provider_name] = {
                "enabled": bool(provider_cfg.enabled),
                "endpoint_url": provider_cfg.endpoint_url or None,
                "has_api_key": bool(provider_cfg.api_key),
                "configured": bool(provider_cfg.enabled and provider_cfg.endpoint_url),
            }

        return {
            "success": True,
            "agent_version": AGENT_VERSION,
            "required_agent_version": required_version or None,
            "recommended_agent_version": str(config.recommended_agent_version or "").strip() or None,
            "version_ok": version_ok,
            "paired": bool(config.worker_token),
            "worker_key": config.worker_key or None,
            "awaiting_pairing": not bool(config.worker_token),
            "label": config.label,
            "last_error": self.last_error,
            "error_code": self._error_code_from_message(self.last_error),
            "official_mode": "self_host",
            "recommended_path": "tts_worker_agent",
            "providers": provider_diagnostics,
        }

    def build_health_payload(self) -> dict[str, Any]:
        diagnostics = self.build_diagnostics_payload()
        configured_providers = [
            provider_name
            for provider_name, provider_state in diagnostics["providers"].items()
            if provider_state["configured"]
        ]
        return {
            **diagnostics,
            "configured_providers": configured_providers,
            "healthy": bool(diagnostics["version_ok"]),
        }


def _is_loopback_host(value: Optional[str]) -> bool:
    normalized = str(value or "").strip()
    return normalized in {"127.0.0.1", "::1", "localhost"}


def _extract_provisioning_bundle(payload: dict[str, Any]) -> dict[str, Any]:
    maybe_nested_bundle = payload.get("provisioning_bundle")
    if isinstance(maybe_nested_bundle, dict):
        return maybe_nested_bundle
    return payload


def _build_handler(runtime_state: AgentRuntimeState):
    class LocalApiHandler(BaseHTTPRequestHandler):
        server_version = "PaidviewerWorkerAgent/1.0"

        def log_message(self, format: str, *args: object) -> None:  # noqa: A003
            LOGGER.info("%s - %s", self.address_string(), format % args)

        def _request_origin(self) -> Optional[str]:
            return _normalize_origin(self.headers.get("Origin"))

        def _write_json(self, status_code: int, payload: dict[str, Any], *, origin: Optional[str] = None) -> None:
            response_body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response_body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.end_headers()
            self.wfile.write(response_body)

        def _reject_non_loopback(self) -> bool:
            remote_host = self.client_address[0] if self.client_address else ""
            if _is_loopback_host(remote_host):
                return False
            self._write_json(
                HTTPStatus.FORBIDDEN,
                {"success": False, "detail": "localhost_only"},
                origin=self._request_origin(),
            )
            return True

        def do_OPTIONS(self) -> None:  # noqa: N802
            if self._reject_non_loopback():
                return
            self._write_json(HTTPStatus.OK, {"success": True}, origin=self._request_origin())

        def do_GET(self) -> None:  # noqa: N802
            if self._reject_non_loopback():
                return
            if self.path == "/health":
                self._write_json(
                    HTTPStatus.OK,
                    runtime_state.build_health_payload(),
                    origin=self._request_origin(),
                )
                return

            if self.path == "/diagnostics":
                self._write_json(
                    HTTPStatus.OK,
                    runtime_state.build_diagnostics_payload(),
                    origin=self._request_origin(),
                )
                return

            if self.path != "/health":
                self._write_json(
                    HTTPStatus.NOT_FOUND,
                    {"success": False, "detail": "not_found"},
                    origin=self._request_origin(),
                )
                return

        def do_POST(self) -> None:  # noqa: N802
            if self._reject_non_loopback():
                return
            if self.path != "/api/provision":
                self._write_json(
                    HTTPStatus.NOT_FOUND,
                    {"success": False, "detail": "not_found"},
                    origin=self._request_origin(),
                )
                return

            content_length = int(self.headers.get("Content-Length") or 0)
            if content_length <= 0:
                self._write_json(
                    HTTPStatus.BAD_REQUEST,
                    {"success": False, "detail": "empty_body"},
                    origin=self._request_origin(),
                )
                return

            try:
                payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            except json.JSONDecodeError:
                self._write_json(
                    HTTPStatus.BAD_REQUEST,
                    {"success": False, "detail": "invalid_json"},
                    origin=self._request_origin(),
                )
                return

            provisioning_bundle = _extract_provisioning_bundle(payload if isinstance(payload, dict) else {})
            trusted_origins = {
                _normalize_origin(origin)
                for origin in (provisioning_bundle.get("trusted_origins") or [])
                if _normalize_origin(origin)
            }
            request_origin = self._request_origin()

            if trusted_origins and request_origin not in trusted_origins:
                self._write_json(
                    HTTPStatus.FORBIDDEN,
                    {"success": False, "detail": "origin_not_allowed"},
                    origin=request_origin,
                )
                return

            try:
                updated_config = runtime_state.apply_provisioning(provisioning_bundle)
            except (ValueError, HTTPError) as error:
                runtime_state.record_error(str(error))
                self._write_json(
                    HTTPStatus.BAD_REQUEST,
                    {"success": False, "detail": str(error)},
                    origin=request_origin,
                )
                return
            except Exception as error:  # pragma: no cover - defensive
                runtime_state.record_error(str(error))
                LOGGER.exception("Failed to apply provisioning bundle")
                self._write_json(
                    HTTPStatus.INTERNAL_SERVER_ERROR,
                    {"success": False, "detail": "internal_error"},
                    origin=request_origin,
                )
                return

            self._write_json(
                HTTPStatus.OK,
                {
                    "success": True,
                    "paired": bool(updated_config.worker_token),
                    "awaiting_activation": not bool(updated_config.worker_token),
                    "label": updated_config.label,
                },
                origin=request_origin,
            )

    return LocalApiHandler


class LocalAgentApiServer:
    def __init__(
        self,
        runtime_state: AgentRuntimeState,
        *,
        host: str = LOCAL_AGENT_HOST,
        port: int = LOCAL_AGENT_PORT,
    ) -> None:
        self.runtime_state = runtime_state
        self.host = host
        self.port = port
        self._http_server = ThreadingHTTPServer((host, port), _build_handler(runtime_state))
        self._thread = threading.Thread(
            target=self._http_server.serve_forever,
            name="PaidviewerLocalAgentApi",
            daemon=True,
        )

    def start(self) -> None:
        self._thread.start()
        LOGGER.info("Local agent API listening on http://%s:%s", self.host, self.port)

    def stop(self) -> None:
        self._http_server.shutdown()
        self._http_server.server_close()
        self._thread.join(timeout=5)
