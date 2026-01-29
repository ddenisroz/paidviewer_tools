# Deployment Guide - TTS_TTV_0.03

**Последнее обновление:** 14 ноября 2025  
**Версия:** 0.03

---

## Содержание

1. [Обзор](#обзор)
2. [Deployment Scenarios](#deployment-scenarios)
3. [Environment Configuration](#environment-configuration)
4. [TTS Service: Advanced vs Simple](#tts-service-advanced-vs-simple)
5. [Distributed Deployment](#distributed-deployment)
6. [Cloudflare Tunnel Setup](#cloudflare-tunnel-setup)
7. [Docker Deployment](#docker-deployment)
8. [Migration Script](#migration-script)
9. [Troubleshooting](#troubleshooting)

---

## Обзор

TTS_TTV_0.03 поддерживает гибкие deployment сценарии:

- **All-in-one:** Все сервисы на одной машине (dev/small production)
- **Distributed:** TTS на локальной машине с GPU, Bot Service на удаленном сервере
- **Cloud:** Все сервисы в облаке с Google TTS

**Ключевые особенности:**
- ✅ Полная конфигурация через `.env` файлы
- ✅ Никаких хардкодов в коде
- ✅ Автоматическая миграция с `migrate.sh`/`migrate.ps1`
- ✅ Docker Compose для всех сценариев
- ✅ Cloudflare Tunnel для безопасного доступа

---

## Deployment Scenarios

### Scenario 1: Advanced Setup (F5-TTS на GPU)

**Идеально для:** Shared hosting, несколько стримеров, высокое качество TTS

**Архитектура:**
```
┌─────────────────────────────────────┐
│ Machine 1 (Local PC with GPU)       │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ TTS Service (F5-TTS)         │  │
│  │ - Port: 8001                 │  │
│  │ - GPU: CUDA required         │  │
│  │ - Voices: Centralized        │  │
│  └──────────────────────────────┘  │
│              ↓                      │
│  ┌──────────────────────────────┐  │
│  │ Cloudflare Tunnel            │  │
│  │ - Exposes: tts.yourdomain.com│  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
              ↓ HTTPS
┌─────────────────────────────────────┐
│ Machine 2 (Remote Server)           │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ Bot Service                  │  │
│  │ - Port: 8000                 │  │
│  │ - TTS_SERVICE_URL:           │  │
│  │   https://tts.yourdomain.com │  │
│  └──────────────────────────────┘  │
│              ↓                      │
│  ┌──────────────────────────────┐  │
│  │ Frontend (Nginx)             │  │
│  │ - Port: 80, 443              │  │
│  └──────────────────────────────┘  │
│              ↓                      │
│  ┌──────────────────────────────┐  │
│  │ PostgreSQL                   │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Преимущества:**
- Высокое качество TTS (F5-TTS)
- Централизованное управление голосами
- Один TTS Service для нескольких Bot Services
- Безопасный доступ через Cloudflare Tunnel

**Требования:**
- Machine 1: GPU (CUDA), 8GB+ VRAM, Python 3.10+
- Machine 2: 2GB+ RAM, Docker

---

### Scenario 2: Simple Setup (Personal TTS)

**Идеально для:** Личное использование, приватность, один стример

**Архитектура:**
```
┌─────────────────────────────────────┐
│ Machine 1 (User's PC with GPU)      │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ TTS Service Simple (F5-TTS)  │  │
│  │ - Port: 8001                 │  │
│  │ - GPU: CUDA required         │  │
│  │ - Voices: Local storage      │  │
│  └──────────────────────────────┘  │
│              ↓                      │
│  ┌──────────────────────────────┐  │
│  │ Cloudflare Tunnel            │  │
│  │ - Exposes: tts.yourdomain.com│  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
              ↓ HTTPS
┌─────────────────────────────────────┐
│ Machine 2 (Remote Server)           │
│  (Same as Scenario 1)               │
└─────────────────────────────────────┘
```

**Преимущества:**
- Полная приватность (голоса хранятся локально)
- Простая настройка
- Тот же F5-TTS движок
- Скачивание глобальных голосов из репозитория

**Требования:**
- Machine 1: GPU (CUDA), 8GB+ VRAM, Python 3.10+
- Machine 2: 2GB+ RAM, Docker

---

### Scenario 3: Cloud Setup (Google TTS)

**Идеально для:** Быстрый старт, нет GPU, облачный deployment

**Архитектура:**
```
┌─────────────────────────────────────┐
│ Machine 1 (Cloud Server)            │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ Bot Service                  │  │
│  │ - TTS: Google Cloud TTS      │  │
│  └──────────────────────────────┘  │
│              ↓                      │
│  ┌──────────────────────────────┐  │
│  │ Frontend (Nginx)             │  │
│  └──────────────────────────────┘  │
│              ↓                      │
│  ┌──────────────────────────────┐  │
│  │ PostgreSQL                   │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Преимущества:**
- Не требует GPU
- Простой deployment
- Масштабируемость
- Надежность Google Cloud

**Требования:**
- Machine 1: 2GB+ RAM, Docker
- Google Cloud TTS API key

---

## Environment Configuration

### Bot Service (.env)

Создайте `bot_service/.env`:

```bash
# === DATABASE ===
DATABASE_URL=sqlite:///./data/bot_service.db  # Dev
# DATABASE_URL=postgresql://user:pass@host:5432/dbname  # Prod

# === SERVICES ===
BOT_SERVICE_HOST=0.0.0.0
BOT_SERVICE_PORT=8000
TTS_SERVICE_URL=http://localhost:8001  # Local
# TTS_SERVICE_URL=https://tts.yourdomain.com  # Cloudflare Tunnel
FRONTEND_URL=http://localhost:5173     # Dev
# FRONTEND_URL=https://yourdomain.com  # Prod

# === SECURITY ===
# Generate with: openssl rand -hex 32
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret

# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=your-fernet-key

# === OAUTH CREDENTIALS ===
TWITCH_CLIENT_ID=your-twitch-client-id
TWITCH_CLIENT_SECRET=your-twitch-secret
TWITCH_REDIRECT_URI=http://localhost:8000/auth/twitch/callback

VK_CLIENT_ID=your-vk-client-id
VK_CLIENT_SECRET=your-vk-secret
VK_REDIRECT_URI=http://localhost:8000/auth/vk/callback

DONATION_ALERTS_CLIENT_ID=your-da-client-id
DONATION_ALERTS_CLIENT_SECRET=your-da-secret
DONATION_ALERTS_REDIRECT_URI=http://localhost:8000/auth/donationalerts/callback

# === EXTERNAL APIS (Optional) ===
GOOGLE_TTS_API_KEY=your-google-tts-key
YOUTUBE_API_KEY=your-youtube-key

# === RATE LIMITING ===
RATE_LIMIT_DEFAULT=60/minute
RATE_LIMIT_LOGIN=5/15minute
RATE_LIMIT_TTS=30/minute

# === LOGGING ===
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_FILE=logs/bot_service.log
```

### TTS Service (.env)

Создайте `tts_service/.env`:

```bash
# === SERVICE ===
TTS_SERVICE_HOST=0.0.0.0
TTS_SERVICE_PORT=8001
BOT_SERVICE_URL=http://localhost:8000

# === TTS ENGINE SELECTION ===
TTS_ENGINE=f5  # Options: f5, google

# === F5-TTS CONFIGURATION ===
F5_TTS_MODEL_PATH=./models/f5_tts
F5_TTS_DEVICE=cuda  # cuda, cpu, or mps (Mac)
F5_TTS_MAX_WORKERS=2

# === GOOGLE TTS CONFIGURATION ===
GOOGLE_TTS_API_KEY=your-google-tts-key
GOOGLE_TTS_LANGUAGE=ru-RU

# === CLOUDFLARE TUNNEL (Production) ===
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token

# === SECURITY ===
ALLOWED_ORIGINS=http://localhost:8000,http://localhost:5173

# === LOGGING ===
LOG_LEVEL=INFO
LOG_FILE=logs/tts_service.log
```

### TTS Service Simple (.env)

Создайте `tts_service_simple/.env`:

```bash
# === SERVICE ===
TTS_SIMPLE_HOST=0.0.0.0
TTS_SIMPLE_PORT=8001

# === F5-TTS CONFIGURATION ===
F5_TTS_MODEL_PATH=./models/f5_tts
F5_TTS_DEVICE=cuda
F5_TTS_MAX_WORKERS=2

# === VOICE STORAGE ===
VOICES_DIR=./voices

# === GLOBAL VOICE REPOSITORY ===
GLOBAL_VOICES_REPO=https://tts-voices.example.com

# === AUDIO SETTINGS ===
SAMPLE_RATE=22050
AUDIO_FORMAT=wav

# === SECURITY ===
ALLOWED_ORIGINS=http://localhost:8000

# === CLOUDFLARE TUNNEL ===
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token

# === LOGGING ===
LOG_LEVEL=INFO
LOG_FILE=logs/tts_simple.log
```

### Frontend (.env)

Создайте `frontend/.env`:

```bash
# === API ENDPOINTS ===
VITE_API_URL=http://localhost:8000
VITE_TTS_SERVICE_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8000/ws

# Production:
# VITE_API_URL=https://api.yourdomain.com
# VITE_TTS_SERVICE_URL=https://tts.yourdomain.com
# VITE_WS_URL=wss://api.yourdomain.com/ws

# === FEATURES ===
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=true
```

---

## TTS Service: Advanced vs Simple

### Сравнение

| Аспект | TTS Service (Advanced) | TTS Service Simple |
|--------|------------------------|-------------------|
| **Назначение** | Централизованный TTS для нескольких пользователей | Персональный TTS для одного пользователя |
| **Движок** | F5-TTS | F5-TTS (тот же) |
| **Требования** | GPU (CUDA), 8GB+ VRAM | GPU (CUDA), 8GB+ VRAM |
| **Хранение голосов** | `/app/voices/` (все пользователи) | `/app/voices/user_{user_id}/` (изолированно) |
| **Глобальные голоса** | Админ загружает, доступны всем | Пользователь скачивает из репозитория |
| **Deployment** | Один инстанс для всех Bot Services | Один инстанс на пользователя |
| **Use Case** | Shared hosting, несколько стримеров | Личное использование, приватность |
| **API** | Идентичный | Идентичный |

### Unified API

Оба сервиса имеют одинаковый API:

```
POST /synthesize
  Request: { text, voice, speed, volume, language }
  Response: { audio_url, duration, format }

GET /voices
  Response: { voices: [...] }

GET /health
  Response: { status, engine_info }

POST /voices/upload
  Request: multipart/form-data
  Response: { voice_id, voice_name }

GET /voices/global
  Response: { voices: [...] }

POST /voices/download/{voice_id}
  Downloads global voice
```

**Bot Service не знает разницы** - он просто отправляет запросы на `TTS_SERVICE_URL` из `.env`

---

## Distributed Deployment

### Machine 1: TTS Service (GPU)

#### 1. Установка зависимостей

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3.11 python3-pip nvidia-cuda-toolkit

# Проверка GPU
nvidia-smi
```

#### 2. Клонирование и настройка

```bash
git clone <repo>
cd TTS_TTV_0.03

# Только TTS Service
cd tts_service  # или tts_service_simple
pip install -r requirements.txt

# Настройка .env
cp .env.example .env
nano .env  # Заполните настройки
```

#### 3. Запуск TTS Service

```bash
# Development
python main.py

# Production (Docker)
docker-compose -f docker-compose.tts-advanced.yml up -d
# или
docker-compose -f docker-compose.tts-simple.yml up -d
```

#### 4. Проверка

```bash
curl http://localhost:8001/health
# Должен вернуть: {"status": "ok", "engine": "f5-tts"}
```

---

### Machine 2: Bot Service + Frontend

#### 1. Установка Docker

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install docker.io docker-compose

# Проверка
docker --version
docker-compose --version
```

#### 2. Клонирование и настройка

```bash
git clone <repo>
cd TTS_TTV_0.03

# Миграция
./migrate.sh  # Linux/Mac
# или
migrate.ps1   # Windows

# Настройка .env
cd bot_service
nano .env  # Заполните TTS_SERVICE_URL=https://tts.yourdomain.com
```

#### 3. Запуск Bot Service

```bash
# Development
cd bot_service
python main.py

# Production (Docker)
docker-compose -f docker-compose.bot.yml up -d
```

#### 4. Запуск Frontend

```bash
# Development
cd frontend
npm install
npm run dev

# Production (Docker)
# Frontend включен в docker-compose.bot.yml
```

#### 5. Проверка

```bash
# Bot Service
curl http://localhost:8000/docs

# Frontend
curl http://localhost:5173
# или
curl http://yourdomain.com
```

---

## Cloudflare Tunnel Setup

### 1. Установка cloudflared

```bash
# Ubuntu/Debian
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Windows
# Скачайте с https://github.com/cloudflare/cloudflared/releases
```

### 2. Аутентификация

```bash
cloudflared tunnel login
# Откроется браузер для авторизации
```

### 3. Создание туннеля

```bash
cloudflared tunnel create tts-service
# Сохраните tunnel ID и credentials file path
```

### 4. Конфигурация

Создайте `cloudflared-config.yml`:

```yaml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: tts.yourdomain.com
    service: http://localhost:8001
  - service: http_status:404
```

### 5. DNS настройка

```bash
cloudflared tunnel route dns tts-service tts.yourdomain.com
```

### 6. Запуск туннеля

```bash
# Development
cloudflared tunnel --config cloudflared-config.yml run

# Production (systemd)
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Production (Docker)
# Включен в docker-compose.tts-advanced.yml и docker-compose.tts-simple.yml
```

### 7. Проверка

```bash
curl https://tts.yourdomain.com/health
# Должен вернуть: {"status": "ok"}
```

---

## Docker Deployment

### Development

```bash
# Все сервисы локально
docker-compose -f docker-compose.dev.yml up -d

# Проверка
docker-compose -f docker-compose.dev.yml ps
docker-compose -f docker-compose.dev.yml logs -f
```

### Production: TTS Service (Advanced)

```bash
# Machine 1 (GPU)
docker-compose -f docker-compose.tts-advanced.yml up -d

# Проверка
docker ps
docker logs tts_service
docker logs cloudflared
```

### Production: TTS Service Simple

```bash
# Machine 1 (User PC)
docker-compose -f docker-compose.tts-simple.yml up -d

# Проверка
docker ps
docker logs tts_service_simple
```

### Production: Bot Service

```bash
# Machine 2 (Remote)
docker-compose -f docker-compose.bot.yml up -d

# Проверка
docker ps
docker logs bot_service
docker logs frontend
docker logs postgres
```

### Управление

```bash
# Остановка
docker-compose -f <file> down

# Перезапуск
docker-compose -f <file> restart

# Логи
docker-compose -f <file> logs -f <service>

# Обновление
git pull
docker-compose -f <file> build
docker-compose -f <file> up -d
```

---

## Migration Script

### Linux/Mac

```bash
#!/bin/bash
# migrate.sh

echo "=== TTS Bot Migration Script ==="

# 1. Copy .env.example to .env
if [ ! -f bot_service/.env ]; then
    cp bot_service/.env.example bot_service/.env
    echo "✓ Created bot_service/.env"
fi

if [ ! -f tts_service/.env ]; then
    cp tts_service/.env.example tts_service/.env
    echo "✓ Created tts_service/.env"
fi

if [ ! -f frontend/.env ]; then
    cp frontend/.env.example frontend/.env
    echo "✓ Created frontend/.env"
fi

# 2. Generate secrets
if grep -q "your-secret-key-here" bot_service/.env; then
    echo "Generating secrets..."
    SECRET_KEY=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    
    sed -i "s/your-secret-key-here/$SECRET_KEY/" bot_service/.env
    sed -i "s/your-jwt-secret/$JWT_SECRET/" bot_service/.env
    sed -i "s/your-fernet-key/$ENCRYPTION_KEY/" bot_service/.env
    echo "✓ Generated security keys"
fi

# 3. Create directories
mkdir -p data logs models voices audio
echo "✓ Created directories"

# 4. Install dependencies
echo "Installing dependencies..."
cd bot_service && pip install -r requirements.txt
cd ../frontend && npm install
echo "✓ Installed dependencies"

# 5. Run migrations
echo "Running database migrations..."
cd ../bot_service && alembic upgrade head
echo "✓ Database ready"

echo ""
echo "=== Migration Complete ==="
echo "Next steps:"
echo "1. Edit .env files with your OAuth credentials"
echo "2. For TTS service: Configure Cloudflare Tunnel"
echo "3. Run: docker-compose up -d"
```

### Windows

```powershell
# migrate.ps1

Write-Host "=== TTS Bot Migration Script ===" -ForegroundColor Green

# 1. Copy .env.example to .env
if (-not (Test-Path "bot_service\.env")) {
    Copy-Item "bot_service\.env.example" "bot_service\.env"
    Write-Host "✓ Created bot_service\.env" -ForegroundColor Green
}

# ... (similar to bash script)

Write-Host ""
Write-Host "=== Migration Complete ===" -ForegroundColor Green
```

---

## Troubleshooting

### TTS Service не запускается

**Проблема:** `CUDA not available`

**Решение:**
```bash
# Проверка GPU
nvidia-smi

# Установка CUDA
sudo apt install nvidia-cuda-toolkit

# Проверка PyTorch
python -c "import torch; print(torch.cuda.is_available())"
```

---

### Bot Service не подключается к TTS

**Проблема:** `Connection refused to TTS_SERVICE_URL`

**Решение:**
```bash
# Проверка TTS Service
curl http://localhost:8001/health

# Проверка Cloudflare Tunnel
curl https://tts.yourdomain.com/health

# Проверка .env
cat bot_service/.env | grep TTS_SERVICE_URL
```

---

### WebSocket не подключается

**Проблема:** `WebSocket connection failed`

**Решение:**
```bash
# Проверка CORS
# В bot_service/.env:
FRONTEND_URL=http://localhost:5173  # Dev
# FRONTEND_URL=https://yourdomain.com  # Prod

# Проверка WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:8000/ws
```

---

### Database migration failed

**Проблема:** `alembic upgrade head` fails

**Решение:**
```bash
# Проверка DATABASE_URL
cat bot_service/.env | grep DATABASE_URL

# Создание директории
mkdir -p data

# Пересоздание БД
cd bot_service
rm -f data/bot_service.db
alembic upgrade head
```

---

### Docker container crashes

**Проблема:** Container exits immediately

**Решение:**
```bash
# Проверка логов
docker logs <container_name>

# Проверка .env
docker exec <container_name> env | grep -i secret

# Пересоздание
docker-compose down
docker-compose up -d
docker-compose logs -f
```

---

### Cloudflare Tunnel не работает

**Проблема:** `tunnel not found`

**Решение:**
```bash
# Проверка туннеля
cloudflared tunnel list

# Проверка конфигурации
cat cloudflared-config.yml

# Проверка DNS
nslookup tts.yourdomain.com

# Перезапуск
sudo systemctl restart cloudflared
```

---

## Дополнительные ресурсы

- **[README.md](../README.md)** - Главный README
- **[QUICKSTART.md](../QUICKSTART.md)** - Быстрый старт
- **[CURRENT_STATUS.md](CURRENT_STATUS.md)** - Текущий статус
- **[ARCHITECTURE_GUIDE.md](architecture/ARCHITECTURE_GUIDE.md)** - Архитектура
- **[DEVELOPER_GUIDE.md](../guides/DEVELOPER_GUIDE.md)** - Руководство разработчика

---

**Статус:** Production Ready - Optimized  
**Последнее обновление:** 14 ноября 2025  
**Версия:** 0.03
