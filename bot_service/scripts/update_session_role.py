#!/usr/bin/env python3
"""
Обновить роль в активных сессиях после изменения is_admin.
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

from core.database import SessionLocal, User, UserSession  # noqa: E402
from core.session_manager import session_manager  # noqa: E402


def update_sessions():
    """Обновить роли в активных сессиях."""
    db = SessionLocal()
    try:
        # Находим всех админов
        admins = db.query(User).filter(User.is_admin).all()
        
        if not admins:
            print("❌ Админы не найдены")
            return
        
        print(f"Найдено админов: {len(admins)}\n")
        
        updated_count = 0
        
        for admin in admins:
            print(f"Обновление сессий для: {admin.twitch_username or admin.vk_username} (ID: {admin.id})")
            
            # Находим активные сессии пользователя
            sessions = db.query(UserSession).filter(
                UserSession.user_id == admin.id,
                UserSession.is_active
            ).all()
            
            if not sessions:
                print("  ⚠️  Активных сессий не найдено")
                continue
            
            print(f"  Найдено активных сессий: {len(sessions)}")
            
            for session in sessions:
                # Обновляем роль в session_manager
                session_data = session_manager.get_session(session.session_id)
                
                if session_data:
                    session_data['is_admin'] = True
                    session_data['role'] = 'admin'
                    session_manager.update_session(session.session_id, session_data)
                    print(f"  ✅ Сессия {session.session_id[:8]}... обновлена")
                    updated_count += 1
                else:
                    print(f"  ⚠️  Сессия {session.session_id[:8]}... не найдена в памяти")
            
            print()
        
        print(f"\n✅ Обновлено сессий: {updated_count}")
        print("\nТеперь:")
        print("1. Обновите страницу в браузере (F5)")
        print("2. Перейдите на http://localhost:8000/auth/twitch/bot/login")
        
    finally:
        db.close()


if __name__ == "__main__":
    update_sessions()
