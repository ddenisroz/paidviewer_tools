#!/usr/bin/env python3
"""
Скрипт для добавления существующего голоса из файловой системы в базу данных
"""
import sys
from pathlib import Path
from sqlalchemy.orm import Session

# Добавляем путь к tts_service
sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal, Voice as VoiceModel
from config import config

def add_voice_from_file(voice_file_path: str, voice_name: str = None):
    """
    Добавить голос из файла в базу данных
    
    Args:
        voice_file_path: Путь к файлу голоса относительно tts_service
        voice_name: Имя голоса (если не указано, берется из имени файла)
    """
    db = SessionLocal()
    try:
        # Проверяем что файл существует
        full_path = Path(voice_file_path)
        if not full_path.exists():
            print(f"[ERROR] Файл не найден: {full_path}")
            return False
        
        # Определяем имя голоса
        if not voice_name:
            voice_name = full_path.stem  # Имя файла без расширения
        
        # Проверяем, не существует ли уже голос с таким именем
        existing_voice = db.query(VoiceModel).filter(VoiceModel.name == voice_name).first()
        if existing_voice:
            print(f"[WARN] Голос '{voice_name}' уже существует в базе данных (ID: {existing_voice.id})")
            return False
        
        # Создаем новую запись
        new_voice = VoiceModel(
            name=voice_name,
            voice_type='global',  # Глобальный голос, доступный всем
            file_path=str(full_path),
            reference_text=None,  # Будет заполнено при транскрибации
            is_active=True,
            is_public=True,  # Публичный голос, доступный всем
            owner_id=None,  # Глобальные голоса не имеют владельца
            cfg_strength=config.cfg_strength,  # Используем значение из конфига
            speed_preset='normal'
        )
        
        db.add(new_voice)
        db.commit()
        db.refresh(new_voice)
        
        print(f"[OK] Голос '{voice_name}' успешно добавлен в базу данных")
        print(f"   ID: {new_voice.id}")
        print(f"   Путь: {new_voice.file_path}")
        print(f"   Тип: {new_voice.voice_type}")
        print(f"   Активен: {new_voice.is_active}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Ошибка при добавлении голоса: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    # Добавляем голос guldan_nohd.wav
    voice_path = "audio/voices/global/guldan_nohd.wav"
    voice_name = "guldan_nohd"
    
    print(f"[MIC] Добавление голоса '{voice_name}' в базу данных...")
    success = add_voice_from_file(voice_path, voice_name)
    
    if success:
        print("\n[OK] Готово! Голос добавлен и доступен для использования.")
    else:
        print("\n[ERROR] Не удалось добавить голос.")
        sys.exit(1)
