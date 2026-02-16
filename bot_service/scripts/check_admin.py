#!/usr/bin/env python3
"""
РџСЂРѕРІРµСЂРєР° РЅР°Р»РёС‡РёСЏ admin РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ СЃРёСЃС‚РµРјРµ.
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
    """РџСЂРѕРІРµСЂРёС‚СЊ РЅР°Р»РёС‡РёРµ admin РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ."""
    db = SessionLocal()
    try:
        # РС‰РµРј admin РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        admin = db.query(User).filter(User.is_admin == True).first()
        
        if admin:
            print(" Admin РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅР°Р№РґРµРЅ:")
            print(f"   ID: {admin.id}")
            print(f"   Twitch: {admin.twitch_username or 'РЅРµ РЅР°СЃС‚СЂРѕРµРЅ'}")
            print(f"   VK: {admin.vk_username or 'РЅРµ РЅР°СЃС‚СЂРѕРµРЅ'}")
            print(f"   Admin: {admin.is_admin}")
            return True
        else:
            print("[ERROR] Admin РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РќР• РЅР°Р№РґРµРЅ")
            print("\nР”Р»СЏ РґРѕСЃС‚СѓРїР° Рє OAuth Р°РІС‚РѕСЂРёР·Р°С†РёРё Р±РѕС‚Р° РЅСѓР¶РЅС‹ admin РїСЂР°РІР°.")
            print("\nР’Р°СЂРёР°РЅС‚С‹:")
            print("1. Р’РѕР№РґРёС‚Рµ С‡РµСЂРµР· OAuth (Twitch РёР»Рё VK)")
            print("2. РЎРґРµР»Р°Р№С‚Рµ РІР°С€РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Р°РґРјРёРЅРѕРј:")
            print("   UPDATE users SET is_admin = true WHERE id = YOUR_USER_ID;")
            return False
            
    finally:
        db.close()


if __name__ == "__main__":
    check_admin()
