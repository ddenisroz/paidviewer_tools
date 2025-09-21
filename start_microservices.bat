@echo off
cd /d "%~dp0"
echo ========================================
echo   TTS_TTV - МИКРОСЕРВИСНАЯ АРХИТЕКТУРА  
echo ========================================
echo.

echo 📋 Проверка .env файла...
if not exist .env (
    echo ❌ Файл .env не найден!
    echo 💡 Скопируйте test.env.example в .env и заполните токены
    pause
    exit
)

echo ✅ .env файл найден
echo.

echo 🔧 Активация venv...
if exist venv\Scripts\activate (
    call venv\Scripts\activate
    echo ✅ Virtual environment активирован
) else (
    echo ⚠️ venv не найден, используем системный Python
)
echo.

echo 🚀 Запуск микросервисов...
echo.

echo [1/3] 🎤 Запуск TTS сервиса (с исправленным чтением референсного текста)...
start "TTS Service" cmd /k "cd tts-service && python main.py"

timeout /t 3 /nobreak >nul

echo [2/3] 🤖 Запуск Bot сервиса...
start "Bot Service" cmd /k "cd bot-service && python main.py"

timeout /t 3 /nobreak >nul

echo [3/3] 🌐 Запуск Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ✅ Все микросервисы запущены!
echo.
echo 📊 Адреса сервисов:
echo 🌐 Frontend:  http://localhost:5173
echo 🤖 Bot API:   http://localhost:8000/docs  
echo 🎤 TTS API:   http://localhost:8001/docs
echo 📈 Health:    http://localhost:8001/health
echo.
echo 📁 Логи:
echo 📄 Bot Service:  logs/bot_service.log
echo 📄 TTS Service:  logs/tts_service.log
echo 🔍 Просмотр:     view_logs.bat
echo.
echo 💡 Тестирование:
echo 1. Откройте http://localhost:5173
echo 2. Проверьте http://localhost:8001/health
echo 3. Просмотрите логи: view_logs.bat
echo.
echo ⚠️  Убедитесь что порты 5173, 8000, 8001 свободны!
echo.
pause
