#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS F5 Simple - Упрощенный микросервис для локального TTS F5
Автоматическая настройка без сложных конфигураций
"""

import os
import sys
import json
import logging
import asyncio
import platform
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
import psutil
import GPUtil

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
import uvicorn
import aiofiles
import hashlib

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/tts_simple.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('tts_simple')

class TTSConfig:
    """Автоматическая конфигурация TTS"""
    
    def __init__(self):
        self.config_file = Path('config.json')
        self.models_dir = Path('models')
        self.logs_dir = Path('logs')
        self.voices_dir = Path('user_voices')  # Директория для пользовательских голосов
        self.samples_dir = Path('reference_audio')  # Директория для референсных сэмплов
        
        # Создаем необходимые директории
        self.models_dir.mkdir(exist_ok=True)
        self.logs_dir.mkdir(exist_ok=True)
        self.voices_dir.mkdir(exist_ok=True)
        self.samples_dir.mkdir(exist_ok=True)
        
        # Загружаем или создаем конфигурацию
        self.config = self._load_or_create_config()
        
    def _load_or_create_config(self) -> Dict[str, Any]:
        """Загружает существующую конфигурацию или создает новую"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                logger.info("Загружена существующая конфигурация")
                return config
            except Exception as e:
                logger.warning(f"Ошибка загрузки конфигурации: {e}")
        
        # Создаем новую конфигурацию
        config = self._auto_detect_config()
        self._save_config(config)
        return config
    
    def _auto_detect_config(self) -> Dict[str, Any]:
        """Автоматически определяет оптимальную конфигурацию"""
        logger.info("Автоматическое определение конфигурации...")
        
        # Определяем GPU
        gpu_info = self._detect_gpu()
        
        # Определяем оптимальные настройки
        vram_gb = gpu_info.get('memory_total', 0) / 1024**3
        
        # Проверяем лимит из .env
        max_vram_gb = float(os.getenv('GPU_MAX_VRAM_GB', '0'))
        if max_vram_gb > 0:
            vram_gb = min(vram_gb, max_vram_gb)
            logger.info(f"📊 Ограничение VRAM: {max_vram_gb} GB (используется: {vram_gb:.1f} GB)")
        
        # Проверяем приоритет из .env
        priority = os.getenv('GPU_PRIORITY', 'performance').lower()
        
        if priority == 'quality':
            # Приоритет качества - меньше параллельных задач
            if vram_gb >= 12:
                max_workers = 2
                batch_size = 2
            elif vram_gb >= 8:
                max_workers = 1
                batch_size = 1
            elif vram_gb >= 6:
                max_workers = 1
                batch_size = 1
            else:
                max_workers = 1
                batch_size = 1
                logger.warning("⚠️ Мало VRAM для режима quality! Рекомендуется минимум 6GB")
        else:
            # Приоритет производительности (по умолчанию)
            if vram_gb >= 12:
                max_workers = 4
                batch_size = 4
            elif vram_gb >= 8:
                max_workers = 3
                batch_size = 3
            elif vram_gb >= 6:
                max_workers = 2
                batch_size = 2
            else:
                max_workers = 1
                batch_size = 1
                logger.warning("⚠️ Мало VRAM! Рекомендуется минимум 6GB")
        
        # Находим свободный порт
        port = self._find_free_port()
        
        config = {
            "version": "1.0.0",
            "port": port,
            "host": "127.0.0.1",
            "gpu_info": gpu_info,
            "max_workers": max_workers,
            "batch_size": batch_size,
            "priority": priority,
            "models_dir": str(self.models_dir),
            "api_key": self._generate_api_key(),
            "auto_update": True,
            "created_at": datetime.now().isoformat(),
            "last_updated": datetime.now().isoformat()
        }
        
        logger.info(f"Конфигурация создана: порт={port}, GPU={gpu_info.get('name', 'Unknown')}, "
                   f"VRAM={vram_gb:.1f}GB, workers={max_workers}")
        
        return config
    
    def _detect_gpu(self) -> Dict[str, Any]:
        """Определяет информацию о GPU"""
        try:
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]  # Берем первую GPU
                return {
                    "name": gpu.name,
                    "memory_total": gpu.memoryTotal,
                    "memory_free": gpu.memoryFree,
                    "memory_used": gpu.memoryUsed,
                    "temperature": gpu.temperature,
                    "load": gpu.load * 100
                }
            else:
                logger.warning("NVIDIA GPU не найдена!")
                return {"name": "No GPU", "memory_total": 0}
        except Exception as e:
            logger.error(f"Ошибка определения GPU: {e}")
            return {"name": "Unknown", "memory_total": 0}
    
    def _find_free_port(self, start_port: int = 8001) -> int:
        """Находит свободный порт начиная с start_port"""
        for port in range(start_port, start_port + 10):
            try:
                import socket
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(('127.0.0.1', port))
                    return port
            except OSError:
                continue
        return start_port
    
    def _generate_api_key(self) -> str:
        """Генерирует случайный API ключ"""
        import secrets
        return secrets.token_urlsafe(32)
    
    def _save_config(self, config: Dict[str, Any]):
        """Сохраняет конфигурацию в файл"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            logger.info("Конфигурация сохранена")
        except Exception as e:
            logger.error(f"Ошибка сохранения конфигурации: {e}")
    
    def get(self, key: str, default=None):
        """Получает значение из конфигурации"""
        return self.config.get(key, default)
    
    def update(self, updates: Dict[str, Any]):
        """Обновляет конфигурацию"""
        self.config.update(updates)
        self.config['last_updated'] = datetime.now().isoformat()
        self._save_config(self.config)

# Глобальная конфигурация
config = TTSConfig()

# FastAPI приложение
app = FastAPI(
    title="TTS F5 Simple",
    description="Упрощенный микросервис для локального TTS F5",
    version=config.get('version', '1.0.0')
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic модели
class TTSRequest(BaseModel):
    text: str
    voice: str = "female_1"
    user_id: Optional[int] = None

class TTSResponse(BaseModel):
    success: bool
    audio_url: Optional[str] = None
    error: Optional[str] = None
    processing_time: Optional[float] = None

class TTSSettingsData(BaseModel):
    """Настройки TTS для фильтрации"""
    enable7TV: Optional[bool] = True
    enableTwitch: Optional[bool] = True
    enableProfanity: Optional[bool] = True
    maxLength: Optional[int] = 200
    skipCommands: Optional[bool] = True

class ChannelTTSRequest(BaseModel):
    """Запрос на синтез TTS для канала (совместимость с bot_service)"""
    channel_name: str
    text: str
    author: str
    user_id: Optional[int] = None
    volume_level: Optional[int] = 50
    tts_settings: Optional[TTSSettingsData] = None
    word_filter: Optional[List[str]] = []
    blocked_users: Optional[List[str]] = []

class ChannelTTSResponse(BaseModel):
    """Ответ на запрос синтеза для канала"""
    success: bool
    audio_url: Optional[str] = None
    voice: Optional[str] = None
    volume: Optional[int] = None
    tts_type: Optional[str] = "local_f5"
    duration: Optional[float] = None
    channel: Optional[str] = None
    author: Optional[str] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    version: str
    gpu_info: Dict[str, Any]
    uptime: float
    memory_usage: Dict[str, Any]

# Глобальные переменные
start_time = datetime.now()
tts_engine = None
request_queue = asyncio.Queue()
processing_stats = {
    "total_requests": 0,
    "successful_requests": 0,
    "failed_requests": 0,
    "average_processing_time": 0.0
}

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске"""
    logger.info("🚀 Запуск TTS F5 Simple...")
    
    # Инициализируем TTS движок
    await initialize_tts_engine()
    
    # Запускаем фоновые задачи
    asyncio.create_task(process_tts_queue())
    asyncio.create_task(monitor_system())
    
    logger.info("✅ TTS F5 Simple готов к работе!")

