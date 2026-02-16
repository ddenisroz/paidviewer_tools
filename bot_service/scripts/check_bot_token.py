"""
РЎРєСЂРёРїС‚ РґР»СЏ РїСЂРѕРІРµСЂРєРё СЃС‚Р°С‚СѓСЃР° OAuth С‚РѕРєРµРЅР° Р±РѕС‚Р°.

РџРѕРєР°Р·С‹РІР°РµС‚:
- РќР°Р»РёС‡РёРµ С‚РѕРєРµРЅР° РІ Р‘Р”
- Р›РѕРіРёРЅ Р±РѕС‚Р°
- РЎСЂРѕРє РґРµР№СЃС‚РІРёСЏ С‚РѕРєРµРЅР°
- РќР°Р»РёС‡РёРµ refresh_token
"""

import sys
import os
import asyncio
from datetime import datetime

# Р”РѕР±Р°РІР»СЏРµРј РєРѕСЂРЅРµРІСѓСЋ РґРёСЂРµРєС‚РѕСЂРёСЋ РІ РїСѓС‚СЊ
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import db_session
from services.twitch_bot_oauth_service import twitch_bot_oauth_service


async def check_bot_token():
    """РџСЂРѕРІРµСЂРёС‚СЊ СЃС‚Р°С‚СѓСЃ С‚РѕРєРµРЅР° Р±РѕС‚Р°"""
    
    print("\n" + "="*60)
    print("РџР РћР’Р•Р РљРђ РЎРўРђРўРЈРЎРђ OAUTH РўРћРљР•РќРђ Р‘РћРўРђ")
    print("="*60 + "\n")
    
    with db_session() as db:
        bot_token = await twitch_bot_oauth_service.get_bot_token(db)
        
        if not bot_token:
            print("[ERROR] РўРѕРєРµРЅ Р±РѕС‚Р° РќР• РќРђРЎРўР РћР•Рќ")
            print("\nР”Р»СЏ РЅР°СЃС‚СЂРѕР№РєРё:")
            print("1. РћС‚РєСЂРѕР№С‚Рµ Р°РґРјРёРЅРєСѓ: http://localhost:5173/settings")
            print("2. РќР°Р¶РјРёС‚Рµ 'РђРІС‚РѕСЂРёР·РѕРІР°С‚СЊ Р±РѕС‚Р°'")
            print("3. Р’РѕР№РґРёС‚Рµ РїРѕРґ Р°РєРєР°СѓРЅС‚РѕРј Р±РѕС‚Р° РЅР° Twitch")
            return
        
        print(" РўРѕРєРµРЅ Р±РѕС‚Р° РќРђРЎРўР РћР•Рќ\n")
        
        # РРЅС„РѕСЂРјР°С†РёСЏ Рѕ Р±РѕС‚Рµ
        print(f"Р›РѕРіРёРЅ Р±РѕС‚Р°:     {bot_token.get('bot_login', 'N/A')}")
        print(f"ID Р±РѕС‚Р°:        {bot_token.get('bot_user_id', 'N/A')}")
        
        # РЎСЂРѕРє РґРµР№СЃС‚РІРёСЏ
        expires_at = bot_token.get('expires_at')
        if expires_at:
            now = datetime.utcnow()
            days_left = (expires_at - now).days
            hours_left = ((expires_at - now).seconds // 3600)
            
            print(f"\nРЎСЂРѕРє РґРµР№СЃС‚РІРёСЏ:  {expires_at.strftime('%Y-%m-%d %H:%M:%S')} UTC")
            print(f"РћСЃС‚Р°Р»РѕСЃСЊ:       {days_left} РґРЅРµР№, {hours_left} С‡Р°СЃРѕРІ")
            
            if days_left < 1:
                print("вљ пёЏ  Р’РќРРњРђРќРР•: РўРѕРєРµРЅ РёСЃС‚РµРєР°РµС‚ СЃРµРіРѕРґРЅСЏ!")
            elif days_left < 7:
                print("вљ пёЏ  Р’РќРРњРђРќРР•: РўРѕРєРµРЅ СЃРєРѕСЂРѕ РёСЃС‚РµС‡РµС‚, СЂРµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ РѕР±РЅРѕРІРёС‚СЊ")
            else:
                print(" РўРѕРєРµРЅ РґРµР№СЃС‚РІРёС‚РµР»РµРЅ")
        else:
            print("\nРЎСЂРѕРє РґРµР№СЃС‚РІРёСЏ:  РќРµ СѓРєР°Р·Р°РЅ")
        
        # Refresh token
        has_refresh = bool(bot_token.get('refresh_token'))
        print(f"\nRefresh token:  {' Р•СЃС‚СЊ (Р°РІС‚РѕРѕР±РЅРѕРІР»РµРЅРёРµ СЂР°Р±РѕС‚Р°РµС‚)' if has_refresh else '[ERROR] РќРµС‚ (Р°РІС‚РѕРѕР±РЅРѕРІР»РµРЅРёРµ РЅРµРІРѕР·РјРѕР¶РЅРѕ)'}")
        
        if not has_refresh:
            print("\nвљ пёЏ  Р”Р»СЏ РІРєР»СЋС‡РµРЅРёСЏ Р°РІС‚РѕРѕР±РЅРѕРІР»РµРЅРёСЏ:")
            print("1. РћС‚РєСЂРѕР№С‚Рµ Р°РґРјРёРЅРєСѓ: http://localhost:5173/settings")
            print("2. РќР°Р¶РјРёС‚Рµ 'РџРµСЂРµР°РІС‚РѕСЂРёР·РѕРІР°С‚СЊ'")
            print("3. Р’РѕР№РґРёС‚Рµ РїРѕРґ Р°РєРєР°СѓРЅС‚РѕРј Р±РѕС‚Р° РЅР° Twitch")
        
        print("\n" + "="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(check_bot_token())
