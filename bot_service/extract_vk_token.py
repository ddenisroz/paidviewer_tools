#!/usr/bin/env python3
"""
Утилита для извлечения VK Live токена из базы данных
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db, UserToken

def extract_vk_token():
    """Извлечь VK токен из базы данных"""
    db = next(get_db())
    try:
        tokens = db.query(UserToken).filter(UserToken.platform == 'vk').all()
        
        if not tokens:
            print("❌ VK токены не найдены в базе данных")
            return None
        
        print("🔍 Найденные VK токены:")
        print("=" * 50)
        
        for i, token in enumerate(tokens, 1):
            print(f"\n{i}. Пользователь:")
            print(f"   ID: {token.user_id}")
            print(f"   Access Token: {token.access_token[:20]}...{token.access_token[-10:]}")
            print(f"   Expires At: {token.expires_at}")
        
        # Возвращаем первый токен
        first_token = tokens[0]
        print(f"\n✅ Используем токен пользователя ID: {first_token.user_id}")
        print(f"🔑 Полный токен: {first_token.access_token}")
        
        return first_token.access_token
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return None
    finally:
        db.close()

if __name__ == "__main__":
    token = extract_vk_token()
    
    if token:
        print(f"\n📝 Добавьте в .env файл:")
        print(f"VK_LIVE_USER_TOKEN={token}")
        
        print(f"\n🧪 Для тестирования токена:")
        print(f"curl -H \"Authorization: Bearer {token}\" https://apidev.live.vkvideo.ru/v1/current_user")
    else:
        print(f"\n❌ Не удалось извлечь токен")
