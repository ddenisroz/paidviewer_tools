#!/usr/bin/env python3
"""
Скрипт для исправления существующих пользователей:
- Создание UserSettings
- Инициализация команд
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.database import get_db, User, UserSettings, BotCommand
from datetime import datetime

def fix_user_settings():
    """Создать UserSettings для пользователей без него"""
    db = next(get_db())
    
    try:
        users = db.query(User).all()
        fixed = 0
        
        for user in users:
            # Проверяем есть ли UserSettings
            settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
            
            if not settings:
                # Определяем channel_name
                channel_name = user.twitch_username or user.vk_username
                if not channel_name:
                    print(f"⚠️  User {user.id} has no username, skipping")
                    continue
                
                # Создаем UserSettings
                user_settings = UserSettings(
                    user_id=user.id,
                    channel_name=channel_name.lower(),
                    chat_enabled=True
                )
                db.add(user_settings)
                print(f"✅ Created UserSettings for user {user.id} ({channel_name})")
                fixed += 1
        
        if fixed > 0:
            db.commit()
            print(f"\n✅ Fixed {fixed} users")
        else:
            print("\n✅ All users already have UserSettings")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

def init_commands_for_user(user_id: int):
    """Инициализировать команды для конкретного пользователя"""
    db = next(get_db())
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            print(f"❌ User {user_id} not found")
            return
        
        # Проверяем есть ли UserSettings
        settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        if not settings:
            print(f"❌ User {user_id} has no UserSettings. Run fix_user_settings first.")
            return
        
        # Базовые команды
        basic_commands = [
            {
                "command_name": "help",
                "command_type": "basic",
                "description": "Показать список всех доступных команд",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "all",
                "cooldown_seconds": 5,
                "tags": "информация"
            },
            {
                "command_name": "sr",
                "command_type": "basic",
                "description": "Заказать YouTube видео",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "all",
                "cooldown_seconds": 10,
                "tags": "youtube медиа"
            },
            {
                "command_name": "skip",
                "command_type": "basic",
                "description": "Пропустить текущее видео",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "moderator,broadcaster",
                "cooldown_seconds": 5,
                "tags": "youtube медиа"
            },
            {
                "command_name": "tts",
                "command_type": "basic",
                "description": "Включить/выключить TTS",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "broadcaster",
                "cooldown_seconds": 5,
                "tags": "tts управление"
            }
        ]
        
        created = 0
        for cmd_data in basic_commands:
            # Проверяем существует ли команда
            existing = db.query(BotCommand).filter(
                BotCommand.user_id == user_id,
                BotCommand.command_name == cmd_data["command_name"],
                BotCommand.command_type == "basic"
            ).first()
            
            if not existing:
                cmd = BotCommand(
                    user_id=user_id,
                    channel_name=settings.channel_name,  # ВАЖНО: добавляем channel_name
                    **cmd_data
                )
                db.add(cmd)
                created += 1
        
        if created > 0:
            db.commit()
            print(f"✅ Created {created} commands for user {user_id}")
        else:
            print(f"✅ User {user_id} already has all commands")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔧 Fixing existing users...")
    print("\n1. Creating UserSettings...")
    fix_user_settings()
    
    print("\n2. Initializing commands...")
    db = next(get_db())
    users = db.query(User).all()
    for user in users:
        init_commands_for_user(user.id)
    db.close()
    
    print("\n✅ Done!")

