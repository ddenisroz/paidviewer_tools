#!/usr/bin/env python3
"""
РЎРєСЂРёРїС‚ РґР»СЏ СЂСѓС‡РЅРѕРіРѕ РїРѕР»СѓС‡РµРЅРёСЏ VK Live С‚РѕРєРµРЅР° С‡РµСЂРµР· OAuth
РСЃРїРѕР»СЊР·СѓР№С‚Рµ РµСЃР»Рё РЅСѓР¶РЅРѕ РїРѕР»СѓС‡РёС‚СЊ С‚РѕРєРµРЅ РґР»СЏ Р±РѕС‚Р° РІСЂСѓС‡РЅСѓСЋ
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv()

client_id = os.getenv("VK_CLIENT_ID")
redirect_uri = os.getenv("VK_REDIRECT_URI", "http://localhost:8000/auth/vk/callback")

print("=" * 80)
print("[AUTH] РџРћР›РЈР§Р•РќРР• VK LIVE РўРћРљР•РќРђ")
print("=" * 80)
print()
print("РЁР°Рі 1: РћС‚РєСЂРѕР№С‚Рµ СЌС‚Сѓ СЃСЃС‹Р»РєСѓ РІ Р±СЂР°СѓР·РµСЂРµ:")
print()
auth_url = f"https://auth.live.vkvideo.ru/app/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=manage"
print(auth_url)
print()
print("РЁР°Рі 2: РђРІС‚РѕСЂРёР·СѓР№С‚РµСЃСЊ")
print()
print("РЁР°Рі 3: РџРѕСЃР»Рµ СЂРµРґРёСЂРµРєС‚Р°, СЃРєРѕРїРёСЂСѓР№С‚Рµ 'code' РёР· URL")
print()
print("РЁР°Рі 4: Р—Р°РїСѓСЃС‚РёС‚Рµ РѕР±РјРµРЅ РєРѕРґР° РЅР° С‚РѕРєРµРЅ С‡РµСЂРµР· РІР°С€Рµ РїСЂРёР»РѕР¶РµРЅРёРµ")
print()
print("=" * 80)
print()
print("РђР›Р¬РўР•Р РќРђРўРР’Рђ: РСЃРїРѕР»СЊР·СѓР№С‚Рµ РёРЅС‚РµСЂС„РµР№СЃ РїСЂРёР»РѕР¶РµРЅРёСЏ")
print("1. РћС‚РєСЂРѕР№С‚Рµ http://localhost:5173/settings")
print("2. РџРµСЂРµР№РґРёС‚Рµ РІ 'РРЅС‚РµРіСЂР°С†РёРё'")
print("3. РќР°Р¶РјРёС‚Рµ 'РџРѕРґРєР»СЋС‡РёС‚СЊ VK Live'")
print("4. РђРІС‚РѕСЂРёР·СѓР№С‚РµСЃСЊ")
print("5. РўРѕРєРµРЅС‹ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРѕС…СЂР°РЅСЏС‚СЃСЏ РІ Р‘Р”")
print()
print("=" * 80)

print()
print("[LOG] Р’РђР–РќРћ:")
print("- РўРѕРєРµРЅ РёР· .env (VK_LIVE_USER_TOKEN) - СЌС‚Рѕ РЎРўРђР Р«Р™ С‚РѕРєРµРЅ")
print("- РћРЅ РќР• РёРјРµРµС‚ refresh_token")
print("- РСЃРїРѕР»СЊР·СѓР№С‚Рµ OAuth flow РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РќРћР’РћР“Рћ С‚РѕРєРµРЅР°")
print("- РќРѕРІС‹Р№ С‚РѕРєРµРЅ Р±СѓРґРµС‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕР±РЅРѕРІР»СЏС‚СЊСЃСЏ")
print()

