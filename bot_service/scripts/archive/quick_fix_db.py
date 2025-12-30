#!/usr/bin/env python3
"""Быстрое исправление базы данных"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.database import get_db, User, UserSettings

db = next(get_db())

# Обновляем UserSettings
user = db.query(User).filter(User.id == 1).first()
if user:
    settings = db.query(UserSettings).filter(UserSettings.user_id == 1).first()
    if settings:
        channel_name = user.twitch_username or user.vk_username
        if channel_name and not settings.channel_name:
            settings.channel_name = channel_name.lower()
            db.commit()
            print(f"[OK] Updated UserSettings.channel_name = {settings.channel_name}")
        elif settings.channel_name:
            print(f"[OK] UserSettings.channel_name already set: {settings.channel_name}")
        else:
            print(f"[ERROR] No username found for user {user.id}")
    else:
        print(f"[ERROR] No UserSettings for user {user.id}")
else:
    print("[ERROR] User not found")

db.close()

