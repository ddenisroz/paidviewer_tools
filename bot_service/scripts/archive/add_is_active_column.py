"""Добавление колонки is_active в таблицу user_tokens"""
from core.database import SessionLocal, engine
from sqlalchemy import text

def add_is_active_column():
    db = SessionLocal()
    try:
        # Проверяем есть ли колонка
        result = db.execute(text("PRAGMA table_info(user_tokens)"))
        columns = [row[1] for row in result]
        
        if 'is_active' in columns:
            print("[OK] Column 'is_active' already exists in user_tokens")
        else:
            # Добавляем колонку is_active со значением по умолчанию TRUE
            db.execute(text("ALTER TABLE user_tokens ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            db.commit()
            print("[OK] Column 'is_active' added to user_tokens table")
            
            # Обновляем все существующие записи
            db.execute(text("UPDATE user_tokens SET is_active = 1 WHERE is_active IS NULL"))
            db.commit()
            print("[OK] Set is_active=1 for all existing tokens")
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_is_active_column()

