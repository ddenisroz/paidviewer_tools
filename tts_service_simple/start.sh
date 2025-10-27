#!/bin/bash
# TTS F5 Simple - Linux/Mac Launcher

echo ""
echo "========================================"
echo " TTS F5 Simple - Локальный TTS сервис"
echo "========================================"
echo ""

# Проверка Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python3 не найден! Установите Python 3.8+"
    exit 1
fi

# Создание папки логов
mkdir -p logs

echo "[INFO] Запуск TTS сервиса..."
echo ""

# Запуск сервиса
python3 main.py

