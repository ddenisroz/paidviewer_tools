#!/usr/bin/env python3
"""
Скрипт для инициализации базовых команд бота
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.database import get_db, BotCommand, User, UserToken
from datetime import datetime

def init_basic_commands():
    """Инициализировать базовые команды для всех пользователей"""
    db = next(get_db())
    
    try:
        # Получаем всех пользователей
        users = db.query(User).all()
        
        if not users:
            print("❌ Нет пользователей в базе данных")
            return
        
        # Базовые команды для управления функционалом бота
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
                "description": "Заказать YouTube видео (song request)",
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
                "command_name": "clear",
                "command_type": "basic",
                "description": "Очистить очередь видео",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "moderator,broadcaster",
                "cooldown_seconds": 10,
                "tags": "youtube медиа"
            },
            {
                "command_name": "title",
                "command_type": "basic",
                "description": "Сменить название стрима",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "broadcaster",
                "cooldown_seconds": 30,
                "tags": "stream управление"
            },
            {
                "command_name": "game",
                "command_type": "basic",
                "description": "Сменить категорию/игру стрима",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "broadcaster",
                "cooldown_seconds": 30,
                "tags": "stream управление"
            },
            {
                "command_name": "ttsvolume",
                "command_type": "basic",
                "description": "Настроить громкость TTS (0-100)",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "broadcaster,moderator",
                "cooldown_seconds": 5,
                "tags": "tts настройки"
            },
            {
                "command_name": "ytvolume",
                "command_type": "basic",
                "description": "Настроить громкость YouTube (0-100)",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "broadcaster,moderator",
                "cooldown_seconds": 5,
                "tags": "youtube настройки"
            },
            {
                "command_name": "voice",
                "command_type": "basic",
                "description": "Выбрать голос для TTS",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "all",
                "cooldown_seconds": 30,
                "tags": "tts голос"
            },
            {
                "command_name": "randomvoice",
                "command_type": "basic",
                "description": "Выбрать случайный голос для TTS",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "all",
                "cooldown_seconds": 30,
                "tags": "tts голос"
            },
            {
                "command_name": "mute",
                "command_type": "basic",
                "description": "Отключить TTS для пользователя",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "broadcaster,moderator",
                "cooldown_seconds": 5,
                "tags": "tts модерация"
            },
            {
                "command_name": "unmute",
                "command_type": "basic",
                "description": "Включить TTS для пользователя",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "broadcaster,moderator",
                "cooldown_seconds": 5,
                "tags": "tts модерация"
            },
            {
                "command_name": "analyze",
                "command_type": "basic",
                "description": "Отправить историю сообщений на анализ ИИ",
                "response_text": "",
                "platforms": "twitch,vk",
                "allowed_roles": "broadcaster",
                "cooldown_seconds": 60,
                "tags": "ai анализ"
            }
        ]
        
        commands_created = 0
        
        for user in users:
            # Получаем каналы пользователя
            user_tokens = db.query(UserToken).filter(UserToken.user_id == user.id).all()
            
            if not user_tokens:
                print(f"⚠️ У пользователя {user.id} нет подключенных каналов")
                continue
                
            for token in user_tokens:
                # Определяем название канала
                if token.platform == "twitch":
                    channel_name = f"twitch_{token.platform_user_id}"
                elif token.platform == "vk":
                    channel_name = f"vk_{token.platform_user_id}"
                else:
                    continue
                
                # Создаем команды для этого канала
                for cmd_data in basic_commands:
                    # Проверяем, есть ли уже такая команда
                    existing = db.query(BotCommand).filter(
                        BotCommand.user_id == user.id,
                        BotCommand.channel_name == channel_name,
                        BotCommand.command_name == cmd_data["command_name"]
                    ).first()
                    
                    if existing:
                        continue
                    
                    # Создаем новую команду
                    command = BotCommand(
                        user_id=user.id,
                        channel_name=channel_name,
                        command_name=cmd_data["command_name"],
                        command_type=cmd_data["command_type"],
                        description=cmd_data["description"],
                        response_text=cmd_data["response_text"],
                        is_enabled=True,
                        platforms=cmd_data["platforms"],
                        allowed_roles=cmd_data["allowed_roles"],
                        cooldown_seconds=cmd_data["cooldown_seconds"],
                        tags=cmd_data["tags"],
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    
                    db.add(command)
                    commands_created += 1
        
        db.commit()
        print(f"✅ Создано {commands_created} базовых команд")
        
    except Exception as e:
        print(f"❌ Ошибка при создании команд: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_basic_commands()
