"""
Тест endpoint /api/auth/status для проверки is_admin.

Использование:
    python scripts/test_auth_status.py <session_id>
"""

import sys
import os
import requests

# Добавляем корневую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Загружаем переменные окружения
from dotenv import load_dotenv
load_dotenv()


def test_auth_status(session_id: str = None):
    """Тестировать /api/auth/status"""
    
    print("\n" + "="*60)
    print("ТЕСТ /api/auth/status")
    print("="*60 + "\n")
    
    url = "http://localhost:8000/api/auth/status"
    
    cookies = {}
    if session_id:
        cookies['session_id'] = session_id
        print(f"📝 Session ID: {session_id}\n")
    else:
        print("⚠️  Session ID не указан, тестируем без авторизации\n")
    
    try:
        response = requests.get(url, cookies=cookies)
        
        print(f"Status Code: {response.status_code}")
        print(f"\nResponse:")
        print("-" * 60)
        
        data = response.json()
        
        import json
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        print("-" * 60)
        
        if data.get('authenticated'):
            user = data.get('user', {})
            print(f"\n✅ Авторизован")
            print(f"   User ID: {user.get('id')}")
            print(f"   Twitch: {user.get('twitch_username')}")
            print(f"   VK: {user.get('vk_username')}")
            print(f"   is_admin: {user.get('is_admin')}")
            
            if user.get('is_admin'):
                print(f"\n🎉 Пользователь АДМИН!")
            else:
                print(f"\n⚠️  Пользователь НЕ админ")
        else:
            print(f"\n❌ Не авторизован")
        
        print("\n" + "="*60 + "\n")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}\n")


if __name__ == "__main__":
    session_id = sys.argv[1] if len(sys.argv) > 1 else None
    
    if not session_id:
        print("\n💡 Использование:")
        print("   python scripts/test_auth_status.py <session_id>")
        print("\nДля получения session_id:")
        print("   1. Откройте http://localhost:5173")
        print("   2. F12 → Application → Cookies")
        print("   3. Скопируйте значение 'session_id'\n")
    
    test_auth_status(session_id)
