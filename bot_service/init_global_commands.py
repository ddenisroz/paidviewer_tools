#!/usr/bin/env python3
"""
Скрипт для инициализации ГЛОБАЛЬНЫХ базовых команд (user_id=NULL)
Эти команды доступны ВСЕМ пользователям на ВСЕХ каналах
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.database import get_db, BotCommand
from datetime import datetime

def init_global_commands():
    """Инициализировать глобальные базовые команды"""
    db = next(get_db())
    
    try:
        # Глобальные базовые команды (доступны всем)
        # Категории: "Медиа и интерактивность", "TTS ИИ озвучка", "Управление трансляцией", "Общее"
        global_commands = [
            {
                "command_name": "help",
                "description": "Показать список всех доступных команд",
                "tags": "Общее",
                "allowed_roles": "all",
                "cooldown_seconds": 5
            },
            {
                "command_name": "sr",
                "description": "Заказать YouTube видео (song request)",
                "tags": "Медиа и интерактивность",
                "allowed_roles": "all",
                "cooldown_seconds": 10
            },
            {
                "command_name": "skip",
                "description": "Пропустить текущее видео",
                "tags": "Медиа и интерактивность",
                "allowed_roles": "moderator,broadcaster",
                "cooldown_seconds": 5
            },
            {
                "command_name": "clear",
                "description": "Очистить очередь видео",
                "tags": "Медиа и интерактивность",
                "allowed_roles": "moderator,broadcaster",
                "cooldown_seconds": 10
            },
            {
                "command_name": "queue",
                "description": "Показать очередь YouTube видео",
                "tags": "Медиа и интерактивность",
                "allowed_roles": "all",
                "cooldown_seconds": 10
            },
            {
                "command_name": "title",
                "description": "Сменить название стрима",
                "tags": "Управление трансляцией",
                "allowed_roles": "broadcaster",
                "cooldown_seconds": 30
            },
            {
                "command_name": "game",
                "description": "Сменить категорию/игру стрима",
                "tags": "Управление трансляцией",
                "allowed_roles": "broadcaster",
                "cooldown_seconds": 30
            },
            {
                "command_name": "ttsvolume",
                "description": "Настроить громкость TTS (0-100)",
                "tags": "TTS ИИ озвучка",
                "allowed_roles": "broadcaster,moderator",
                "cooldown_seconds": 5
            },
            {
                "command_name": "ytvolume",
                "description": "Настроить громкость YouTube (0-100)",
                "tags": "Медиа и интерактивность",
                "allowed_roles": "broadcaster,moderator",
                "cooldown_seconds": 5
            },
            {
                "command_name": "voice",
                "description": "Выбрать голос для TTS",
                "tags": "TTS ИИ озвучка",
                "allowed_roles": "all",
                "cooldown_seconds": 30
            },
            {
                "command_name": "randomvoice",
                "description": "Выбрать случайный голос для TTS",
                "tags": "TTS ИИ озвучка",
                "allowed_roles": "all",
                "cooldown_seconds": 30
            },
            {
                "command_name": "mute",
                "description": "Отключить TTS для пользователя",
                "tags": "TTS ИИ озвучка",
                "allowed_roles": "broadcaster,moderator",
                "cooldown_seconds": 5
            },
            {
                "command_name": "unmute",
                "description": "Включить TTS для пользователя",
                "tags": "TTS ИИ озвучка",
                "allowed_roles": "broadcaster,moderator",
                "cooldown_seconds": 5
            },
            {
                "command_name": "analyze",
                "description": "Отправить историю сообщений на анализ ИИ",
                "tags": "Общее",
                "allowed_roles": "broadcaster",
                "cooldown_seconds": 60
            }
        ]
        
        commands_created = 0
        commands_updated = 0
        
        for cmd_data in global_commands:
            # Проверяем, есть ли уже такая глобальная команда
            existing = db.query(BotCommand).filter(
                BotCommand.user_id == None,
                BotCommand.command_type == 'global',
                BotCommand.command_name == cmd_data["command_name"]
            ).first()
            
            if existing:
                # Обновляем описание и другие параметры
                existing.description = cmd_data["description"]
                existing.tags = cmd_data["tags"]
                existing.allowed_roles = cmd_data["allowed_roles"]
                existing.cooldown_seconds = cmd_data["cooldown_seconds"]
                existing.updated_at = datetime.utcnow()
                commands_updated += 1
                print(f"  🔄 Updated: !{cmd_data['command_name']}")
            else:
                # Создаем новую глобальную команду
                command = BotCommand(
                    user_id=None,  # NULL для глобальных команд
                    channel_name=None,  # NULL для глобальных команд
                    command_name=cmd_data["command_name"],
                    command_type="global",
                    description=cmd_data["description"],
                    response_text="",
                    is_enabled=True,
                    platforms="twitch,vk",
                    allowed_roles=cmd_data["allowed_roles"],
                    cooldown_seconds=cmd_data["cooldown_seconds"],
                    tags=cmd_data["tags"],
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                
                db.add(command)
                commands_created += 1
                print(f"  ✅ Created: !{cmd_data['command_name']}")
        
        db.commit()
        print(f"\n✅ ИТОГО:")
        print(f"   - Создано: {commands_created} команд")
        print(f"   - Обновлено: {commands_updated} команд")
        print(f"   - Всего глобальных команд: {commands_created + commands_updated}")
        
    except Exception as e:
        print(f"❌ Ошибка при создании глобальных команд: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("🌐 ИНИЦИАЛИЗАЦИЯ ГЛОБАЛЬНЫХ КОМАНД")
    print("=" * 60)
    print()
    init_global_commands()
    print()
    print("=" * 60)

