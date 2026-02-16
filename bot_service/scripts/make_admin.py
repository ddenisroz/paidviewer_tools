#!/usr/bin/env python3
"""
РЎРґРµР»Р°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРј.

Usage:
    python scripts/make_admin.py <user_id>
    python scripts/make_admin.py --username <twitch_username>
"""

import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path
BOT_SERVICE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BOT_SERVICE_ROOT))

# Load .env
env_path = BOT_SERVICE_ROOT / '.env'
load_dotenv(dotenv_path=env_path, override=True)

from core.database import SessionLocal, User  # noqa: E402


def make_admin(user_id=None, username=None):
    """РЎРґРµР»Р°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРј."""
    db = SessionLocal()
    try:
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        elif username:
            user = db.query(User).filter(
                (User.twitch_username == username.lower()) | 
                (User.vk_username == username.lower())
            ).first()
        else:
            print("[ERROR] РЈРєР°Р¶РёС‚Рµ user_id РёР»Рё username")
            return False
        
        if not user:
            print("[ERROR] РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ")
            return False
        
        if user.role == 'admin' or user.is_admin:
            print(" РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓР¶Рµ СЏРІР»СЏРµС‚СЃСЏ Р°РґРјРёРЅРѕРј:")
            print(f"   ID: {user.id}")
            print(f"   Twitch: {user.twitch_username or 'РЅРµ РЅР°СЃС‚СЂРѕРµРЅ'}")
            print(f"   VK: {user.vk_username or 'РЅРµ РЅР°СЃС‚СЂРѕРµРЅ'}")
            return True
        
        # Р”РµР»Р°РµРј Р°РґРјРёРЅРѕРј
        user.role = 'admin'
        user.is_admin = True
        db.commit()
        
        print(" РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ С‚РµРїРµСЂСЊ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ:")
        print(f"   ID: {user.id}")
        print(f"   Twitch: {user.twitch_username or 'РЅРµ РЅР°СЃС‚СЂРѕРµРЅ'}")
        print(f"   VK: {user.vk_username or 'РЅРµ РЅР°СЃС‚СЂРѕРµРЅ'}")
        print(f"   Role: {user.role}")
        print(f"   Admin: {user.role == 'admin' or user.is_admin}")
        print("\nРўРµРїРµСЂСЊ РІС‹ РјРѕР¶РµС‚Рµ:")
        print("1. РџРµСЂРµР№С‚Рё РЅР° http://localhost:8000/auth/twitch/bot/login")
        print("2. РђРІС‚РѕСЂРёР·РѕРІР°С‚СЊ Р±РѕС‚Р° С‡РµСЂРµР· OAuth2")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] РћС€РёР±РєР°: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def list_users():
    """РџРѕРєР°Р·Р°С‚СЊ РІСЃРµС… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№."""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        
        if not users:
            print("[ERROR] РџРѕР»СЊР·РѕРІР°С‚РµР»Рё РЅРµ РЅР°Р№РґРµРЅС‹")
            print("\nРЎРЅР°С‡Р°Р»Р° Р°РІС‚РѕСЂРёР·СѓР№С‚РµСЃСЊ С‡РµСЂРµР·:")
            print("- http://localhost:8000/auth/twitch/login")
            print("- http://localhost:8000/auth/vk/login")
            return
        
        print(f"РќР°Р№РґРµРЅРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№: {len(users)}\n")
        
        for user in users:
            print(f"ID: {user.id}")
            print(f"  Twitch: {user.twitch_username or 'РЅРµ РЅР°СЃС‚СЂРѕРµРЅ'}")
            print(f"  VK: {user.vk_username or 'РЅРµ РЅР°СЃС‚СЂРѕРµРЅ'}")
            print(f"  Admin: {' Р”Р°' if (user.role == 'admin' or user.is_admin) else '[ERROR] РќРµС‚'}")
            print()
        
        print("Р§С‚РѕР±С‹ СЃРґРµР»Р°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Р°РґРјРёРЅРѕРј:")
        print(f"  python scripts/make_admin.py {users[0].id}")
        print(f"  python scripts/make_admin.py --username {users[0].twitch_username or users[0].vk_username}")
        
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) == 1 or sys.argv[1] in ['--list', '-l']:
        list_users()
    elif len(sys.argv) == 2:
        try:
            user_id = int(sys.argv[1])
            make_admin(user_id=user_id)
        except ValueError:
            print("[ERROR] РќРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚ user_id")
            print("Usage: python scripts/make_admin.py <user_id>")
    elif len(sys.argv) == 3 and sys.argv[1] in ['--username', '-u']:
        make_admin(username=sys.argv[2])
    else:
        print("Usage:")
        print("  python scripts/make_admin.py                    # РџРѕРєР°Р·Р°С‚СЊ РІСЃРµС… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№")
        print("  python scripts/make_admin.py <user_id>          # РЎРґРµР»Р°С‚СЊ Р°РґРјРёРЅРѕРј РїРѕ ID")
        print("  python scripts/make_admin.py --username <name>  # РЎРґРµР»Р°С‚СЊ Р°РґРјРёРЅРѕРј РїРѕ username")
