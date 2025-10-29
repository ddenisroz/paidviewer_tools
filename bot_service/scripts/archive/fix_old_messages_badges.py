#!/usr/bin/env python3
"""
Скрипт для добавления badges к старым сообщениям в базе данных
"""
import sys
import os
import json
from datetime import datetime

# Добавляем корневую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from core.database import ChatMessage, User
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Используем ту же БД что и основное приложение
DATABASE_URL = "sqlite:///./data/app_data.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def fix_broadcaster_badges():
    """
    Добавляет broadcaster badge к сообщениям от владельца канала
    """
    db = SessionLocal()
    try:
        # Получаем всех пользователей
        users = db.query(User).all()
        
        total_updated = 0
        
        for user in users:
            # Twitch канал
            if user.twitch_username:
                logger.info(f"Processing Twitch channel: {user.twitch_username}")
                
                # Находим сообщения от владельца канала без badges
                messages = db.query(ChatMessage).filter(
                    ChatMessage.user_id == user.id,
                    ChatMessage.platform == 'twitch',
                    func.lower(ChatMessage.channel_name) == user.twitch_username.lower(),
                    func.lower(ChatMessage.author_username) == user.twitch_username.lower(),
                    ChatMessage.badges == None  # Только сообщения без badges
                ).all()
                
                logger.info(f"  Found {len(messages)} broadcaster messages without badges")
                
                for msg in messages:
                    # Добавляем broadcaster badge и role
                    msg.badges = json.dumps(['broadcaster/1'])
                    msg.role = 'broadcaster'
                    total_updated += 1
                
                db.commit()
                logger.info(f"  ✅ Updated {len(messages)} messages for {user.twitch_username}")
            
            # VK канал
            if user.vk_username:
                logger.info(f"Processing VK channel: {user.vk_username}")
                
                # Находим сообщения от владельца канала без role
                messages = db.query(ChatMessage).filter(
                    ChatMessage.user_id == user.id,
                    ChatMessage.platform == 'vk',
                    func.lower(ChatMessage.channel_name) == user.vk_username.lower(),
                    func.lower(ChatMessage.author_username) == user.vk_username.lower(),
                    ChatMessage.role == None  # Только сообщения без role
                ).all()
                
                logger.info(f"  Found {len(messages)} owner messages without role")
                
                for msg in messages:
                    # Для VK нет badges, но есть role
                    msg.role = 'owner'
                    total_updated += 1
                
                db.commit()
                logger.info(f"  ✅ Updated {len(messages)} messages for {user.vk_username}")
        
        logger.info(f"\n🎉 TOTAL UPDATED: {total_updated} messages")
        
        # Статистика
        total_messages = db.query(ChatMessage).count()
        messages_with_badges = db.query(ChatMessage).filter(ChatMessage.badges != None).count()
        messages_with_role = db.query(ChatMessage).filter(ChatMessage.role != None).count()
        
        logger.info(f"\n📊 STATISTICS:")
        logger.info(f"  Total messages: {total_messages}")
        logger.info(f"  Messages with badges: {messages_with_badges}")
        logger.info(f"  Messages with role: {messages_with_role}")
        logger.info(f"  Messages without badges: {total_messages - messages_with_badges}")
        
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("🚀 Starting badges fix script...")
    logger.info("=" * 60)
    fix_broadcaster_badges()
    logger.info("=" * 60)
    logger.info("✅ Script completed!")

