import logging
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.core.config import config

logger = logging.getLogger('tts_simple.voices')

class VoicesService:
    @staticmethod
    def get_base_voices() -> List[Dict[str, Any]]:
        """Получить список базовых голосов"""
        return [
            {"id": "female_1", "name": "Женский 1", "type": "base", "language": "ru"},
            {"id": "male_1", "name": "Мужской 1", "type": "base", "language": "ru"},
            {"id": "female_2", "name": "Женский 2", "type": "base", "language": "ru"},
            {"id": "male_2", "name": "Мужской 2", "type": "base", "language": "ru"}
        ]

    @staticmethod
    def get_custom_voices() -> List[Dict[str, Any]]:
        """Получить список пользовательских голосов"""
        voices = []
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
                        except Exception:
                            logger.exception("Error loading voice metadata for %s", voice_folder.name)
        return voices

    @staticmethod
    def create_custom_voice(name: str, language: str = "ru", description: str = "") -> Dict[str, Any]:
        """Создать новый пользовательский голос"""
        # Генерируем уникальный ID
        voice_id = f"custom_{hashlib.md5(name.encode()).hexdigest()[:8]}"
        voice_folder = config.voices_dir / voice_id
        
        # Проверяем, не существует ли уже
        if voice_folder.exists():
            raise ValueError("Голос с таким именем уже существует")
        
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
            "voice_id": voice_id,
            "message": "Голос создан. Теперь загрузите референсные аудио сэмплы."
        }

    @staticmethod
    def get_voice_folder(voice_id: str) -> Optional[Path]:
        """Получить путь к папке голоса"""
        voice_folder = config.voices_dir / voice_id
        if voice_folder.exists():
            return voice_folder
        return None

