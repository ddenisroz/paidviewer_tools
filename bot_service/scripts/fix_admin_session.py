"""
Обновить все активные сессии пользователя, сделав его админом.

РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ:
    python scripts/fix_admin_session.py
"""

import sys
import os

# Добавляем корневую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Загружаем переменные окружения
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text  # noqa: E402
from core.database import db_session  # noqa: E402


def fix_admin_session():
    """Обновить сессии админа"""
    
    print("\n" + "="*60)
    print("РћР‘РќРћР’Р›Р•РќРР• РЎР•РЎРЎРР™ РђР”РњРРќРђ")
    print("="*60 + "\n")
    
    with db_session() as db:
        # Находим всех админов
        result = db.execute(text("""
            SELECT id, twitch_username, vk_username, role
            FROM users 
            WHERE is_admin = true
        """))
        
        admins = result.fetchall()
        
        if not admins:
            print("[ERROR] Админы не найдены в БД")
            print("\nСначала сделайте пользователя админом:")
            print("  python scripts/make_admin.py")
            return
        
        print(f" Найдено админов: {len(admins)}\n")
        
        for user_id, twitch_username, vk_username, role in admins:
            print(f" User ID: {user_id}")
            print(f"   Twitch: {twitch_username or 'N/A'}")
            print(f"   VK: {vk_username or 'N/A'}")
            print(f"   Role: {role}")
            
            # 1. Обновляем role в таблице users
            if role != 'admin':
                db.execute(text("""
                    UPDATE users 
                    SET role = 'admin' 
                    WHERE id = :user_id
                """), {"user_id": user_id})
                print(f"    Role обновлен: {role} → admin")
            else:
                print("    Role СѓР¶Рµ admin")
            
            # 2. Удаляем все старые сессии (чтобы пользователь перелогинился)
            result = db.execute(text("""
                DELETE FROM user_sessions 
                WHERE user_id = :user_id
                RETURNING session_id
            """), {"user_id": user_id})
            
            deleted_sessions = result.fetchall()
            
            if deleted_sessions:
                print(f"    Удалено старых сессий: {len(deleted_sessions)}")
                print("   [INFO]️  Теперь войдите заново в frontend")
            else:
                print("   [INFO]️  Сессий не было, просто войдите в систему")
            
            print()
        
        db.commit()
        
        print("="*60)
        print(" ГОТОВО!")
        print("="*60)
        print("\nТеперь:")
        print("1. Обновите страницу в браузере (F5)")
        print("2. Админ панель должна стать доступна")
        print("\nЕсли не помогло - перелогиньтесь:")
        print("1. Удалите cookie 'session_id' в DevTools")
        print("2. Войдите заново\n")


if __name__ == "__main__":
    fix_admin_session()
