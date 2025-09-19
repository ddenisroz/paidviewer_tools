# 🚀 Запуск через PowerShell

## 📁 Автоматический запуск

```powershell
# Запустите PowerShell скрипт
.\start_microservices.ps1
```

## 🔧 Ручной запуск (PowerShell команды)

### Вариант 1: С активацией venv в каждом терминале

```powershell
# Терминал 1 - TTS сервис
cd tts-service
if (Test-Path "..\.venv\Scripts\Activate.ps1") { ..\.venv\Scripts\Activate.ps1 }
python main.py

# Терминал 2 - Bot сервис  
cd bot-service
if (Test-Path "..\.venv\Scripts\Activate.ps1") { ..\.venv\Scripts\Activate.ps1 }
python main.py

# Терминал 3 - Frontend
cd frontend
npm run dev
```

### Вариант 2: Предварительная активация venv

```powershell
# В корневой папке активируем .venv
.\.venv\Scripts\Activate.ps1

# Затем в разных терминалах:
# Терминал 1
cd tts-service; python main.py

# Терминал 2  
cd bot-service; python main.py

# Терминал 3
cd frontend; npm run dev
```

### Вариант 3: Одной командой (параллельный запуск)

```powershell
# Запуск всех сервисов одновременно
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd tts-service; if (Test-Path '..\.venv\Scripts\Activate.ps1') { ..\.venv\Scripts\Activate.ps1 }; python main.py"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd bot-service; if (Test-Path '..\.venv\Scripts\Activate.ps1') { ..\.venv\Scripts\Activate.ps1 }; python main.py"  

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"
```

## 🔍 Проверка статуса

```powershell
# Проверка портов
netstat -an | findstr ":8000 :8001 :5173"

# Проверка процессов Python
Get-Process python

# Проверка здоровья сервисов
Invoke-WebRequest -Uri "http://localhost:8001/health" | ConvertFrom-Json
Invoke-WebRequest -Uri "http://localhost:8000/health" | ConvertFrom-Json
```

## 🛑 Остановка всех сервисов

```powershell
# Остановить все процессы Python
Get-Process python | Stop-Process -Force

# Остановить Node.js (если нужно)
Get-Process node | Stop-Process -Force
```

## ⚠️ Решение проблем

### Если не активируется venv:
```powershell
# Разрешить выполнение скриптов (одноразово)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Затем повторить запуск
.\.venv\Scripts\Activate.ps1
```

### Если порт занят:
```powershell
# Найти процесс на порту 8001
netstat -ano | findstr :8001

# Завершить процесс по PID (замените XXXX на реальный PID)
taskkill /PID XXXX /F
```
