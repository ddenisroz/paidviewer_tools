#!/usr/bin/env python3
"""
Обновляет show_badges в существующих ChatBoxSettings на True
"""
import sys
import os

# Добавляем путь к bot_service
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal, ChatBoxSettings

def main():
    db = SessionLocal()
    try:
        # Обновляем все записи где show_badges = False на True
        updated_count = db.query(ChatBoxSettings).filter(
            not ChatBoxSettings.show_badges
        ).update({"show_badges": True})

        db.commit()
        print(f"[OK] Updated show_badges to True for {updated_count} ChatBoxSettings records")
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()

