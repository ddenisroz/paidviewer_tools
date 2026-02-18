"""
Миграция: Добавление колонки is_global в таблицу voices
"""
import sqlite3
from pathlib import Path

# Путь к базе данных
DATABASE_PATH = Path(__file__).resolve().parent.parent / "bot_service" / "data" / "app_data.db"

def migrate():
    """Добавляет колонку is_global если её нет"""
    print(f"[DB] Database: {DATABASE_PATH}")
    
    if not DATABASE_PATH.exists():
        print("[ERROR] Database not found!")
        return
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        # Проверяем существует ли колонка
        cursor.execute("PRAGMA table_info(voices)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'is_global' in columns:
            print("[OK] Column 'is_global' already exists")
        else:
            print("➕ Adding column 'is_global'...")
            cursor.execute("ALTER TABLE voices ADD COLUMN is_global BOOLEAN DEFAULT 0")
            conn.commit()
            print("[OK] Column 'is_global' added successfully")
            
            # Обновляем существующие записи
            print("[REFRESH] Updating existing voices...")
            # Все голоса без owner_id считаем глобальными
            cursor.execute("UPDATE voices SET is_global = 1 WHERE owner_id IS NULL")
            # Все голоса с owner_id считаем пользовательскими
            cursor.execute("UPDATE voices SET is_global = 0 WHERE owner_id IS NOT NULL")
            conn.commit()
            print("[OK] Existing voices updated")
        
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        conn.rollback()
    finally:
        conn.close()
    
    print("[OK] Migration completed!")

if __name__ == "__main__":
    migrate()

