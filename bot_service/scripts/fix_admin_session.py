"""Text cleaned."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import text
from core.database import db_session

def fix_admin_session():
    """Обновить сессии админа"""
    print('\n' + '=' * 60)
    print('Text cleaned.')
    print('=' * 60 + '\n')
    with db_session() as db:
        result = db.execute(text('\n            SELECT id, twitch_username, vk_username, role\n            FROM users \n            WHERE is_admin = true\n        '))
        admins = result.fetchall()
        if not admins:
            print('[ERROR] Админы не найдены в БД')
            print('\nСначала сделайте пользователя админом:')
            print('  python scripts/make_admin.py')
            return
        print(f' Найдено админов: {len(admins)}\n')
        for (user_id, twitch_username, vk_username, role) in admins:
            print(f' User ID: {user_id}')
            print(f"   Twitch: {twitch_username or 'N/A'}")
            print(f"   VK: {vk_username or 'N/A'}")
            print(f'   Role: {role}')
            if role != 'admin':
                db.execute(text("\n                    UPDATE users \n                    SET role = 'admin' \n                    WHERE id = :user_id\n                "), {'user_id': user_id})
                print(f'    Role обновлен: {role} → admin')
            else:
                print('    Role is already admin')
            result = db.execute(text('\n                DELETE FROM user_sessions \n                WHERE user_id = :user_id\n                RETURNING session_id\n            '), {'user_id': user_id})
            deleted_sessions = result.fetchall()
            if deleted_sessions:
                print(f'    Удалено старых сессий: {len(deleted_sessions)}')
                print('   [INFO]️  Теперь войдите заново в frontend')
            else:
                print('   [INFO]️  Сессий не было, просто войдите в систему')
            print()
        db.commit()
        print('=' * 60)
        print('Text cleaned.')
        print('=' * 60)
        print('\nТеперь:')
        print('1. Обновите страницу в браузере (F5)')
        print('2. Админ панель должна стать доступна')
        print('\nЕсли не помогло - перелогиньтесь:')
        print("1. Удалите cookie 'session_id' в DevTools")
        print('2. Войдите заново\n')
if __name__ == '__main__':
    fix_admin_session()
