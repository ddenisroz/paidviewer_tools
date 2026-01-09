#!/usr/bin/env python3
"""
Проверка наличия admin пользователя в системе.
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path
BOT_SERVICE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BOT_SERVICE_ROOT))

# Load .env
env_path = BOT_SERVICE_ROOT / '.env'
load_dotenv(dotenv_path=env_path, override=True)

from core.database import SessionLocal, User


def check_admin():
    """Проверить наличие admin пользователя."""
    db = SessionLocal()
    try:
        # Ищем admin пользователя
        admin = db.query(User).filter(User.is_admin == True).first()
        
        if admin:
            print("✅ Admin пользователь найден:")
            print(f"   ID: {admin.id}")
            print(f"   Twitch: {admin.twitch_username or 'не настроен'}")
            print(f"   VK: {admin.vk_username or 'не настроен'}")
            print(f"   Admin: {admin.is_admin}")
            return True
        else:
            print("❌ Admin пользователь НЕ найден")
            print("\nДля доступа к OAuth авторизации бота нужны admin права.")
            print("\nВарианты:")
            print("1. Войдите через OAuth (Twitch или VK)")
            print("2. Сделайте вашего пользователя админом:")
            print("   UPDATE users SET is_admin = true WHERE id = YOUR_USER_ID;")
            return False
            
    finally:
        db.close()


if __name__ == "__main__":
    check_admin()
