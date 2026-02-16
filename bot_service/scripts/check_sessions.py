#!/usr/bin/env python3
"""
РЎРєСЂРёРїС‚ РґР»СЏ РїСЂРѕРІРµСЂРєРё Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёР№ Рё РїРѕРґРєР»СЋС‡РµРЅРёР№
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal, UserSession, User, UserToken
from core.connection_manager import get_connection_manager
from datetime import datetime
import json

def check_sessions():
    """РџСЂРѕРІРµСЂРёС‚СЊ Р°РєС‚РёРІРЅС‹Рµ СЃРµСЃСЃРёРё Рё РїРѕРґРєР»СЋС‡РµРЅРёСЏ"""
    print("[DEBUG] РџСЂРѕРІРµСЂРєР° Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёР№ Рё РїРѕРґРєР»СЋС‡РµРЅРёР№...")
    
    db = SessionLocal()
    try:
        # 1. РџСЂРѕРІРµСЂСЏРµРј Р°РєС‚РёРІРЅС‹Рµ СЃРµСЃСЃРёРё РІ Р‘Р”
        print("\n[STATS] РђРљРўРР’РќР«Р• РЎР•РЎРЎРР Р’ Р‘Р”:")
        active_sessions = db.query(UserSession).filter(
            UserSession.is_active == True
        ).all()
        
        if not active_sessions:
            print("[ERROR] РќРµС‚ Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёР№ РІ Р±Р°Р·Рµ РґР°РЅРЅС‹С…")
        else:
            for session in active_sessions:
                print(f"   User ID: {session.user_id}")
                print(f"  рџ†” Session ID: {session.session_id}")
                device_info = session.device_info or {}
                channel = device_info.get('monitored_channel', 'РќРµ СѓРєР°Р·Р°РЅ')
                print(f"   Channel: {channel}")
                print(f"   Device: {session.device_info}")
                print(f"  [TIMEOUT] Created: {session.created_at}")
                print("  " + "-" * 50)
        
        # 2. РџСЂРѕРІРµСЂСЏРµРј РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ СЃ С‚РѕРєРµРЅР°РјРё
        print("\n РџРћР›Р¬Р—РћР’РђРўР•Р›Р РЎ РўРћРљР•РќРђРњР:")
        users_with_tokens = db.query(User).join(UserToken).filter(
            UserToken.access_token.isnot(None)
        ).all()
        
        if not users_with_tokens:
            print("[ERROR] РќРµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ СЃ С‚РѕРєРµРЅР°РјРё")
        else:
            for user in users_with_tokens:
                username = user.twitch_username or user.vk_username or f"User_{user.id}"
                print(f"   User: {username} (ID: {user.id})")
                tokens = db.query(UserToken).filter(UserToken.user_id == user.id).all()
                for token in tokens:
                    print(f"    [LINK] {token.platform}: {token.platform_user_id}")
                print("  " + "-" * 30)
        
        # 3. РџСЂРѕРІРµСЂСЏРµРј connection manager
        print("\n[BOT] CONNECTION MANAGER:")
        connection_manager = get_connection_manager()
        active_channels = connection_manager.get_active_channels()
        active_sessions_dict = connection_manager.get_active_sessions()
        
        if not active_channels:
            print("[ERROR] РќРµС‚ Р°РєС‚РёРІРЅС‹С… РєР°РЅР°Р»РѕРІ РІ connection manager")
        else:
            print(f"[OK] РђРєС‚РёРІРЅС‹Рµ РєР°РЅР°Р»С‹: {active_channels}")
            for channel, sessions in active_sessions_dict.items():
                print(f"   {channel}: {len(sessions)} СЃРµСЃСЃРёР№")
        
        # 4. РџСЂРѕРІРµСЂСЏРµРј РіРѕСЃС‚РµРІС‹Рµ СЃРµСЃСЃРёРё
        print("\n Р“РћРЎРўР•Р’Р«Р• РЎР•РЎРЎРР:")
        guest_sessions = db.query(UserSession).filter(
            UserSession.user_id == -1,
            UserSession.is_active == True
        ).all()
        
        if not guest_sessions:
            print("[ERROR] РќРµС‚ Р°РєС‚РёРІРЅС‹С… РіРѕСЃС‚РµРІС‹С… СЃРµСЃСЃРёР№")
        else:
            for session in guest_sessions:
                print(f"  рџ†” Session: {session.session_id}")
                device_info = session.device_info or {}
                channel = device_info.get('monitored_channel', 'РќРµ СѓРєР°Р·Р°РЅ')
                print(f"   Channel: {channel}")
                print(f"   Device: {session.device_info}")
                print("  " + "-" * 30)
        
    except Exception as e:
        print(f"[ERROR] РћС€РёР±РєР° РїСЂРё РїСЂРѕРІРµСЂРєРµ СЃРµСЃСЃРёР№: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_sessions()
