#!/usr/bin/env python3
"""
РЎРєСЂРёРїС‚ РґР»СЏ РїСЂРѕРІРµСЂРєРё С‚РѕРєРµРЅРѕРІ РІ Р‘Р”
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.database import get_db, UserToken
from core.datetime_utils import utcnow_naive

def check_tokens():
    print("=" * 80)
    print("[DEBUG] РџР РћР’Р•Р РљРђ РўРћРљР•РќРћР’ Р’ Р‘Р”")
    print("=" * 80)
    print()
    
    db = next(get_db())
    try:
        tokens = db.query(UserToken).all()
        
        if not tokens:
            print("[ERROR] Р’ Р±Р°Р·Рµ РґР°РЅРЅС‹С… РЅРµС‚ С‚РѕРєРµРЅРѕРІ!")
            print()
            print("Р§С‚Рѕ РґРµР»Р°С‚СЊ:")
            print("1. РћС‚РєСЂРѕР№С‚Рµ http://localhost:5173")
            print("2. РџРµСЂРµР№РґРёС‚Рµ РІ РќР°СЃС‚СЂРѕР№РєРё в†’ РРЅС‚РµРіСЂР°С†РёРё")
            print("3. РџРѕРґРєР»СЋС‡РёС‚Рµ РїР»Р°С‚С„РѕСЂРјС‹ (Twitch, VK Live, DonationAlerts)")
            print()
            return
        
        print(f"РќР°Р№РґРµРЅРѕ С‚РѕРєРµРЅРѕРІ: {len(tokens)}")
        print()
        
        now = utcnow_naive()
        
        for token in tokens:
            print(f"[LIST] РџР»Р°С‚С„РѕСЂРјР°: {token.platform.upper()}")
            print(f"   User ID: {token.user_id}")
            print(f"   Platform User ID: {token.platform_user_id}")
            print(f"   Platform Username: {token.platform_username or 'N/A'}")
            print(f"   Access Token: {'[OK]' if token.access_token else '[X]'}")
            print(f"   Refresh Token: {'[OK]' if token.refresh_token else '[X]'}")
            
            if token.expires_at:
                expires_in = token.expires_at - now
                expires_str = f"{expires_in.days} РґРЅРµР№ {expires_in.seconds // 3600} С‡Р°СЃРѕРІ"
                
                if expires_in.total_seconds() > 0:
                    print(f"   Expires at: {token.expires_at} (С‡РµСЂРµР· {expires_str})")
                    print(f"   РЎС‚Р°С‚СѓСЃ: [OK] Р”РµР№СЃС‚РІРёС‚РµР»РµРЅ")
                else:
                    print(f"   Expires at: {token.expires_at} (РёСЃС‚РµРє {expires_str} РЅР°Р·Р°Рґ)")
                    print(f"   РЎС‚Р°С‚СѓСЃ: [WARN] РРЎРўР•Рљ")
                    if token.refresh_token:
                        print(f"   Refresh: [OK] РњРѕР¶РЅРѕ РѕР±РЅРѕРІРёС‚СЊ")
                    else:
                        print(f"   Refresh: [X] РќСѓР¶РЅР° РїРѕРІС‚РѕСЂРЅР°СЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ")
            else:
                print(f"   Expires at: N/A")
                print(f"   РЎС‚Р°С‚СѓСЃ: [WARN] Р‘РµСЃСЃСЂРѕС‡РЅС‹Р№ (РёР»Рё РЅРµ СѓСЃС‚Р°РЅРѕРІР»РµРЅ)")
            
            print()
        
        print("=" * 80)
        print()
        
        # РџСЂРѕРІРµСЂРєР° VK Live С‚РѕРєРµРЅР°
        vk_tokens = [t for t in tokens if t.platform == 'vk']
        if vk_tokens:
            print("[OK] VK Live С‚РѕРєРµРЅ РЅР°Р№РґРµРЅ РІ Р‘Р”")
            vk_token = vk_tokens[0]
            if vk_token.refresh_token:
                print("[OK] Refresh token РґРѕСЃС‚СѓРїРµРЅ - Р°РІС‚РѕРѕР±РЅРѕРІР»РµРЅРёРµ СЂР°Р±РѕС‚Р°РµС‚!")
            else:
                print("[WARN] Refresh token РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚ - РЅСѓР¶РЅР° РїРѕРІС‚РѕСЂРЅР°СЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ")
        else:
            print("[ERROR] VK Live С‚РѕРєРµРЅ РќР• РЅР°Р№РґРµРЅ РІ Р‘Р”")
            print("   в†’ РџРѕРґРєР»СЋС‡РёС‚Рµ VK Live С‡РµСЂРµР· РёРЅС‚РµСЂС„РµР№СЃ!")
        
        print()
        
    except Exception as e:
        print(f"[ERROR] РћС€РёР±РєР°: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_tokens()

