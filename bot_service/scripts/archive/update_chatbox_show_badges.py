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
            ChatBoxSettings.show_badges == False
        ).update({"show_badges": True})
        
        db.commit()
        print(f"✅ Updated show_badges to True for {updated_count} ChatBoxSettings records")
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()

