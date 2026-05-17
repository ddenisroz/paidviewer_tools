"""HTTP client for the worker control plane."""

from __future__ import annotations

import base64
from typing import Any, Optional

import requests


class ControlPlaneClient:
    def __init__(self, *, server_base_url: str, worker_token: str = "", timeout_sec: float = 120.0) -> None:
        self.server_base_url = server_base_url.rstrip("/")
        self.worker_token = worker_token.strip()
        self.timeout_sec = timeout_sec

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.worker_token:
            headers["Authorization"] = f"Bearer {self.worker_token}"
        return headers

    def activate(
        self,
        *,
        pairing_code: str,
        label: str,
        supports_f5: bool,
        capabilities: dict[str, Any],
        runtime_metadata: dict[str, Any],
    ) -> dict[str, Any]:
        response = requests.post(
            f"{self.server_base_url}/api/worker-agent/activate",
            json={
                "pairing_code": pairing_code,
                "label": label,
                "supports_f5": supports_f5,
                "capabilities": capabilities,
                "runtime_metadata": runtime_metadata,
            },
            timeout=self.timeout_sec,
        )
        response.raise_for_status()
        payload = response.json()
        worker_token = str(payload.get("auth_token") or "").strip()
        if worker_token:
            self.worker_token = worker_token
        return payload

    def poll(
        self,
        *,
        max_jobs: int,
        wait_for_jobs: bool,
        supports_f5: bool,
        capabilities: dict[str, Any],
        runtime_metadata: dict[str, Any],
    ) -> dict[str, Any]:
        response = requests.post(
            f"{self.server_base_url}/api/worker-agent/poll",
            json={
                "max_jobs": max_jobs,
                "wait_for_jobs": wait_for_jobs,
                "supports_f5": supports_f5,
                "capabilities": capabilities,
                "runtime_metadata": runtime_metadata,
            },
            headers=self._headers(),
            timeout=self.timeout_sec + 30,
        )
        response.raise_for_status()
        return response.json()

    def complete_job(
        self,
        *,
        job_id: str,
        audio_bytes: bytes,
        content_type: str,
        source_url: Optional[str],
        result_payload: dict[str, Any],
    ) -> dict[str, Any]:
        response = requests.post(
            f"{self.server_base_url}/api/worker-agent/jobs/{job_id}/complete",
            json={
                "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
                "content_type": content_type,
                "source_url": source_url,
                "result_payload": result_payload,
            },
            headers=self._headers(),
            timeout=self.timeout_sec,
        )
        response.raise_for_status()
        return response.json()

    def fail_job(
        self,
        *,
        job_id: str,
        error_code: str,
        error_message: str,
        retryable: bool,
    ) -> dict[str, Any]:
        response = requests.post(
            f"{self.server_base_url}/api/worker-agent/jobs/{job_id}/fail",
            json={
                "error_code": error_code,
                "error_message": error_message,
                "retryable": retryable,
            },
            headers=self._headers(),
            timeout=self.timeout_sec,
        )
        response.raise_for_status()
        return response.json()
