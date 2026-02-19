#!/usr/bin/env python3
"""
Скрипт для ручного получения VK Live токена через OAuth
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
print("Шаг 1: Откройте эту ссылку в браузере:")
print()
auth_url = f"https://auth.live.vkvideo.ru/app/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=manage"
print(auth_url)
print()
print("Шаг 2: Авторизуйтесь")
print()
print("Шаг 3: После редиректа, скопируйте 'code' из URL")
print()
print("Шаг 4: Запустите обмен кода на токен через ваше приложение")
print()
print("=" * 80)
print()
print("РђР›Р¬РўР•Р РќРђРўРР’Рђ: РСЃРїРѕР»СЊР·СѓР№С‚Рµ РёРЅС‚РµСЂС„РµР№СЃ РїСЂРёР»РѕР¶РµРЅРёСЏ")
print("1. Откройте http://localhost:5173/settings")
print("2. РџРµСЂРµР№РґРёС‚Рµ РІ 'РРЅС‚РµРіСЂР°С†РёРё'")
print("3. Нажмите 'Подключить VK Live'")
print("4. Авторизуйтесь")
print("5. Токены автоматически сохранятся в БД")
print()
print("=" * 80)

print()
print("[LOG] ВАЖНО:")
print("- Токен из .env (VK_LIVE_USER_TOKEN) - это СТАРЫЙ токен")
print("- Он НЕ имеет refresh_token")
print("- РСЃРїРѕР»СЊР·СѓР№С‚Рµ OAuth flow РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РќРћР’РћР“Рћ С‚РѕРєРµРЅР°")
print("- Новый токен будет автоматически обновляться")
print()

