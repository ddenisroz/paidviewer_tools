"""Base adapter abstractions for local provider runtimes."""

from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urljoin

import requests


@dataclass
class SynthesisResult:
    audio_bytes: bytes
    content_type: str
    source_url: Optional[str]
    result_payload: dict[str, Any]


class BaseAdapter(abc.ABC):
    provider_name: str

    def __init__(self, *, endpoint_url: str, api_key: str, timeout_sec: float = 90.0) -> None:
        self.endpoint_url = endpoint_url.rstrip("/")
        self.api_key = api_key.strip()
        self.timeout_sec = timeout_sec

    def build_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def fetch_audio_bytes(self, audio_url: str) -> tuple[bytes, str]:
        resolved_url = audio_url
        if not resolved_url.startswith(("http://", "https://")):
            resolved_url = urljoin(f"{self.endpoint_url}/", resolved_url.lstrip("/"))
        response = requests.get(
            resolved_url,
            headers=self.build_headers(),
            timeout=self.timeout_sec,
        )
        response.raise_for_status()
        return response.content, str(response.headers.get("content-type") or "audio/wav")

    @abc.abstractmethod
    def synthesize(self, job: dict[str, Any]) -> SynthesisResult:
        """Run local synthesis and return normalized audio bytes."""
