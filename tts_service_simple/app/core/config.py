import os
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
import GPUtil

logger = logging.getLogger('tts_simple.config')

class TTSConfig:
    """Автоматическая конфигурация TTS"""
    
    def __init__(self):
        self.base_dir = Path.cwd()
        self.config_file = self.base_dir / 'config.json'
        self.models_dir = self.base_dir / 'models'
        self.logs_dir = self.base_dir / 'logs'
        self.voices_dir = self.base_dir / 'user_voices'  # Директория для пользовательских голосов
        self.samples_dir = self.base_dir / 'reference_audio'  # Директория для референсных сэмплов
        self.generated_audio_dir = self.base_dir / 'generated_audio'

        # Создаем необходимые директории
        self.models_dir.mkdir(exist_ok=True)
        self.logs_dir.mkdir(exist_ok=True)
        self.voices_dir.mkdir(exist_ok=True)
        self.samples_dir.mkdir(exist_ok=True)
        self.generated_audio_dir.mkdir(exist_ok=True)
        
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
            logger.info(f"[STATS] Ограничение VRAM: {max_vram_gb} GB (используется: {vram_gb:.1f} GB)")
        
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
                logger.warning("[WARN] Мало VRAM для режима quality! Рекомендуется минимум 6GB")
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
                logger.warning("[WARN] Мало VRAM! Рекомендуется минимум 6GB")
        
        # Находим свободный порт
        port = self._find_free_port()
        
        config = {
            "version": "1.0.0",
            "port": port,
            "host": "0.0.0.0", # Changed to 0.0.0.0 for Docker
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
        # В Docker контейнере порт фиксирован обычно, но оставим логику
        if os.getenv('DOCKER_CONTAINER'):
             return int(os.getenv('PORT', 8000))

        for port in range(start_port, start_port + 10):
            try:
                import socket
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(('0.0.0.0', port))
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
