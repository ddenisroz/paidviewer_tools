from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterator
from urllib.parse import parse_qs


REPO_ROOT = Path(__file__).resolve().parents[2]
BOT_SERVICE_ROOT = REPO_ROOT / "bot_service"

os.environ.setdefault("ENV_FILE", str(BOT_SERVICE_ROOT / ".env"))
os.environ["DEBUG"] = "true"

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(BOT_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(BOT_SERVICE_ROOT))

from core.database import SessionLocal  # noqa: E402
from repositories.worker_repository import WorkerRepository  # noqa: E402
from services.tts.tts_manager import get_tts_manager  # noqa: E402
from services.worker_control.service import WorkerControlPlaneService  # noqa: E402
from tts_worker_agent.adapters import F5Adapter, QwenAdapter  # noqa: E402


RIFF_SAMPLE = b"RIFF\x24\x00\x00\x00WAVEfmt "


def _json_bytes(payload: dict) -> bytes:
    return json.dumps(payload).encode("utf-8")


def _build_f5_handler():
    class F5Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:  # noqa: A003
            return

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/api/tts/synthesize-channel":
                self.send_error(404)
                return

            content_length = int(self.headers.get("Content-Length") or "0")
            raw_payload = self.rfile.read(content_length)
            payload = json.loads(raw_payload.decode("utf-8"))
            voice_map = payload.get("voice_map") or {}
            selected_voice = (
                payload.get("voice")
                or voice_map.get("f5")
                or "default_voice"
            )

            response = {
                "success": True,
                "audio_url": "/audio/f5.wav",
                "selected_voice": selected_voice,
                "voice": selected_voice,
                "tts_type": "ai_f5",
                "duration": 0.11,
            }
            body = _json_bytes(response)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:  # noqa: N802
            if self.path != "/audio/f5.wav":
                self.send_error(404)
                return

            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(RIFF_SAMPLE)))
            self.end_headers()
            self.wfile.write(RIFF_SAMPLE)

    return F5Handler


def _build_qwen_handler():
    class QwenHandler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:  # noqa: A003
            return

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/api/prepare":
                self.send_error(404)
                return

            content_length = int(self.headers.get("Content-Length") or "0")
            raw_payload = self.rfile.read(content_length).decode("utf-8")
            form_data = parse_qs(raw_payload)
            speaker = (form_data.get("speaker") or ["default"])[0]
            request_id = (form_data.get("request_id") or ["stream-1"])[0]

            response = {
                "stream_id": f"smoke-{request_id}",
                "speaker": speaker,
            }
            body = _json_bytes(response)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:  # noqa: N802
            if not self.path.startswith("/api/stream/"):
                self.send_error(404)
                return

            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(RIFF_SAMPLE)))
            self.end_headers()
            self.wfile.write(RIFF_SAMPLE)

    return QwenHandler


@contextmanager
def _serve(handler_cls) -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_cls)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        yield f"http://{host}:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _activate_managed_worker(*, provider: str) -> dict:
    supports_f5 = provider == "f5"
    supports_qwen = provider == "qwen"
    with SessionLocal() as db:
        service = WorkerControlPlaneService(db)
        pairing = service.issue_pairing_token(
            owner_user_id=None,
            label_hint=f"Smoke {provider.upper()} worker",
            provider_hint=provider,
            is_managed=True,
        )
        return service.activate_worker(
            pairing_code=pairing["pairing_code"],
            label=f"Smoke {provider.upper()} worker",
            supports_f5=supports_f5,
            supports_qwen=supports_qwen,
            capabilities={"providers": [provider], "runtime": "dev-smoke"},
            runtime_metadata={"hostname": "dev-smoke"},
        )


async def _process_one_worker_job(*, provider: str, worker_key: str, adapter) -> dict:
    supports_f5 = provider == "f5"
    supports_qwen = provider == "qwen"

    for _ in range(50):
        with SessionLocal() as db:
            worker = WorkerRepository(db).get_by_worker_key(worker_key)
            if worker is None:
                raise RuntimeError(f"worker {worker_key} was not found")

            service = WorkerControlPlaneService(db)
            poll_payload = service.poll_worker_jobs(
                worker=worker,
                max_jobs=1,
                supports_f5=supports_f5,
                supports_qwen=supports_qwen,
                capabilities={"providers": [provider], "runtime": "dev-smoke"},
                runtime_metadata={"hostname": "dev-smoke"},
            )
            jobs = list(poll_payload.get("jobs") or [])
            if not jobs:
                await asyncio.sleep(0.2)
                continue

            job = jobs[0]
            try:
                result = adapter.synthesize(job)
                completed = await service.complete_job(
                    worker=worker,
                    job_id=str(job["id"]),
                    audio_base64=base64.b64encode(result.audio_bytes).decode("ascii"),
                    content_type=result.content_type,
                    source_url=result.source_url,
                    result_payload=result.result_payload,
                )
                return completed
            except Exception as error:
                return service.fail_job(
                    worker=worker,
                    job_id=str(job["id"]),
                    error_code="dev_smoke_failed",
                    error_message=str(error),
                    retryable=False,
                )

    raise TimeoutError(f"worker {worker_key} did not receive a {provider} job in time")


async def _run_provider_smoke(*, provider: str, endpoint_url: str) -> None:
    activation = _activate_managed_worker(provider=provider)
    worker_key = str(activation["worker"]["worker_key"])

    if provider == "f5":
        adapter = F5Adapter(endpoint_url=endpoint_url, api_key="")
        engine = "f5tts"
        settings_dict = {
            "engine": "f5tts",
            "advanced_provider": "f5",
            "f5_mode": "cloud",
            "voice": "default_voice",
        }
    else:
        adapter = QwenAdapter(endpoint_url=endpoint_url, api_key="")
        engine = "qwen"
        settings_dict = {
            "engine": "qwen",
            "advanced_provider": "qwen",
            "qwen_mode": "cloud",
            "voice": "default",
            "qwen_voice": "default",
            "qwen_model": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
        }

    worker_task = asyncio.create_task(
        _process_one_worker_job(
            provider=provider,
            worker_key=worker_key,
            adapter=adapter,
        )
    )

    with SessionLocal() as db:
        result = await get_tts_manager().synthesize_tts(
            channel_name="dev-smoke",
            text=f"managed {provider} worker smoke",
            author="dev-smoke",
            user_id=None,
            volume_level=50.0,
            use_ai_tts=True,
            use_basic_tts=False,
            db_session=db,
            tts_settings=settings_dict,
            word_filter=[],
            blocked_users=[],
            engine=engine,
        )

    worker_result = await asyncio.wait_for(worker_task, timeout=15)

    if not result.get("success"):
        raise RuntimeError(f"{provider} smoke failed: {result}")
    if not result.get("worker_path_used"):
        raise RuntimeError(f"{provider} smoke did not use worker path: {result}")
    if result.get("provider") != provider:
        raise RuntimeError(f"{provider} smoke resolved wrong provider: {result}")
    if worker_result.get("status") != "completed":
        raise RuntimeError(f"{provider} worker job did not complete: {worker_result}")

    print(
        f"[OK] provider={provider} worker_key={result.get('worker_key')} "
        f"audio_url={result.get('audio_url')}"
    )


async def main() -> None:
    with _serve(_build_f5_handler()) as f5_url, _serve(_build_qwen_handler()) as qwen_url:
        await _run_provider_smoke(provider="f5", endpoint_url=f5_url)
        await _run_provider_smoke(provider="qwen", endpoint_url=qwen_url)
    print("[OK] managed worker smoke completed for F5 and Qwen")


if __name__ == "__main__":
    asyncio.run(main())
