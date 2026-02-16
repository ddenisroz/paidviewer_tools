#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
РЎРєСЂРёРїС‚ РґР»СЏ РґРѕР±Р°РІР»РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ whitelist
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import User, WhitelistedChannel, get_db
from utils.whitelist_cache import invalidate_whitelist_cache

def add_user_to_whitelist(user_id: int, platform: str = 'twitch'):
    """Р”РѕР±Р°РІР»СЏРµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ whitelist"""
    db = next(get_db())
    try:
        # РџРѕР»СѓС‡Р°РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            print(f"[ERROR] User with ID {user_id} not found")
            return False
        
        platform = platform.lower()
        if platform not in ('twitch', 'vk'):
            print(f"[ERROR] Invalid platform: {platform}. Must be 'twitch' or 'vk'")
            return False
        
        # РћРїСЂРµРґРµР»СЏРµРј РєР°РєРѕРµ РёРјСЏ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ
        if platform == 'twitch':
            channel_name = user.twitch_username
        else:
            channel_name = user.vk_username
        
        if not channel_name:
            print(f"[ERROR] User {user_id} has no {platform} username")
            return False
        
        channel_name = channel_name.lower()
        
        # РџСЂРѕРІРµСЂСЏРµРј, РЅРµ РґРѕР±Р°РІР»РµРЅ Р»Рё СѓР¶Рµ
        existing = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == channel_name,
            WhitelistedChannel.platform == platform
        ).first()
        
        if existing:
            print(f"[WARN] Channel '{channel_name}' ({platform}) already in whitelist")
            return True
        
        # Р”РѕР±Р°РІР»СЏРµРј РІ whitelist
        whitelist_entry = WhitelistedChannel(
            channel_name=channel_name,
            platform=platform
        )
        db.add(whitelist_entry)
        db.commit()
        
        print(f"[OK] Added '{channel_name}' ({platform}) to whitelist")
        
        # РРЅРІР°Р»РёРґРёСЂСѓРµРј РєРµС€
        invalidate_whitelist_cache(channel_name, platform)
        print(f"[OK] Whitelist cache invalidated")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    user_id = 1
    platform = 'twitch'
    
    if len(sys.argv) > 1:
        try:
            user_id = int(sys.argv[1])
        except ValueError:
            print(f"[ERROR] Invalid user ID: {sys.argv[1]}")
            sys.exit(1)
    
    if len(sys.argv) > 2:
        platform = sys.argv[2].lower()
        if platform not in ('twitch', 'vk'):
            print(f"[ERROR] Invalid platform: {platform}. Must be 'twitch' or 'vk'")
            sys.exit(1)
    
    # Р”РѕР±Р°РІР»СЏРµРј РґР»СЏ РѕР±РµРёС… РїР»Р°С‚С„РѕСЂРј РµСЃР»Рё Сѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РµСЃС‚СЊ РѕР±Р° username
    user = next(get_db()).query(User).filter(User.id == user_id).first()
    if user:
        if user.twitch_username:
            print(f"Adding Twitch channel...")
            add_user_to_whitelist(user_id, 'twitch')
        if user.vk_username:
            print(f"Adding VK channel...")
            add_user_to_whitelist(user_id, 'vk')
    else:
        print(f"[ERROR] User {user_id} not found")
        sys.exit(1)

