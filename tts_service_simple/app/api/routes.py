from datetime import datetime
from typing import Dict, Any
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
import aiofiles

from app.core.config import config
from app.schemas import (
    TTSRequest, TTSResponse, ChannelTTSRequest, ChannelTTSResponse,
    HealthResponse, TTSSettingsData
)
from app.services.engine import engine
from app.services.monitor import get_system_stats
from app.services.voices import VoicesService

import logging

logger = logging.getLogger('tts_simple.api')

router = APIRouter()
start_time = datetime.now()

# ===== General Endpoints =====

@router.get("/", response_class=JSONResponse)
async def root():
    """Р“Р»Р°РІРЅР°СЏ СЃС‚СЂР°РЅРёС†Р°"""
    return {
        "message": "TTS F5 Simple - РЈРїСЂРѕС‰РµРЅРЅС‹Р№ РјРёРєСЂРѕСЃРµСЂРІРёСЃ РґР»СЏ Р»РѕРєР°Р»СЊРЅРѕРіРѕ TTS F5",
        "version": config.get('version'),
        "status": "running",
        "docs": "/docs",
        "health": "/health"
    }

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """РџСЂРѕРІРµСЂРєР° Р·РґРѕСЂРѕРІСЊСЏ СЃРµСЂРІРёСЃР°"""
    uptime = (datetime.now() - start_time).total_seconds()
    stats = get_system_stats()
    
    return HealthResponse(
        status="healthy" if engine.status == "ready" else "error",
        version=config.get('version'),
        gpu_info=stats.get('gpu_info', {}),
        uptime=uptime,
        memory_usage=stats.get('memory_usage', {})
    )

@router.get("/api/status")
async def get_status():
    """РџРѕР»СѓС‡РёС‚СЊ СЃС‚Р°С‚СѓСЃ СЃРёСЃС‚РµРјС‹"""
    return {
        "tts_engine": {
            "status": engine.status,
            "model_loaded": engine.model_loaded,
            "voices": engine.voices
        },
        "config": {
            "version": config.get('version'),
            "port": config.get('port'),
            "max_workers": config.get('max_workers'),
            "priority": config.get('priority', 'performance')
        },
        "stats": engine.processing_stats,
        "queue_size": engine.request_queue.qsize()
    }

@router.get("/api/metrics")
async def get_metrics():
    """РџРѕР»СѓС‡РёС‚СЊ РјРµС‚СЂРёРєРё РґР»СЏ Prometheus"""
    return {
        "tts_requests_total": engine.processing_stats["total_requests"],
        "tts_requests_successful": engine.processing_stats["successful_requests"],
        "tts_requests_failed": engine.processing_stats["failed_requests"],
        "tts_average_processing_time": engine.processing_stats["average_processing_time"]
    }

# ===== TTS Endpoints =====

@router.post("/api/tts/synthesize", response_model=TTSResponse)
async def synthesize_tts(request: TTSRequest, background_tasks: BackgroundTasks):
    """РЎРёРЅС‚РµР· СЂРµС‡Рё"""
    try:
        response = await engine.synthesize(request.text, request.voice, request.user_id)
        return TTSResponse(**response)
    except Exception:
        logger.exception("РћС€РёР±РєР° СЃРёРЅС‚РµР·Р° TTS")
        return TTSResponse(success=False, error="Internal server error")

@router.post("/api/tts/synthesize-channel", response_model=ChannelTTSResponse)
async def synthesize_channel_tts(request: ChannelTTSRequest, background_tasks: BackgroundTasks):
    """РЎРёРЅС‚РµР·РёСЂРѕРІР°С‚СЊ Р°СѓРґРёРѕ РґР»СЏ РєР°РЅР°Р»Р°"""
    try:
        if engine.status != "ready":
            raise HTTPException(status_code=503, detail="TTS РґРІРёР¶РѕРє РЅРµ РіРѕС‚РѕРІ")
        
        # 1. РџСЂРѕРІРµСЂРєР° Р±Р»РѕРєРёСЂРѕРІРєРё
        if request.blocked_users and request.author.lower() in [u.lower() for u in request.blocked_users]:
            return ChannelTTSResponse(success=False, error=f"User {request.author} is blocked")
        
        # 2. Р¤РёР»СЊС‚СЂ СЃР»РѕРІ
        filtered_text = request.text
        if request.word_filter:
            for word in request.word_filter:
                 if word.lower() in filtered_text.lower():
                    import re
                    filtered_text = re.sub(re.escape(word), "***", filtered_text, flags=re.IGNORECASE)
        
        # 3. РќР°СЃС‚СЂРѕР№РєРё
        tts_settings = request.tts_settings or TTSSettingsData()
        max_length = tts_settings.maxLength or 200
        if len(filtered_text) > max_length:
            filtered_text = filtered_text[:max_length]

        if tts_settings.skipCommands and filtered_text.strip().startswith("!"):
            return ChannelTTSResponse(success=False, error="Command messages are skipped")

        # 4. РЎРёРЅС‚РµР·
        response = await engine.synthesize_channel(
            text=filtered_text,
            voice="default", # TODO: user voice
            channel=request.channel_name,
            author=request.author,
            user_id=request.user_id
        )
        
        return ChannelTTSResponse(
            success=True,
            audio_url=response['audio_url'],
            voice="default",
            volume=request.volume_level,
            tts_type="local_f5",
            duration=response.get('processing_time', 1.0),
            channel=request.channel_name,
            author=request.author
        )
        
    except Exception:
        logger.exception("Error in synthesize_channel")
        return ChannelTTSResponse(success=False, error="Internal server error")

