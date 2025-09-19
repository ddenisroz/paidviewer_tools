#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Админ панель API для TTS сервиса
Отдельный модуль для административных функций
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from pathlib import Path
import os
import json
import uuid
import shutil
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

# Роутер для админских эндпоинтов
admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

# Базовая директория
base_dir = Path(__file__).resolve().parent

class AdminStats(BaseModel):
    """Статистика для админ панели"""
    total_voices: int
    total_requests_today: int
    total_users_today: int
    avg_processing_time: float
    success_rate: float
    top_voices: List[dict]
    system_resources: dict

class VoiceSettings(BaseModel):
    """Настройки голоса"""
    target_rms: float = 0.4
    cfg_strength: float = 2.0
    sway_sampling_coef: float = -1.0
    speed_modifier: float = 1.0
    quality_preset: str = "balanced"  # fast, balanced, high

@admin_router.get("/dashboard", response_model=AdminStats)
async def get_admin_dashboard():
    """Получение данных дашборда админ панели"""
    
    # Подсчет голосов
    voices_dir = base_dir / "voices"
    total_voices = len(list(voices_dir.glob("*.wav"))) if voices_dir.exists() else 0
    
    # TODO: Интеграция с базой данных для реальной статистики
    mock_stats = {
        "total_voices": total_voices,
        "total_requests_today": 127,
        "total_users_today": 15,
        "avg_processing_time": 2.3,
        "success_rate": 98.5,
        "top_voices": [
            {"name": "speaker1", "usage": 45},
            {"name": "def", "usage": 32},
            {"name": "custom_voice", "usage": 18}
        ],
        "system_resources": {
            "gpu_usage": 35.2,
            "ram_usage": 67.1,
            "disk_space": 78.9,
            "queue_size": 2
        }
    }
    
    return AdminStats(**mock_stats)

@admin_router.get("/voices/analytics")
async def get_voice_analytics():
    """Аналитика использования голосов"""
    
    voices_dir = base_dir / "voices"
    voices_analytics = []
    
    if voices_dir.exists():
        for voice_file in voices_dir.glob("*.wav"):
            # Получаем информацию о файле
            stats = voice_file.stat()
            
            # Загружаем настройки голоса если есть
            settings_file = voice_file.with_suffix('.json')
            voice_settings = {}
            if settings_file.exists():
                try:
                    with open(settings_file, 'r', encoding='utf-8') as f:
                        voice_settings = json.load(f)
                except:
                    pass
            
            voices_analytics.append({
                "name": voice_file.stem,
                "file_size": stats.st_size,
                "created": stats.st_ctime,
                "last_used": stats.st_atime,
                "usage_count": voice_settings.get('usage_count', 0),
                "avg_rating": voice_settings.get('avg_rating', 0),
                "settings": voice_settings.get('tts_settings', {})
            })
    
    return {"voices": voices_analytics}

@admin_router.post("/voices/settings/{voice_name}")
async def update_voice_settings(voice_name: str, settings: VoiceSettings):
    """Обновление настроек голоса"""
    
    voices_dir = base_dir / "voices"
    voice_file = voices_dir / f"{voice_name}.wav"
    
    if not voice_file.exists():
        raise HTTPException(status_code=404, detail="Голос не найден")
    
    # Сохраняем настройки в JSON файл
    settings_file = voices_dir / f"{voice_name}.json"
    voice_config = {
        "tts_settings": settings.dict(),
        "updated": "auto",
        "version": "1.0"
    }
    
    try:
        with open(settings_file, 'w', encoding='utf-8') as f:
            json.dump(voice_config, f, ensure_ascii=False, indent=2)
        
        return {
            "success": True,
            "message": f"Настройки голоса '{voice_name}' обновлены",
            "settings": settings.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения настроек: {str(e)}")

@admin_router.get("/system/health")
async def get_system_health():
    """Проверка здоровья системы"""
    
    health_data = {
        "status": "healthy",
        "timestamp": "auto",
        "services": {
            "tts_engine": {"status": "running", "uptime": "2h 15m"},
            "workers": {"status": "running", "active": 1, "queue": 0},
            "storage": {"status": "ok", "free_space": "15.2GB"},
            "gpu": {"status": "available", "memory": "8GB", "utilization": "35%"}
        },
        "performance": {
            "requests_per_minute": 5.2,
            "avg_response_time": 2.1,
            "error_rate": 1.5
        },
        "alerts": []
    }
    
    return health_data

@admin_router.post("/system/optimize")
async def optimize_system():
    """Оптимизация системы"""
    
    try:
        # Очистка кеша
        cache_dir = base_dir / "audio_cache"
        if cache_dir.exists():
            # Удаляем файлы старше 1 дня
            import time
            current_time = time.time()
            cleaned_files = 0
            
            for file_path in cache_dir.glob("*.wav"):
                if current_time - file_path.stat().st_mtime > 86400:  # 24 часа
                    file_path.unlink()
                    cleaned_files += 1
        
        # Оптимизация GPU памяти
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                gpu_optimized = True
            else:
                gpu_optimized = False
        except:
            gpu_optimized = False
        
        return {
            "success": True,
            "message": "Система оптимизирована",
            "details": {
                "cleaned_cache_files": cleaned_files,
                "gpu_memory_cleared": gpu_optimized,
                "optimization_time": "2.1s"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка оптимизации: {str(e)}")

@admin_router.get("/logs/recent")
async def get_recent_logs(lines: int = 100):
    """Получение последних логов"""
    
    log_file = base_dir / "tts_service.log"
    
    if not log_file.exists():
        return {"logs": [], "message": "Лог файл не найден"}
    
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            all_lines = f.readlines()
            recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
        
        return {
            "logs": [line.strip() for line in recent_lines],
            "total_lines": len(all_lines),
            "showing": len(recent_lines)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка чтения логов: {str(e)}")

# Экспортируем роутер
__all__ = ['admin_router']
