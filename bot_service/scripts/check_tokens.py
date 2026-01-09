#!/usr/bin/env python3
"""
Скрипт для проверки токенов в БД
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.database import get_db, UserToken
from core.datetime_utils import utcnow_naive

def check_tokens():
    print("=" * 80)
    print("[DEBUG] ПРОВЕРКА ТОКЕНОВ В БД")
    print("=" * 80)
    print()
    
    db = next(get_db())
    try:
        tokens = db.query(UserToken).all()
        
        if not tokens:
            print("[ERROR] В базе данных нет токенов!")
            print()
            print("Что делать:")
            print("1. Откройте http://localhost:5173")
            print("2. Перейдите в Настройки → Интеграции")
            print("3. Подключите платформы (Twitch, VK Live, DonationAlerts)")
            print()
            return
        
        print(f"Найдено токенов: {len(tokens)}")
        print()
        
        now = utcnow_naive()
        
        for token in tokens:
            print(f"[LIST] Платформа: {token.platform.upper()}")
            print(f"   User ID: {token.user_id}")
            print(f"   Platform User ID: {token.platform_user_id}")
            print(f"   Platform Username: {token.platform_username or 'N/A'}")
            print(f"   Access Token: {'✓' if token.access_token else '✗'}")
            print(f"   Refresh Token: {'✓' if token.refresh_token else '✗'}")
            
            if token.expires_at:
                expires_in = token.expires_at - now
                expires_str = f"{expires_in.days} дней {expires_in.seconds // 3600} часов"
                
                if expires_in.total_seconds() > 0:
                    print(f"   Expires at: {token.expires_at} (через {expires_str})")
                    print(f"   Статус: [OK] Действителен")
                else:
                    print(f"   Expires at: {token.expires_at} (истек {expires_str} назад)")
                    print(f"   Статус: [WARN] ИСТЕК")
                    if token.refresh_token:
                        print(f"   Refresh: ✓ Можно обновить")
                    else:
                        print(f"   Refresh: ✗ Нужна повторная авторизация")
            else:
                print(f"   Expires at: N/A")
                print(f"   Статус: [WARN] Бессрочный (или не установлен)")
            
            print()
        
        print("=" * 80)
        print()
        
        # Проверка VK Live токена
        vk_tokens = [t for t in tokens if t.platform == 'vk']
        if vk_tokens:
            print("[OK] VK Live токен найден в БД")
            vk_token = vk_tokens[0]
            if vk_token.refresh_token:
                print("[OK] Refresh token доступен - автообновление работает!")
            else:
                print("[WARN] Refresh token отсутствует - нужна повторная авторизация")
        else:
            print("[ERROR] VK Live токен НЕ найден в БД")
            print("   → Подключите VK Live через интерфейс!")
        
        print()
        
    except Exception as e:
        print(f"[ERROR] Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_tokens()

