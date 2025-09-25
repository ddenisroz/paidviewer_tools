#!/usr/bin/env python3
"""
Утилита для извлечения VK Live токена из базы данных
"""
import sqlite3
import os

def get_vk_token():
    """Получить VK токен из базы данных"""
    db_path = 'data/app_data.db'
    
    if not os.path.exists(db_path):
        print("❌ База данных не найдена")
        return None
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Получаем VK токены
        cursor.execute("""
            SELECT access_token, platform_user_id, platform_display_name 
            FROM user_tokens 
            WHERE platform = 'vk'
        """)
        
        tokens = cursor.fetchall()
        
        if not tokens:
            print("❌ VK токены не найдены в базе данных")
            return None
        
        print("🔍 Найденные VK токены:")
        print("=" * 50)
        
        for i, (access_token, user_id, display_name) in enumerate(tokens, 1):
            print(f"\n{i}. Пользователь:")
            print(f"   Display Name: {display_name}")
            print(f"   Platform User ID: {user_id}")
            print(f"   Access Token: {access_token[:20]}...{access_token[-10:]}")
        
        # Возвращаем токен с именем пользователя (более свежий)
        selected_token = None
        for token_data in tokens:
            if token_data[2]:  # Если есть display_name
                selected_token = token_data
                break
        
        if not selected_token:
            selected_token = tokens[0]  # Используем первый, если нет с именем
        
        access_token = selected_token[0]
        display_name = selected_token[2] or "Unknown"
        user_id = selected_token[1] or "Unknown"
        
        print(f"\n✅ Используем токен пользователя: {display_name} (ID: {user_id})")
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
