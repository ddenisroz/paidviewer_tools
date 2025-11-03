@echo off
REM TTS F5 Simple - Windows Launcher
title TTS F5 Simple

echo.
echo ========================================
echo  TTS F5 Simple - Локальный TTS сервис
echo ========================================
echo.

REM Проверка Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python не найден! Установите Python 3.8+ и добавьте в PATH
    pause
    exit /b 1
)

REM Проверка зависимостей
if not exist "logs" mkdir logs

echo [INFO] Запуск TTS сервиса...
echo.

REM Запуск сервиса
python main.py

pause

