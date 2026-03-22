from __future__ import annotations

import asyncio
import time
import uuid
from pathlib import Path
from typing import Any, Optional

import aiohttp

from services.tts.provider_utils import (
    QWEN_BASE_MODEL,
    QWEN_CUSTOMVOICE_MODEL,
    QWEN_DEFAULT_MODEL,
    QWEN_VOICEDESIGN_MODEL,
    get_qwen_model_family,
    normalize_qwen_model_selection,
)

QWEN_LOCAL_DEFAULT_MODEL = QWEN_DEFAULT_MODEL
QWEN_LOCAL_DEFAULT_SPEAKER = "serena"
QWEN_LOCAL_DEFAULT_INSTRUCTION = "Neutral natural voice."
QWEN_LOCAL_MODEL_ALIASES = {
    "0.6b-customvoice": QWEN_CUSTOMVOICE_MODEL,
    "1.7b-customvoice": QWEN_CUSTOMVOICE_MODEL,
    "1.7b-voicedesign": QWEN_VOICEDESIGN_MODEL,
    "0.6b-base": QWEN_BASE_MODEL,
    "1.7b-base": QWEN_BASE_MODEL,
    "customvoice": QWEN_CUSTOMVOICE_MODEL,
    "voicedesign": QWEN_VOICEDESIGN_MODEL,
    "base": QWEN_BASE_MODEL,
}


def normalize_qwen_local_model(raw_model: Optional[str]) -> str:
    candidate = str(raw_model or "").strip()
    if not candidate or candidate.lower() == "default":
        return QWEN_LOCAL_DEFAULT_MODEL

    normalized_selection = normalize_qwen_model_selection(candidate)
    if normalized_selection in {QWEN_BASE_MODEL, QWEN_VOICEDESIGN_MODEL, QWEN_CUSTOMVOICE_MODEL}:
        return normalized_selection

    normalized = candidate.lower().replace("_", "").replace(" ", "").replace("/", "")
    for alias, resolved in QWEN_LOCAL_MODEL_ALIASES.items():
        compact_alias = alias.lower().replace("_", "").replace(" ", "").replace("/", "")
        if normalized == compact_alias:
            return resolved

    return candidate


def normalize_qwen_local_speaker(raw_speaker: Optional[str]) -> str:
    candidate = str(raw_speaker or "").strip()
    if not candidate or candidate.lower() == "default":
        return QWEN_LOCAL_DEFAULT_SPEAKER
    return candidate


def build_qwen_local_prepare_payload(
    *,
    channel_name: str,
    text: str,
    author: str,
    user_id: Optional[int],
    tts_settings: Optional[dict[str, Any]],
    detect_language_fn,
) -> tuple[aiohttp.FormData, str]:
    request_settings = dict(tts_settings or {})

    model = normalize_qwen_local_model(request_settings.get("qwen_model"))
    qwen_voice_value = str(
        request_settings.get("qwen_voice") or request_settings.get("voice") or ""
    ).strip()
    speaker = normalize_qwen_local_speaker(qwen_voice_value)
    language = "Russian" if detect_language_fn(text) == "ru" else "English"

    raw_temperature = request_settings.get("qwen_temperature", request_settings.get("temperature", 0.9))
    try:
        temperature = float(raw_temperature)
    except (TypeError, ValueError):
        temperature = 0.9
    if temperature <= 0:
        temperature = 0.9

    instruction = ""
    if get_qwen_model_family(model) != "base":
        raw_instruction = str(request_settings.get("qwen_instruction") or qwen_voice_value).strip()
        instruction = raw_instruction or QWEN_LOCAL_DEFAULT_INSTRUCTION
        speaker = ""

    tenant_id = f"user:{user_id}" if user_id else f"channel:{channel_name.lower()}" if channel_name else "bot_service"

    form = aiohttp.FormData()
    form.add_field("model", model)
    form.add_field("text", text)
    form.add_field("language", language)
    form.add_field("temperature", str(temperature))
    form.add_field("instruction", instruction)
    form.add_field("speaker", speaker)
    form.add_field("tenant_id", tenant_id)
    form.add_field("channel_name", channel_name or "")
    form.add_field("author", author or "")
    form.add_field("user_id", str(user_id or ""))

    selected_voice = instruction if instruction else speaker or QWEN_LOCAL_DEFAULT_SPEAKER
    return form, selected_voice


async def check_qwen_local_compat_health(
    *,
    session: aiohttp.ClientSession,
    endpoint: str,
    headers: dict[str, str],
) -> bool:
    probe_specs = (
        ("/health/ready", {200}),
        ("/health/live", {200}),
        ("/api/models", {200}),
        ("/api/prepare", {405, 422}),
        ("/api/status/__healthcheck__", {200, 404}),
        ("/", {200}),
    )

    for path, expected_statuses in probe_specs:
        try:
            async with session.get(f"{endpoint}{path}", headers=headers) as response:
                if response.status in expected_statuses:
                    return True
        except aiohttp.ClientError:
            continue

    return False