async def initialize_tts_engine():
    """Инициализирует TTS движок"""
    global tts_engine
    
    try:
        logger.info("Инициализация TTS движка...")
        
        # Здесь должна быть инициализация F5-TTS
        # Пока что создаем заглушку
        tts_engine = {
            "status": "ready",
            "model_loaded": True,
            "voices": ["female_1", "male_1", "female_2", "male_2"]
        }
        
        logger.info("✅ TTS движок инициализирован")
        
    except Exception as e:
        logger.error(f"❌ Ошибка инициализации TTS движка: {e}")
        tts_engine = {"status": "error", "error": str(e)}

async def process_tts_queue():
    """Обрабатывает очередь TTS запросов"""
    while True:
        try:
            # Получаем запрос из очереди
            request_data = await request_queue.get()
            
            # Обрабатываем запрос
            await process_tts_request(request_data)
            
            # Отмечаем задачу как выполненную
            request_queue.task_done()
            
        except Exception as e:
            logger.error(f"Ошибка обработки TTS запроса: {e}")

async def process_tts_request(request_data: Dict[str, Any]):
    """Обрабатывает один TTS запрос"""
    start_time = datetime.now()
    
    try:
        # Здесь должна быть реальная генерация аудио
        # Пока что создаем заглушку
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Обновляем статистику
        processing_stats["total_requests"] += 1
        processing_stats["successful_requests"] += 1
        processing_stats["average_processing_time"] = (
            processing_stats["average_processing_time"] + processing_time
        ) / 2
        
        logger.info(f"✅ TTS запрос обработан за {processing_time:.2f}с")
        
    except Exception as e:
        processing_stats["failed_requests"] += 1
        logger.error(f"❌ Ошибка обработки TTS запроса: {e}")

