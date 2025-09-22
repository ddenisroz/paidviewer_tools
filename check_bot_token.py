#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
from dotenv import load_dotenv

# Загружаем .env файл
load_dotenv()

# Проверяем переменные окружения
bot_token = os.getenv('TWITCH_BOT_TOKEN')
print(f'TWITCH_BOT_TOKEN: {"установлен" if bot_token else "НЕ УСТАНОВЛЕН"}')

if bot_token:
    print(f'Токен начинается с: {bot_token[:10]}...')
else:
    print('Токен бота не найден в переменных окружения!')

# Проверяем другие важные переменные
client_id = os.getenv('TWITCH_CLIENT_ID')
print(f'TWITCH_CLIENT_ID: {"установлен" if client_id else "НЕ УСТАНОВЛЕН"}')

secret_key = os.getenv('SECRET_KEY')
print(f'SECRET_KEY: {"установлен" if secret_key else "НЕ УСТАНОВЛЕН"}')
