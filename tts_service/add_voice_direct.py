#!/usr/bin/env python3
"""
Прямое добавление голоса в БД через SQL (обходим SQLAlchemy)
"""
import sqlite3
from pathlib import Path
from datetime import datetime

# Путь к базе данных
DB_PATH = Path(__file__).resolve().parent.parent / "bot_service" / "data" / "app_data.db"

def add_voice_direct(voice_name: str, file_path: str):
    """Добавить голос напрямую через SQL"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        # Проверяем существует ли голос
        cursor.execute("SELECT id FROM voices WHERE name = ?", (voice_name,))
        existing = cursor.fetchone()
        
        if existing:
            print(f"[WARN] Голос '{voice_name}' уже существует (ID: {existing[0]})")
            conn.close()
            return False
        
        # Вставляем новый голос (без is_global, так как колонки нет в БД)
        cursor.execute("""
            INSERT INTO voices (
                name, voice_type, file_path, reference_text, 
                owner_id, is_public, is_active, created_at,
                cfg_strength, speed_preset, cross_fade_duration,
                silence_duration_ms, sway_sampling_coef
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            voice_name,
            'global',  # voice_type
            file_path,
            None,  # reference_text
            None,  # owner_id
            True,  # is_public
            True,  # is_active
            datetime.now().isoformat(),
            2.5,  # cfg_strength
            'normal',  # speed_preset
            0.15,  # cross_fade_duration
            100,  # silence_duration_ms
            -1.0  # sway_sampling_coef
        ))
        
        conn.commit()
        voice_id = cursor.lastrowid
        
        print(f"[OK] Голос '{voice_name}' успешно добавлен")
        print(f"   ID: {voice_id}")
        print(f"   Путь: {file_path}")
        print("   Тип: global")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"[ERROR] Ошибка: {e}")
        return False

if __name__ == "__main__":
    voice_name = "guldan_nohd"
    file_path = "audio/voices/global/guldan_nohd.wav"
    
    print(f"[MIC] Добавление голоса '{voice_name}' в базу данных...")
    print(f"[FILE] База данных: {DB_PATH}")
    
    if not DB_PATH.exists():
        print(f"[ERROR] База данных не найдена: {DB_PATH}")
        exit(1)
    
    success = add_voice_direct(voice_name, file_path)
    
    if success:
        print("\n[OK] Готово! Голос добавлен и доступен для использования.")
        print("[INFO] Перезапустите TTS сервис чтобы изменения вступили в силу.")
    else:
        print("\n[ERROR] Не удалось добавить голос.")
        exit(1)

