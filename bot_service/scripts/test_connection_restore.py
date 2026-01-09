#!/usr/bin/env python3
"""
Скрипт для тестирования восстановления подключений
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal, UserSession
from core.connection_manager import get_connection_manager
import asyncio

    async def test_connection_restore():
    """Тестировать восстановление подключений"""
    print("[TEST] Тестирование восстановления подключений...")
    
    db = SessionLocal()
    try:
        # 1. Проверяем активные сессии в БД
        active_sessions = db.query(UserSession).filter(
            UserSession.is_active == True
        ).all()
        
        print(f"[STATS] Найдено {len(active_sessions)} активных сессий в БД:")
        for session in active_sessions:
            device_info = session.device_info or {}
            channel = device_info.get('monitored_channel', 'Не указан')
            print(f"  - Session: {session.session_id}, Channel: {channel}")
        
        # 2. Создаем connection manager
        connection_manager = get_connection_manager()
        
        # 3. Восстанавливаем сессии
        await connection_manager.restore_active_sessions_from_db(db)
        
        # 4. Проверяем результат
        active_channels = connection_manager.get_active_channels()
        print(f"[OK] Восстановлено {len(active_channels)} активных каналов: {active_channels}")
        
        # 5. Проверяем детали
        active_sessions_dict = connection_manager.get_active_sessions()
        for channel, sessions in active_sessions_dict.items():
            print(f"  [CH] {channel}: {len(sessions)} сессий")
        
    except Exception as e:
        print(f"[ERROR] Ошибка: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_connection_restore())
