#!/usr/bin/env python3
"""
Простая утилита для извлечения VK Live токена из базы данных
"""
import sqlite3
import os

def get_vk_token():
    """Получить VK токен из базы данных"""
    db_path = 'database.db'
    
    if not os.path.exists(db_path):
        print("❌ База данных не найдена")
        return None
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Получаем VK токены
        cursor.execute("""
            SELECT user_id, access_token, expires_at 
            FROM user_tokens 
            WHERE platform = 'vk'
        """)
        
        tokens = cursor.fetchall()
        
        if not tokens:
            print("❌ VK токены не найдены в базе данных")
            return None
        
        print("🔍 Найденные VK токены:")
        print("=" * 50)
        
        for i, (user_id, access_token, expires_at) in enumerate(tokens, 1):
            print(f"\n{i}. Пользователь:")
            print(f"   User ID: {user_id}")
            print(f"   Access Token: {access_token[:20]}...{access_token[-10:]}")
            print(f"   Expires At: {expires_at}")
        
        # Возвращаем первый токен
        first_token = tokens[0]
        access_token = first_token[1]
        
        print(f"\n✅ Используем токен пользователя ID: {first_token[0]}")
        print(f"🔑 Полный токен: {access_token}")
        
        return access_token
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return None
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    token = get_vk_token()
    
    if token:
        print(f"\n📝 Добавьте в .env файл:")
        print(f"VK_LIVE_USER_TOKEN={token}")
        
        print(f"\n🧪 Для тестирования токена:")
        print(f"curl -H \"Authorization: Bearer {token}\" https://apidev.live.vkvideo.ru/v1/current_user")
    else:
        print(f"\n❌ Не удалось извлечь токен")
