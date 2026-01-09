"""
Скрипт для проверки статуса OAuth токена бота.

Показывает:
- Наличие токена в БД
- Логин бота
- Срок действия токена
- Наличие refresh_token
"""

import sys
import os
import asyncio
from datetime import datetime

# Добавляем корневую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import db_session
from services.twitch_bot_oauth_service import twitch_bot_oauth_service


async def check_bot_token():
    """Проверить статус токена бота"""
    
    print("\n" + "="*60)
    print("ПРОВЕРКА СТАТУСА OAUTH ТОКЕНА БОТА")
    print("="*60 + "\n")
    
    with db_session() as db:
        bot_token = await twitch_bot_oauth_service.get_bot_token(db)
        
        if not bot_token:
            print("❌ Токен бота НЕ НАСТРОЕН")
            print("\nДля настройки:")
            print("1. Откройте админку: http://localhost:5173/settings")
            print("2. Нажмите 'Авторизовать бота'")
            print("3. Войдите под аккаунтом бота на Twitch")
            return
        
        print("✅ Токен бота НАСТРОЕН\n")
        
        # Информация о боте
        print(f"Логин бота:     {bot_token.get('bot_login', 'N/A')}")
        print(f"ID бота:        {bot_token.get('bot_user_id', 'N/A')}")
        
        # Срок действия
        expires_at = bot_token.get('expires_at')
        if expires_at:
            now = datetime.utcnow()
            days_left = (expires_at - now).days
            hours_left = ((expires_at - now).seconds // 3600)
            
            print(f"\nСрок действия:  {expires_at.strftime('%Y-%m-%d %H:%M:%S')} UTC")
            print(f"Осталось:       {days_left} дней, {hours_left} часов")
            
            if days_left < 1:
                print("⚠️  ВНИМАНИЕ: Токен истекает сегодня!")
            elif days_left < 7:
                print("⚠️  ВНИМАНИЕ: Токен скоро истечет, рекомендуется обновить")
            else:
                print("✅ Токен действителен")
        else:
            print("\nСрок действия:  Не указан")
        
        # Refresh token
        has_refresh = bool(bot_token.get('refresh_token'))
        print(f"\nRefresh token:  {'✅ Есть (автообновление работает)' if has_refresh else '❌ Нет (автообновление невозможно)'}")
        
        if not has_refresh:
            print("\n⚠️  Для включения автообновления:")
            print("1. Откройте админку: http://localhost:5173/settings")
            print("2. Нажмите 'Переавторизовать'")
            print("3. Войдите под аккаунтом бота на Twitch")
        
        print("\n" + "="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(check_bot_token())
