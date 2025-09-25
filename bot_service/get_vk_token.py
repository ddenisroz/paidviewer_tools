#!/usr/bin/env python3
"""
Утилита для получения VK Live пользовательского токена
"""
import os
import asyncio
import aiohttp
import base64
from urllib.parse import urlencode

async def get_vk_live_token():
    """Получить токен VK Live через OAuth"""
    
    # Загружаем настройки из .env
    from dotenv import load_dotenv
    load_dotenv()
    
    client_id = os.getenv("VK_CLIENT_ID")
    client_secret = os.getenv("VK_CLIENT_SECRET")
    redirect_uri = "http://localhost:8000/auth/vk/callback"
    
    if not client_id or not client_secret:
        print("❌ Ошибка: VK_CLIENT_ID и VK_CLIENT_SECRET должны быть настроены в .env")
        return None
    
    # Шаг 1: Генерируем URL для авторизации
    auth_params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "channel:stream:settings"
    }
    
    auth_url = f"https://auth.live.vkvideo.ru/app/oauth2/authorize?{urlencode(auth_params)}"
    
    print("🔗 Откройте этот URL в браузере:")
    print(f"\n{auth_url}\n")
    print("📋 После авторизации скопируйте код из URL (параметр 'code')")
    
    # Шаг 2: Получаем код от пользователя
    code = input("\n🔑 Введите код авторизации: ").strip()
    
    if not code:
        print("❌ Код не введен")
        return None
    
    # Шаг 3: Обмениваем код на токен
    print("\n🔄 Обмениваем код на токен...")
    
    try:
        async with aiohttp.ClientSession() as session:
            # Подготавливаем Basic Auth
            credentials = f"{client_id}:{client_secret}"
            base64_credentials = base64.b64encode(credentials.encode()).decode()
            
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Basic {base64_credentials}"
            }
            
            data = {
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
                "code": code
            }
            
            async with session.post(
                "https://api.live.vkvideo.ru/oauth/server/token",
                data=data,
                headers=headers
            ) as response:
                
                if response.status == 200:
                    token_data = await response.json()
                    access_token = token_data.get("access_token")
                    
                    if access_token:
                        print(f"\n✅ Токен получен успешно!")
                        print(f"🔑 Access Token: {access_token}")
                        print(f"\n📝 Добавьте в .env файл:")
                        print(f"VK_LIVE_USER_TOKEN={access_token}")
                        return access_token
                    else:
                        print("❌ Токен не найден в ответе")
                        print(f"Ответ: {token_data}")
                else:
                    error_text = await response.text()
                    print(f"❌ Ошибка получения токена: {response.status}")
                    print(f"Ответ: {error_text}")
                    
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    
    return None

async def test_token(token):
    """Тестируем полученный токен"""
    print(f"\n🧪 Тестируем токен...")
    
    try:
        async with aiohttp.ClientSession() as session:
            headers = {"Authorization": f"Bearer {token}"}
            
            async with session.get(
                "https://apidev.live.vkvideo.ru/v1/current_user",
                headers=headers
            ) as response:
                
                if response.status == 200:
                    user_data = await response.json()
                    print("✅ Токен работает!")
                    print(f"👤 Пользователь: {user_data}")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Токен не работает: {response.status}")
                    print(f"Ответ: {error_text}")
                    return False
                    
    except Exception as e:
        print(f"❌ Ошибка тестирования: {e}")
        return False

async def main():
    print("🚀 VK Live Token Generator")
    print("=" * 50)
    
    # Получаем токен
    token = await get_vk_live_token()
    
    if token:
        # Тестируем токен
        await test_token(token)
        
        print(f"\n🎉 Готово! Токен можно использовать для VK Live 'бота'")
    else:
        print(f"\n❌ Не удалось получить токен")

if __name__ == "__main__":
    asyncio.run(main())