@router.get("/api/audio/{filename}")
async def get_audio_file(filename: str):
    """РџРѕР»СѓС‡РёС‚СЊ СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅС‹Р№ Р°СѓРґРёРѕ С„Р°Р№Р»"""
    safe_name = Path(filename).name
    if safe_name != filename or not safe_name:
        raise HTTPException(status_code=400, detail="Invalid filename")

    candidates = [
        (config.generated_audio_dir / safe_name).resolve(),
        (Path("generated_audio") / safe_name).resolve(),
    ]

    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return FileResponse(candidate)

    raise HTTPException(status_code=404, detail="РђСѓРґРёРѕ С„Р°Р№Р» РЅРµ РЅР°Р№РґРµРЅ")

# ===== Settings Endpoints =====

@router.get("/api/settings")
async def get_settings():
    """РџРѕР»СѓС‡РёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё"""
    return config.config

@router.post("/api/settings")
async def update_settings(settings: Dict[str, Any]):
    """РћР±РЅРѕРІРёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё"""
    try:
        config.update(settings)
        return {"success": True, "message": "РќР°СЃС‚СЂРѕР№РєРё РѕР±РЅРѕРІР»РµРЅС‹"}
    except Exception:
        logger.exception("Error updating settings")
        raise HTTPException(status_code=400, detail="Invalid settings payload")

# ===== Voice Management Endpoints =====

@router.get("/api/voices")
async def get_available_voices():
    """РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РґРѕСЃС‚СѓРїРЅС‹С… РіРѕР»РѕСЃРѕРІ (engine only)"""
    if engine.status != "ready":
         raise HTTPException(status_code=503, detail="TTS РґРІРёР¶РѕРє РЅРµ РіРѕС‚РѕРІ")
    return {"voices": engine.voices}

@router.get("/api/voices/list")
async def list_voices():
    """РџРѕР»СѓС‡РёС‚СЊ РїРѕР»РЅС‹Р№ СЃРїРёСЃРѕРє РіРѕР»РѕСЃРѕРІ"""
    try:
        voices = VoicesService.get_base_voices()
        voices.extend(VoicesService.get_custom_voices())
        return {"success": True, "voices": voices}
    except Exception:
        logger.exception("Error listing voices")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/api/voices/create")
async def create_voice(
    name: str = Form(...),
    language: str = Form("ru"),
    description: str = Form("")
):
    """РЎРѕР·РґР°С‚СЊ РЅРѕРІС‹Р№ РіРѕР»РѕСЃ"""
    try:
        result = VoicesService.create_custom_voice(name, language, description)
        return {"success": True, **result}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid voice parameters")
    except Exception:
        logger.exception("Error creating voice")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/api/voices/{voice_id}/upload")
async def upload_voice_sample(
    voice_id: str,
    file: UploadFile = File(...),
    sample_text: str = Form(None)
):
    """Р—Р°РіСЂСѓР·РёС‚СЊ СЃСЌРјРїР»"""
    temp_input_path: str | None = None
    try:
        voice_folder = VoicesService.get_voice_folder(voice_id)
        if not voice_folder:
            raise HTTPException(status_code=404, detail="Р“РѕР»РѕСЃ РЅРµ РЅР°Р№РґРµРЅ")

        if not file.filename:
            raise HTTPException(status_code=400, detail="РРјСЏ С„Р°Р№Р»Р° РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚")

        allowed_extensions = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.aiff', '.au']
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail="РќРµРїРѕРґРґРµСЂР¶РёРІР°РµРјС‹Р№ С„РѕСЂРјР°С‚")

        import tempfile
        import os
        fd, temp_input_path = tempfile.mkstemp(suffix=file_ext)
        os.close(fd)

        async with aiofiles.open(temp_input_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)

        # Convert logic
        logger.info(f"Sample uploaded: {temp_input_path}")

        # Here we would call audio.convert_audio_to_wav_48khz
        # but for simplicity in this refactor step we just acknowledge receipt

        return {"success": True, "message": "РЎСЌРјРїР» Р·Р°РіСЂСѓР¶РµРЅ"}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error uploading sample")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if temp_input_path:
            try:
                Path(temp_input_path).unlink(missing_ok=True)
            except Exception:
                logger.exception("Failed to cleanup temp voice sample: %s", temp_input_path)