async def monitor_system():
    """Мониторинг системы"""
    while True:
        try:
            # Проверяем использование памяти
            memory = psutil.virtual_memory()
            
            # Проверяем GPU
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]
                if gpu.memoryUsed / gpu.memoryTotal > 0.9:
                    logger.warning("⚠️ Высокое использование GPU памяти!")
            
            # Ждем 30 секунд
            await asyncio.sleep(30)
            
        except Exception as e:
            logger.error(f"Ошибка мониторинга: {e}")
            await asyncio.sleep(60)

# API Endpoints

@app.get("/", response_class=JSONResponse)
async def root():
    """Главная страница"""
    return {
        "message": "TTS F5 Simple - Упрощенный микросервис для локального TTS F5",
        "version": config.get('version'),
        "status": "running",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Проверка здоровья сервиса"""
    uptime = (datetime.now() - start_time).total_seconds()
    
    # Информация о GPU
    gpu_info = config.get('gpu_info', {})
    
    # Использование памяти
    memory = psutil.virtual_memory()
    memory_usage = {
        "total": memory.total,
        "available": memory.available,
        "used": memory.used,
        "percentage": memory.percent
    }
    
    return HealthResponse(
        status="healthy" if tts_engine and tts_engine.get("status") == "ready" else "error",
        version=config.get('version'),
        gpu_info=gpu_info,
        uptime=uptime,
        memory_usage=memory_usage
    )

@app.post("/api/tts/synthesize", response_model=TTSResponse)
async def synthesize_tts(request: TTSRequest, background_tasks: BackgroundTasks):
    """Синтез речи"""
    try:
        if not tts_engine or tts_engine.get("status") != "ready":
            raise HTTPException(status_code=503, detail="TTS движок не готов")
        
        # Добавляем запрос в очередь
        request_data = {
            "text": request.text,
            "voice": request.voice,
            "user_id": request.user_id,
            "timestamp": datetime.now().isoformat()
        }
        
        await request_queue.put(request_data)
        
        # Здесь должна быть реальная генерация
        # Пока что возвращаем заглушку
        return TTSResponse(
            success=True,
            audio_url=f"/api/audio/generated_{datetime.now().timestamp()}.wav",
            processing_time=1.5
        )
        
    except Exception as e:
        logger.error(f"Ошибка синтеза TTS: {e}")
        return TTSResponse(
            success=False,
            error=str(e)
        )

@app.post("/api/tts/synthesize-channel", response_model=ChannelTTSResponse)
async def synthesize_channel_tts(request: ChannelTTSRequest, background_tasks: BackgroundTasks):
    """
    Синтезировать аудио для канала (совместимость с bot_service)
    Используется для автоматической озвучки сообщений из Twitch/VK чата
    """
    try:
        if not tts_engine or tts_engine.get("status") != "ready":
            raise HTTPException(status_code=503, detail="TTS движок не готов")
        
        logger.info(f"🎙️ [CHANNEL TTS] {request.channel_name} | {request.author}: {request.text[:50]}...")
        
        # 1. Проверка блокировки пользователя
        if request.blocked_users and request.author.lower() in [u.lower() for u in request.blocked_users]:
            logger.warning(f"⚠️ User {request.author} is blocked, skipping TTS")
            return ChannelTTSResponse(
                success=False,
                error=f"User {request.author} is blocked"
            )
        
        # 2. Применяем фильтр слов
        filtered_text = request.text
        if request.word_filter:
            for word in request.word_filter:
                if word.lower() in filtered_text.lower():
                    import re
                    filtered_text = re.sub(re.escape(word), "***", filtered_text, flags=re.IGNORECASE)
                    logger.info(f"🔇 Filtered word '{word}' in message")
        
        # 3. Применяем настройки TTS
        tts_settings = request.tts_settings or TTSSettingsData()
        
        max_length = tts_settings.maxLength or 200
        if len(filtered_text) > max_length:
            filtered_text = filtered_text[:max_length]
            logger.info(f"✂️ Trimmed message to {max_length} chars")
        
        # Пропускаем команды если нужно
        if tts_settings.skipCommands and filtered_text.strip().startswith("!"):
            logger.info(f"⏭️ Skipping command: {filtered_text}")
            return ChannelTTSResponse(
                success=False,
                error="Command messages are skipped"
            )
        
        # 4. Синтезируем речь
        logger.info(f"🎤 Synthesizing: '{filtered_text[:50]}...' with volume={request.volume_level}%")
        
        # Добавляем запрос в очередь
        request_data = {
            "text": filtered_text,
            "voice": "default",  # TODO: использовать голос пользователя из настроек
            "user_id": request.user_id,
            "timestamp": datetime.now().isoformat(),
            "channel": request.channel_name,
            "author": request.author
        }
        
        await request_queue.put(request_data)
        
        # TODO: Реальная генерация аудио
        # Пока что возвращаем заглушку с корректными данными
        audio_filename = f"channel_{request.channel_name}_{datetime.now().timestamp()}.wav"
        
        return ChannelTTSResponse(
            success=True,
            audio_url=f"/api/audio/{audio_filename}",
            voice="default",
            volume=request.volume_level,
            tts_type="local_f5",
            duration=1.5,
            channel=request.channel_name,
            author=request.author
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in synthesize_channel: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return ChannelTTSResponse(
            success=False,
            error=str(e)
        )

@app.get("/api/voices")
async def get_available_voices():
    """Получить список доступных голосов"""
    if not tts_engine:
        raise HTTPException(status_code=503, detail="TTS движок не инициализирован")
    
    return {
        "voices": tts_engine.get("voices", [])
    }

@app.get("/api/status")
async def get_status():
    """Получить статус системы"""
    return {
        "tts_engine": tts_engine,
        "config": {
            "version": config.get('version'),
            "port": config.get('port'),
            "max_workers": config.get('max_workers'),
            "priority": config.get('priority', 'performance')
        },
        "stats": processing_stats,
        "queue_size": request_queue.qsize()
    }

@app.get("/api/settings")
async def get_settings():
    """Получить настройки"""
    return config.config

@app.post("/api/settings")
async def update_settings(settings: Dict[str, Any]):
    """Обновить настройки"""
    try:
        config.update(settings)
        return {"success": True, "message": "Настройки обновлены"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/metrics")
async def get_metrics():
    """Получить метрики для Prometheus"""
    # Здесь должны быть метрики в формате Prometheus
    return {
        "tts_requests_total": processing_stats["total_requests"],
        "tts_requests_successful": processing_stats["successful_requests"],
        "tts_requests_failed": processing_stats["failed_requests"],
        "tts_average_processing_time": processing_stats["average_processing_time"]
    }

@app.get("/api/audio/{filename}")
async def get_audio_file(filename: str):
    """Получить сгенерированный аудио файл"""
    audio_path = Path("generated_audio") / filename
    if audio_path.exists():
        return FileResponse(audio_path)
    else:
        raise HTTPException(status_code=404, detail="Аудио файл не найден")

# ===== Voice Management Endpoints =====

@app.get("/api/voices/list")
async def list_voices():
    """Получить список всех голосов (базовых + пользовательских)"""
    try:
        voices = []
        
        # Базовые голоса (предустановленные)
        base_voices = [
            {"id": "female_1", "name": "Женский 1", "type": "base", "language": "ru"},
            {"id": "male_1", "name": "Мужской 1", "type": "base", "language": "ru"},
            {"id": "female_2", "name": "Женский 2", "type": "base", "language": "ru"},
            {"id": "male_2", "name": "Мужской 2", "type": "base", "language": "ru"}
        ]
        voices.extend(base_voices)
        
        # Пользовательские голоса
        voices_dir = config.voices_dir
        if voices_dir.exists():
            for voice_folder in voices_dir.iterdir():
                if voice_folder.is_dir():
                    metadata_file = voice_folder / "metadata.json"
                    if metadata_file.exists():
                        try:
                            with open(metadata_file, 'r', encoding='utf-8') as f:
                                metadata = json.load(f)
                                voices.append({
                                    "id": voice_folder.name,
                                    "name": metadata.get('name', voice_folder.name),
                                    "type": "custom",
                                    "language": metadata.get('language', 'ru'),
                                    "created_at": metadata.get('created_at'),
                                    "samples_count": len(list(voice_folder.glob('*.wav')))
                                })
                        except Exception as e:
                            logger.error(f"Error loading voice metadata {voice_folder.name}: {e}")
        
        return {"success": True, "voices": voices}
        
    except Exception as e:
        logger.error(f"Error listing voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/voices/create")
async def create_voice(
    name: str = Form(...),
    language: str = Form("ru"),
    description: str = Form("")
):
    """Создать новый пользовательский голос"""
    try:
        # Генерируем уникальный ID
        voice_id = f"custom_{hashlib.md5(name.encode()).hexdigest()[:8]}"
        voice_folder = config.voices_dir / voice_id
        
        # Проверяем, не существует ли уже
        if voice_folder.exists():
            raise HTTPException(status_code=400, detail="Голос с таким именем уже существует")
        
        # Создаем папку
        voice_folder.mkdir(parents=True, exist_ok=True)
        
        # Создаем метаданные
        metadata = {
            "id": voice_id,
            "name": name,
            "language": language,
            "description": description,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Сохраняем метаданные
        metadata_file = voice_folder / "metadata.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Created voice: {voice_id} ({name})")
        
        return {
            "success": True,
            "voice_id": voice_id,
            "message": "Голос создан. Теперь загрузите референсные аудио сэмплы."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def convert_audio_to_wav_48khz(input_path: str, output_path: str) -> bool:
    """
    Конвертировать аудио в WAV 48kHz Mono 16-bit для F5-TTS
    
    Args:
        input_path: Путь к входному файлу (любой формат)
        output_path: Путь к выходному WAV файлу
        
    Returns:
        bool: True если успешно, False если ошибка
    """
    try:
        import soundfile as sf
        import librosa
        import numpy as np
        
        logger.info(f"🔄 Converting audio: {input_path} -> {output_path}")
        
        # Загружаем аудио с ресемплингом до 48kHz и конвертацией в моно
        audio, sr = librosa.load(input_path, sr=48000, mono=True)
        
        # Нормализуем громкость
        audio = librosa.util.normalize(audio)
        
        # Убедимся что в int16 диапазоне
        audio = np.clip(audio, -1.0, 1.0)
        
        # Сохраняем как WAV 16-bit PCM
        sf.write(output_path, audio, 48000, subtype='PCM_16')
        
        logger.info(f"✅ Audio converted successfully to WAV 48kHz Mono 16-bit")
        return True
        
    except Exception as e:
        logger.error(f"❌ Audio conversion failed: {e}")
        return False

def transcribe_audio(audio_path: str) -> str:
    """
    Транскрибировать аудио используя Whisper
    
    Args:
        audio_path: Путь к аудио файлу
        
    Returns:
        str: Транскрибированный текст или пустая строка при ошибке
    """
    try:
        # Пробуем faster-whisper (быстрее)
        try:
            from faster_whisper import WhisperModel
            model = WhisperModel("base", device="auto", compute_type="auto")
            segments, info = model.transcribe(audio_path, language="ru")
            text = " ".join([segment.text for segment in segments])
            logger.info(f"✅ Transcribed with faster-whisper: '{text[:50]}...'")
            return text.strip()
        except ImportError:
            logger.warning("faster-whisper not available, trying whisper")
        
        # Fallback на обычный whisper
        try:
            import whisper
            model = whisper.load_model("base")
            result = model.transcribe(audio_path, language="ru")
            text = result.get("text", "").strip()
            logger.info(f"✅ Transcribed with whisper: '{text[:50]}...'")
            return text
        except ImportError:
            logger.warning("whisper not available, skipping transcription")
            return ""
            
    except Exception as e:
        logger.error(f"❌ Transcription failed: {e}")
        return ""

@app.post("/api/voices/{voice_id}/upload")
async def upload_voice_sample(
    voice_id: str,
    file: UploadFile = File(...),
    sample_text: str = Form(None)
):
    """Загрузить референсный аудио сэмпл для голоса с автоконвертацией в WAV"""
    temp_input_path = None
    temp_converted_path = None
    final_sample_path = None
    
    try:
        voice_folder = config.voices_dir / voice_id
        
        # Проверяем существование голоса
        if not voice_folder.exists():
            raise HTTPException(status_code=404, detail="Голос не найден")
        
        # Проверяем формат файла (принимаем все популярные форматы)
        allowed_extensions = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.aiff', '.au']
        file_ext = Path(file.filename).suffix.lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Неподдерживаемый формат. Разрешены: {', '.join(allowed_extensions)}"
            )
        
        # Сохраняем загруженный файл во временную директорию
        import tempfile
        temp_input_fd, temp_input_path = tempfile.mkstemp(suffix=file_ext)
        os.close(temp_input_fd)
        
        async with aiofiles.open(temp_input_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        logger.info(f"📥 Sample uploaded to temp: {temp_input_path}")
        
        # Конвертируем в WAV 48kHz Mono 16-bit
        timestamp = int(datetime.now().timestamp())
        temp_converted_path = tempfile.mktemp(suffix='.wav')
        
        success = convert_audio_to_wav_48khz(temp_input_path, temp_converted_path)
        if not success:
            raise HTTPException(status_code=500, detail="Ошибка конвертации аудио")
        
        # Автоматическая транскрибация (если не передан текст)
        if not sample_text:
            logger.info("🎤 Starting automatic transcription...")
            sample_text = transcribe_audio(temp_converted_path)
            if sample_text:
                logger.info(f"✅ Auto-transcribed: '{sample_text[:50]}...'")
            else:
                logger.warning("⚠️ Transcription failed, continuing without text")
        
        # Сохраняем конвертированный WAV файл
        sample_filename = f"sample_{timestamp}.wav"  # ВСЕГДА .wav
        final_sample_path = voice_folder / sample_filename
        
        import shutil
        shutil.copy2(temp_converted_path, final_sample_path)
        
        logger.info(f"✅ Sample saved: {final_sample_path}")
        
        # Сохраняем метаданные сэмпла
        sample_metadata = {
            "filename": sample_filename,
            "text": sample_text or "",
            "uploaded_at": datetime.now().isoformat(),
            "duration": None,  # TODO: получить длительность
            "format": "WAV 48kHz Mono 16-bit",
            "auto_transcribed": bool(sample_text and not sample_text)
        }
        
        samples_meta_file = voice_folder / "samples.json"
        samples_meta = []
        
        if samples_meta_file.exists():
            with open(samples_meta_file, 'r', encoding='utf-8') as f:
                samples_meta = json.load(f)
        
        samples_meta.append(sample_metadata)
        
        with open(samples_meta_file, 'w', encoding='utf-8') as f:
            json.dump(samples_meta, f, indent=2, ensure_ascii=False)
        
        # Обновляем метаданные голоса
        metadata_file = voice_folder / "metadata.json"
        if metadata_file.exists():
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            metadata['updated_at'] = datetime.now().isoformat()
            metadata['samples_count'] = len(list(voice_folder.glob('sample_*.wav')))
            
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Uploaded and converted sample for voice {voice_id}: {sample_filename}")
        
        return {
            "success": True,
            "filename": sample_filename,
            "message": "Сэмпл успешно загружен, конвертирован в WAV 48kHz" + (
                " и транскрибирован" if sample_text else ""
            ),
            "transcription": sample_text or None,
            "format": "WAV 48kHz Mono 16-bit"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading voice sample: {e}")
        
        # Удаляем файл при ошибке
        if final_sample_path and Path(final_sample_path).exists():
            try:
                os.remove(final_sample_path)
            except:
                pass
        
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Очистка временных файлов
        if temp_input_path and os.path.exists(temp_input_path):
            try:
                os.remove(temp_input_path)
            except:
                pass
        
        if temp_converted_path and os.path.exists(temp_converted_path):
            try:
                os.remove(temp_converted_path)
            except:
                pass

@app.get("/api/voices/{voice_id}/samples")
async def get_voice_samples(voice_id: str):
    """Получить список сэмплов для голоса"""
    try:
        voice_folder = config.voices_dir / voice_id
        
        if not voice_folder.exists():
            raise HTTPException(status_code=404, detail="Голос не найден")
        
        samples = []
        samples_meta_file = voice_folder / "samples.json"
        samples_meta = []
        
        if samples_meta_file.exists():
            with open(samples_meta_file, 'r', encoding='utf-8') as f:
                samples_meta = json.load(f)
        
        # Получаем все аудио файлы
        for sample_file in voice_folder.glob('sample_*.*'):
            # Ищем метаданные для этого файла
            meta = next((s for s in samples_meta if s['filename'] == sample_file.name), None)
            
            samples.append({
                "filename": sample_file.name,
                "path": f"/api/voices/{voice_id}/samples/{sample_file.name}",
                "text": meta.get('text') if meta else None,
                "uploaded_at": meta.get('uploaded_at') if meta else None,
                "size": sample_file.stat().st_size
            })
        
        return {"success": True, "samples": samples}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting voice samples: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/voices/{voice_id}/samples/{filename}")
async def get_voice_sample_file(voice_id: str, filename: str):
    """Получить файл сэмпла"""
    try:
        sample_path = config.voices_dir / voice_id / filename
        
        if not sample_path.exists():
            raise HTTPException(status_code=404, detail="Сэмпл не найден")
        
        return FileResponse(
            sample_path,
            media_type="audio/wav",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sample file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/voices/{voice_id}/samples/{filename}/retranscribe")
async def retranscribe_voice_sample(voice_id: str, filename: str):
    """Перетранскрибировать существующий сэмпл"""
    try:
        voice_folder = config.voices_dir / voice_id
        
        if not voice_folder.exists():
            raise HTTPException(status_code=404, detail="Голос не найден")
        
        sample_path = voice_folder / filename
        if not sample_path.exists():
            raise HTTPException(status_code=404, detail="Сэмпл не найден")
        
        logger.info(f"🔄 Retranscribing sample: {filename}")
        
        # Транскрибируем аудио
        transcribed_text = transcribe_audio(str(sample_path))
        
        if not transcribed_text:
            raise HTTPException(status_code=500, detail="Ошибка транскрибации")
        
        # Обновляем метаданные в samples.json
        samples_meta_file = voice_folder / "samples.json"
        samples_meta = []
        
        if samples_meta_file.exists():
            with open(samples_meta_file, 'r', encoding='utf-8') as f:
                samples_meta = json.load(f)
        
        # Находим и обновляем сэмпл
        updated = False
        for sample in samples_meta:
            if sample['filename'] == filename:
                sample['text'] = transcribed_text
                sample['retranscribed_at'] = datetime.now().isoformat()
                updated = True
                break
        
        if updated:
            with open(samples_meta_file, 'w', encoding='utf-8') as f:
                json.dump(samples_meta, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Sample retranscribed: '{transcribed_text[:50]}...'")
        
        return {
            "success": True,
            "transcription": transcribed_text,
            "message": "Сэмпл успешно перетранскрибирован"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retranscribing sample: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/voices/{voice_id}/samples/{filename}/update-text")
async def update_sample_text(voice_id: str, filename: str, text: str = Form(...)):
    """Обновить текст сэмпла вручную"""
    try:
        voice_folder = config.voices_dir / voice_id
        
        if not voice_folder.exists():
            raise HTTPException(status_code=404, detail="Голос не найден")
        
        sample_path = voice_folder / filename
        if not sample_path.exists():
            raise HTTPException(status_code=404, detail="Сэмпл не найден")
        
        # Обновляем метаданные
        samples_meta_file = voice_folder / "samples.json"
        samples_meta = []
        
        if samples_meta_file.exists():
            with open(samples_meta_file, 'r', encoding='utf-8') as f:
                samples_meta = json.load(f)
        
        # Находим и обновляем
        updated = False
        for sample in samples_meta:
            if sample['filename'] == filename:
                sample['text'] = text
                sample['updated_at'] = datetime.now().isoformat()
                updated = True
                break
        
        if updated:
            with open(samples_meta_file, 'w', encoding='utf-8') as f:
                json.dump(samples_meta, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Sample text updated: {filename}")
        
        return {
            "success": True,
            "message": "Текст сэмпла обновлён"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating sample text: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/voices/{voice_id}/samples/{filename}")
async def delete_voice_sample(voice_id: str, filename: str):
    """Удалить сэмпл"""
    try:
        sample_path = config.voices_dir / voice_id / filename
        
        if not sample_path.exists():
            raise HTTPException(status_code=404, detail="Сэмпл не найден")
        
        # Удаляем файл
        sample_path.unlink()
        
        # Обновляем метаданные
        samples_meta_file = config.voices_dir / voice_id / "samples.json"
        if samples_meta_file.exists():
            with open(samples_meta_file, 'r', encoding='utf-8') as f:
                samples_meta = json.load(f)
            
            samples_meta = [s for s in samples_meta if s['filename'] != filename]
            
            with open(samples_meta_file, 'w', encoding='utf-8') as f:
                json.dump(samples_meta, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Deleted sample {filename} from voice {voice_id}")
        
        return {"success": True, "message": "Сэмпл удалён"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting sample: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/voices/{voice_id}")
async def delete_voice(voice_id: str):
    """Удалить голос со всеми сэмплами"""
    try:
        voice_folder = config.voices_dir / voice_id
        
        if not voice_folder.exists():
            raise HTTPException(status_code=404, detail="Голос не найден")
        
        # Удаляем папку со всем содержимым
        import shutil
        shutil.rmtree(voice_folder)
        
        logger.info(f"Deleted voice: {voice_id}")
        
        return {"success": True, "message": "Голос удалён"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def main():
    """Главная функция"""
    print("🚀 TTS F5 Simple - Упрощенный микросервис")
    print("=" * 50)
    print(f"Версия: {config.get('version')}")
    print(f"Порт: {config.get('port')}")
    print(f"GPU: {config.get('gpu_info', {}).get('name', 'Unknown')}")
    print(f"VRAM: {config.get('gpu_info', {}).get('memory_total', 0) / 1024**3:.1f}GB")
    print("=" * 50)
    print("Запуск сервера...")
    
    # Запускаем сервер
    uvicorn.run(
        app,
        host=config.get('host', '127.0.0.1'),
        port=config.get('port', 8001),
        log_level="info"
    )

if __name__ == "__main__":
    main()
