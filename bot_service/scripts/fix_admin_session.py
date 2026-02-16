"""
РћР±РЅРѕРІРёС‚СЊ РІСЃРµ Р°РєС‚РёРІРЅС‹Рµ СЃРµСЃСЃРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ, СЃРґРµР»Р°РІ РµРіРѕ Р°РґРјРёРЅРѕРј.

РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ:
    python scripts/fix_admin_session.py
"""

import sys
import os

# Р”РѕР±Р°РІР»СЏРµРј РєРѕСЂРЅРµРІСѓСЋ РґРёСЂРµРєС‚РѕСЂРёСЋ РІ РїСѓС‚СЊ
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Р—Р°РіСЂСѓР¶Р°РµРј РїРµСЂРµРјРµРЅРЅС‹Рµ РѕРєСЂСѓР¶РµРЅРёСЏ
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text  # noqa: E402
from core.database import db_session  # noqa: E402


def fix_admin_session():
    """РћР±РЅРѕРІРёС‚СЊ СЃРµСЃСЃРёРё Р°РґРјРёРЅР°"""
    
    print("\n" + "="*60)
    print("РћР‘РќРћР’Р›Р•РќРР• РЎР•РЎРЎРР™ РђР”РњРРќРђ")
    print("="*60 + "\n")
    
    with db_session() as db:
        # РќР°С…РѕРґРёРј РІСЃРµС… Р°РґРјРёРЅРѕРІ
        result = db.execute(text("""
            SELECT id, twitch_username, vk_username, role
            FROM users 
            WHERE is_admin = true
        """))
        
        admins = result.fetchall()
        
        if not admins:
            print("[ERROR] РђРґРјРёРЅС‹ РЅРµ РЅР°Р№РґРµРЅС‹ РІ Р‘Р”")
            print("\nРЎРЅР°С‡Р°Р»Р° СЃРґРµР»Р°Р№С‚Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Р°РґРјРёРЅРѕРј:")
            print("  python scripts/make_admin.py")
            return
        
        print(f" РќР°Р№РґРµРЅРѕ Р°РґРјРёРЅРѕРІ: {len(admins)}\n")
        
        for user_id, twitch_username, vk_username, role in admins:
            print(f" User ID: {user_id}")
            print(f"   Twitch: {twitch_username or 'N/A'}")
            print(f"   VK: {vk_username or 'N/A'}")
            print(f"   Role: {role}")
            
            # 1. РћР±РЅРѕРІР»СЏРµРј role РІ С‚Р°Р±Р»РёС†Рµ users
            if role != 'admin':
                db.execute(text("""
                    UPDATE users 
                    SET role = 'admin' 
                    WHERE id = :user_id
                """), {"user_id": user_id})
                print(f"    Role РѕР±РЅРѕРІР»РµРЅ: {role} в†’ admin")
            else:
                print("    Role СѓР¶Рµ admin")
            
            # 2. РЈРґР°Р»СЏРµРј РІСЃРµ СЃС‚Р°СЂС‹Рµ СЃРµСЃСЃРёРё (С‡С‚РѕР±С‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РїРµСЂРµР»РѕРіРёРЅРёР»СЃСЏ)
            result = db.execute(text("""
                DELETE FROM user_sessions 
                WHERE user_id = :user_id
                RETURNING session_id
            """), {"user_id": user_id})
            
            deleted_sessions = result.fetchall()
            
            if deleted_sessions:
                print(f"    РЈРґР°Р»РµРЅРѕ СЃС‚Р°СЂС‹С… СЃРµСЃСЃРёР№: {len(deleted_sessions)}")
                print("   [INFO]пёЏ  РўРµРїРµСЂСЊ РІРѕР№РґРёС‚Рµ Р·Р°РЅРѕРІРѕ РІ frontend")
            else:
                print("   [INFO]пёЏ  РЎРµСЃСЃРёР№ РЅРµ Р±С‹Р»Рѕ, РїСЂРѕСЃС‚Рѕ РІРѕР№РґРёС‚Рµ РІ СЃРёСЃС‚РµРјСѓ")
            
            print()
        
        db.commit()
        
        print("="*60)
        print(" Р“РћРўРћР’Рћ!")
        print("="*60)
        print("\nРўРµРїРµСЂСЊ:")
        print("1. РћР±РЅРѕРІРёС‚Рµ СЃС‚СЂР°РЅРёС†Сѓ РІ Р±СЂР°СѓР·РµСЂРµ (F5)")
        print("2. РђРґРјРёРЅ РїР°РЅРµР»СЊ РґРѕР»Р¶РЅР° СЃС‚Р°С‚СЊ РґРѕСЃС‚СѓРїРЅР°")
        print("\nР•СЃР»Рё РЅРµ РїРѕРјРѕРіР»Рѕ - РїРµСЂРµР»РѕРіРёРЅСЊС‚РµСЃСЊ:")
        print("1. РЈРґР°Р»РёС‚Рµ cookie 'session_id' РІ DevTools")
        print("2. Р’РѕР№РґРёС‚Рµ Р·Р°РЅРѕРІРѕ\n")


if __name__ == "__main__":
    fix_admin_session()
