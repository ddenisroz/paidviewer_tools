#!/usr/bin/env python
"""Скрипт для проверки данных в PostgreSQL"""
import sys
import os
from pathlib import Path

# Устанавливаем UTF-8 для консоли Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Добавляем путь для импорта
BOT_SERVICE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BOT_SERVICE_ROOT))

# Загружаем .env файл
from dotenv import load_dotenv
env_path = BOT_SERVICE_ROOT / '.env'
load_dotenv(dotenv_path=env_path)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from core.database import (
    User, UserSettings, UserToken, UserSession, BotCommand,
    ChatMessage, DropsConfig, WhitelistedChannel, ChannelReward,
    RewardQueue
)

def main():
    """Проверяет данные в PostgreSQL"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("[ERROR] DATABASE_URL не установлен")
        return 1
    
    print("=" * 60)
    print("  ПРОВЕРКА ДАННЫХ В POSTGRESQL")
    print("=" * 60)
    print()
    print(f"База данных: {database_url.split('@')[1] if '@' in database_url else database_url}")
    print()
    
    try:
        engine = create_engine(database_url)
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Проверяем основные таблицы
        tables_to_check = [
            ('Пользователи', User),
            ('Настройки пользователей', UserSettings),
            ('Токены пользователей', UserToken),
            ('Сессии пользователей', UserSession),
            ('Команды бота', BotCommand),
            ('Сообщения чата', ChatMessage),
            ('Конфигурация Drops', DropsConfig),
            ('Whitelisted каналы', WhitelistedChannel),
            ('Награды канала', ChannelReward),
            ('Очередь наград', RewardQueue),
        ]
        
        total_records = 0
        print("[STATS] Статистика по таблицам:")
        print("-" * 60)
        for table_name, model in tables_to_check:
            count = session.query(model).count()
            total_records += count
            status = "[OK]" if count > 0 else "в—‹"
            print(f"{status} {table_name:.<40} {count:>5} записей")
        
        print("-" * 60)
        print(f"Всего записей: {total_records}")
        print()
        
        # Показываем примеры данных из основных таблиц
        print("=" * 60)
        print("  РџР РРњР•Р Р« Р”РђРќРќР«РҐ")
        print("=" * 60)
        print()
        
        # Пользователи
        users = session.query(User).limit(3).all()
        if users:
            print(" Пользователи (первые 3):")
            for user in users:
                platforms = []
                if user.twitch_username:
                    platforms.append(f"Twitch: {user.twitch_username}")
                if user.vk_username:
                    platforms.append(f"VK: {user.vk_username}")
                admin_status = " (Admin)" if user.is_admin else ""
                active_status = "" if user.is_active else " (Неактивен)"
                print(f"   ID: {user.id}, {', '.join(platforms) if platforms else 'Нет платформ'}{admin_status}{active_status}")
            print()
        
        # Команды
        commands = session.query(BotCommand).limit(5).all()
        if commands:
            print("[BOT] Команды бота (первые 5):")
            for cmd in commands:
                print(f"   {cmd.command_name} -> {cmd.response_text[:50]}...")
            print()
        
        # Сообщения
        messages = session.query(ChatMessage).order_by(ChatMessage.timestamp.desc()).limit(5).all()
        if messages:
            print("[CHAT] Последние сообщения (5):")
            for msg in messages:
                print(f"   [{msg.timestamp}] {msg.author_username}: {msg.message[:50]}...")
            print()
        
        # Проверка версии базы
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.fetchone()[0]
            print(f"[PACKAGE] PostgreSQL версия: {version.split(',')[0]}")
        
        session.close()
        engine.dispose()
        
        print()
        print("=" * 60)
        print("[OK] Проверка завершена")
        print("=" * 60)
        
        return 0
        
    except Exception as e:
        print(f"[ERROR] Ошибка: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())

