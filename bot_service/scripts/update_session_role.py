#!/usr/bin/env python3
"""
РћР±РЅРѕРІРёС‚СЊ СЂРѕР»СЊ РІ Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёСЏС… РїРѕСЃР»Рµ РёР·РјРµРЅРµРЅРёСЏ is_admin.
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

from core.database import SessionLocal, User, UserSession  # noqa: E402
from core.session_manager import session_manager  # noqa: E402


def update_sessions():
    """РћР±РЅРѕРІРёС‚СЊ СЂРѕР»Рё РІ Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёСЏС…."""
    db = SessionLocal()
    try:
        # РќР°С…РѕРґРёРј РІСЃРµС… Р°РґРјРёРЅРѕРІ
        admins = db.query(User).filter(User.is_admin).all()
        
        if not admins:
            print("[ERROR] РђРґРјРёРЅС‹ РЅРµ РЅР°Р№РґРµРЅС‹")
            return
        
        print(f"РќР°Р№РґРµРЅРѕ Р°РґРјРёРЅРѕРІ: {len(admins)}\n")
        
        updated_count = 0
        
        for admin in admins:
            print(f"РћР±РЅРѕРІР»РµРЅРёРµ СЃРµСЃСЃРёР№ РґР»СЏ: {admin.twitch_username or admin.vk_username} (ID: {admin.id})")
            
            # РќР°С…РѕРґРёРј Р°РєС‚РёРІРЅС‹Рµ СЃРµСЃСЃРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
            sessions = db.query(UserSession).filter(
                UserSession.user_id == admin.id,
                UserSession.is_active
            ).all()
            
            if not sessions:
                print("  вљ пёЏ  РђРєС‚РёРІРЅС‹С… СЃРµСЃСЃРёР№ РЅРµ РЅР°Р№РґРµРЅРѕ")
                continue
            
            print(f"  РќР°Р№РґРµРЅРѕ Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёР№: {len(sessions)}")
            
            for session in sessions:
                # РћР±РЅРѕРІР»СЏРµРј СЂРѕР»СЊ РІ session_manager
                session_data = session_manager.get_session(session.session_id)
                
                if session_data:
                    session_data['is_admin'] = True
                    session_data['role'] = 'admin'
                    session_manager.update_session(session.session_id, session_data)
                    print(f"   РЎРµСЃСЃРёСЏ {session.session_id[:8]}... РѕР±РЅРѕРІР»РµРЅР°")
                    updated_count += 1
                else:
                    print(f"  вљ пёЏ  РЎРµСЃСЃРёСЏ {session.session_id[:8]}... РЅРµ РЅР°Р№РґРµРЅР° РІ РїР°РјСЏС‚Рё")
            
            print()
        
        print(f"\n РћР±РЅРѕРІР»РµРЅРѕ СЃРµСЃСЃРёР№: {updated_count}")
        print("\nРўРµРїРµСЂСЊ:")
        print("1. РћР±РЅРѕРІРёС‚Рµ СЃС‚СЂР°РЅРёС†Сѓ РІ Р±СЂР°СѓР·РµСЂРµ (F5)")
        print("2. РџРµСЂРµР№РґРёС‚Рµ РЅР° http://localhost:8000/auth/twitch/bot/login")
        
    finally:
        db.close()


if __name__ == "__main__":
    update_sessions()
