#!/usr/bin/env python3
"""
Сделать пользователя администратором.

Usage:
    python scripts/make_admin.py <user_id>
    python scripts/make_admin.py --username <twitch_username>
"""

import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path
BOT_SERVICE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BOT_SERVICE_ROOT))

# Load .env
env_path = BOT_SERVICE_ROOT / '.env'
load_dotenv(dotenv_path=env_path, override=True)

from core.database import SessionLocal, User  # noqa: E402


def make_admin(user_id=None, username=None):
    """Сделать пользователя администратором."""
    db = SessionLocal()
    try:
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        elif username:
            user = db.query(User).filter(
                (User.twitch_username == username.lower()) | 
                (User.vk_username == username.lower())
            ).first()
        else:
            print("❌ Укажите user_id или username")
            return False
        
        if not user:
            print("❌ Пользователь не найден")
            return False
        
        if user.is_admin:
            print("✅ Пользователь уже является админом:")
            print(f"   ID: {user.id}")
            print(f"   Twitch: {user.twitch_username or 'не настроен'}")
            print(f"   VK: {user.vk_username or 'не настроен'}")
            return True
        
        # Делаем админом
        user.is_admin = True
        db.commit()
        
        print("✅ Пользователь теперь администратор:")
        print(f"   ID: {user.id}")
        print(f"   Twitch: {user.twitch_username or 'не настроен'}")
        print(f"   VK: {user.vk_username or 'не настроен'}")
        print(f"   Admin: {user.is_admin}")
        print("\nТеперь вы можете:")
        print("1. Перейти на http://localhost:8000/auth/twitch/bot/login")
        print("2. Авторизовать бота через OAuth2")
        
        return True
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def list_users():
    """Показать всех пользователей."""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        
        if not users:
            print("❌ Пользователи не найдены")
            print("\nСначала авторизуйтесь через:")
            print("- http://localhost:8000/auth/twitch/login")
            print("- http://localhost:8000/auth/vk/login")
            return
        
        print(f"Найдено пользователей: {len(users)}\n")
        
        for user in users:
            print(f"ID: {user.id}")
            print(f"  Twitch: {user.twitch_username or 'не настроен'}")
            print(f"  VK: {user.vk_username or 'не настроен'}")
            print(f"  Admin: {'✅ Да' if user.is_admin else '❌ Нет'}")
            print()
        
        print("Чтобы сделать пользователя админом:")
        print(f"  python scripts/make_admin.py {users[0].id}")
        print(f"  python scripts/make_admin.py --username {users[0].twitch_username or users[0].vk_username}")
        
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) == 1 or sys.argv[1] in ['--list', '-l']:
        list_users()
    elif len(sys.argv) == 2:
        try:
            user_id = int(sys.argv[1])
            make_admin(user_id=user_id)
        except ValueError:
            print("❌ Неверный формат user_id")
            print("Usage: python scripts/make_admin.py <user_id>")
    elif len(sys.argv) == 3 and sys.argv[1] in ['--username', '-u']:
        make_admin(username=sys.argv[2])
    else:
        print("Usage:")
        print("  python scripts/make_admin.py                    # Показать всех пользователей")
        print("  python scripts/make_admin.py <user_id>          # Сделать админом по ID")
        print("  python scripts/make_admin.py --username <name>  # Сделать админом по username")