async def fetch_qwen_local_status(
    *,
    endpoint: str,
    headers: dict[str, str],
    stream_id: Optional[str],
) -> Optional[dict[str, Any]]:
    if not stream_id:
        return None

    timeout = aiohttp.ClientTimeout(total=5, connect=2, sock_read=5)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"{endpoint}/api/status/{stream_id}", headers=headers) as response:
                try:
                    payload: dict[str, Any] = await response.json()
                except Exception:
                    payload = {"detail": await response.text()}
                payload["http_status"] = response.status
                return payload
    except Exception as error:
        return {"error": str(error)}


async def cancel_qwen_local_stream(
    *,
    endpoint: str,
    headers: dict[str, str],
    stream_id: Optional[str],
    logger,
) -> Optional[int]:
    if not stream_id:
        return None

    timeout = aiohttp.ClientTimeout(total=5, connect=2, sock_read=5)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(f"{endpoint}/api/cancel/{stream_id}", headers=headers) as response:
                return response.status
    except Exception as error:
        logger.warning(
            "[WARN] Failed to cancel qwen local stream endpoint=%s stream_id=%s error=%s",
            endpoint,
            stream_id,
            error,
        )
        return None


async def synthesize_via_qwen_local_compat(
    *,
    channel_name: str,
    text: str,
    author: str,
    user_id: Optional[int],
    volume_level: float,
    tts_settings: Optional[dict[str, Any]],
    tts_endpoint: str,
    tts_endpoint_api_key: Optional[str],
    backend_url: str,
    temp_dir: Path,
    logger,
    detect_language_fn,
    build_tts_auth_headers_fn,
    normalize_local_tts_endpoint_url_fn,
) -> dict[str, Any]:
    try:
        endpoint = normalize_local_tts_endpoint_url_fn(tts_endpoint).rstrip("/")
    except ValueError as error:
        logger.warning("[WARN] Invalid qwen local endpoint during synthesis: %s", error)
        return {"success": False, "error": "Invalid local endpoint configuration"}

    headers = build_tts_auth_headers_fn(
        provider="qwen",
        upstream="local",
        local_api_key=tts_endpoint_api_key,
        strict=False,
    )
    form, selected_voice = build_qwen_local_prepare_payload(
        channel_name=channel_name,
        text=text,
        author=author,
        user_id=user_id,
        tts_settings=tts_settings,
        detect_language_fn=detect_language_fn,
    )

    timeout = aiohttp.ClientTimeout(total=90, connect=10, sock_read=90)
    stream_id: Optional[str] = None
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(f"{endpoint}/api/prepare", data=form, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(
                        "[ERROR] Qwen local prepare failed status=%s body=%s endpoint=%s",
                        response.status,
                        error_text,
                        endpoint,
                    )
                    return {"success": False, "error": f"Qwen local prepare failed: {response.status}"}

                prepare_payload = await response.json()
                stream_id = str(prepare_payload.get("stream_id") or "").strip()
                if not stream_id:
                    return {"success": False, "error": "Qwen local prepare returned no stream_id"}

            async with session.get(f"{endpoint}/api/stream/{stream_id}", headers=headers) as stream_response:
                if stream_response.status != 200:
                    error_text = await stream_response.text()
                    logger.error(
                        "[ERROR] Qwen local stream failed status=%s body=%s endpoint=%s stream_id=%s",
                        stream_response.status,
                        error_text,
                        endpoint,
                        stream_id,
                    )
                    return {"success": False, "error": f"Qwen local stream failed: {stream_response.status}"}

                audio_bytes = await stream_response.read()

        if not audio_bytes:
            return {"success": False, "error": "Qwen local stream returned empty audio"}

        output_dir = temp_dir / "tts_audio"
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = f"qwen_local_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}.wav"
        output_path = output_dir / filename
        await asyncio.to_thread(output_path.write_bytes, audio_bytes)

        return {
            "success": True,
            "voice": selected_voice,
            "volume": volume_level,
            "tts_type": "ai_qwen",
            "audio_url": f"{backend_url}/api/tts/audio/{filename}",
            "audio_path": str(output_path.resolve()),
        }
    except asyncio.TimeoutError:
        status_payload = await fetch_qwen_local_status(
            endpoint=endpoint,
            headers=headers,
            stream_id=stream_id,
        )
        cancel_status = await cancel_qwen_local_stream(
            endpoint=endpoint,
            headers=headers,
            stream_id=stream_id,
            logger=logger,
        )
        logger.warning(
            "[WARN] Qwen local compatibility synthesis timeout endpoint=%s stream_id=%s status_payload=%s cancel_status=%s",
            endpoint,
            stream_id or "-",
            status_payload,
            cancel_status,
        )
        return {"success": False, "error": "Request timeout"}
    except aiohttp.ClientError as error:
        logger.warning("[WARN] Qwen local compatibility synthesis connection error: %s", error)
        return {"success": False, "error": f"Connection error: {error}"}
    except Exception:
        logger.exception("[ERROR] Qwen local compatibility synthesis failed")
        return {"success": False, "error": "Internal server error"}
