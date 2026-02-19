#!/usr/bin/env python3
"""
Скрипт для проверки активных сессий и подключений
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal, UserSession, User, UserToken
from core.connection_manager import get_connection_manager
from datetime import datetime
import json

def check_sessions():
    """Проверить активные сессии и подключения"""
    print("[DEBUG] Проверка активных сессий и подключений...")
    
    db = SessionLocal()
    try:
        # 1. Проверяем активные сессии в БД
        print("\n[STATS] РђРљРўРР’РќР«Р• РЎР•РЎРЎРР Р’ Р‘Р”:")
        active_sessions = db.query(UserSession).filter(
            UserSession.is_active == True
        ).all()
        
        if not active_sessions:
            print("[ERROR] Нет активных сессий в базе данных")
        else:
            for session in active_sessions:
                print(f"   User ID: {session.user_id}")
                print(f"  рџ†” Session ID: {session.session_id}")
                device_info = session.device_info or {}
                channel = device_info.get('monitored_channel', 'Не указан')
                print(f"   Channel: {channel}")
                print(f"   Device: {session.device_info}")
                print(f"  [TIMEOUT] Created: {session.created_at}")
                print("  " + "-" * 50)
        
        # 2. Проверяем пользователей с токенами
        print("\n РџРћР›Р¬Р—РћР’РђРўР•Р›Р РЎ РўРћРљР•РќРђРњР:")
        users_with_tokens = db.query(User).join(UserToken).filter(
            UserToken.access_token.isnot(None)
        ).all()
        
        if not users_with_tokens:
            print("[ERROR] Нет пользователей с токенами")
        else:
            for user in users_with_tokens:
                username = user.twitch_username or user.vk_username or f"User_{user.id}"
                print(f"   User: {username} (ID: {user.id})")
                tokens = db.query(UserToken).filter(UserToken.user_id == user.id).all()
                for token in tokens:
                    print(f"    [LINK] {token.platform}: {token.platform_user_id}")
                print("  " + "-" * 30)
        
        # 3. Проверяем connection manager
        print("\n[BOT] CONNECTION MANAGER:")
        connection_manager = get_connection_manager()
        active_channels = connection_manager.get_active_channels()
        active_sessions_dict = connection_manager.get_active_sessions()
        
        if not active_channels:
            print("[ERROR] Нет активных каналов в connection manager")
        else:
            print(f"[OK] Активные каналы: {active_channels}")
            for channel, sessions in active_sessions_dict.items():
                print(f"   {channel}: {len(sessions)} сессий")
        
        # 4. Проверяем гостевые сессии
        print("\n Р“РћРЎРўР•Р’Р«Р• РЎР•РЎРЎРР:")
        guest_sessions = db.query(UserSession).filter(
            UserSession.user_id == -1,
            UserSession.is_active == True
        ).all()
        
        if not guest_sessions:
            print("[ERROR] Нет активных гостевых сессий")
        else:
            for session in guest_sessions:
                print(f"  рџ†” Session: {session.session_id}")
                device_info = session.device_info or {}
                channel = device_info.get('monitored_channel', 'Не указан')
                print(f"   Channel: {channel}")
                print(f"   Device: {session.device_info}")
                print("  " + "-" * 30)
        
    except Exception as e:
        print(f"[ERROR] Ошибка при проверке сессий: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_sessions()
