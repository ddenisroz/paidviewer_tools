# 🚀 Деплой TTS-приложения

Это руководство поможет развернуть TTS-приложение в продакшене с архитектурой:
- **TTS Service**: локально через Cloudflare Tunnel
- **Frontend + Bot Service**: на VPS

## 📋 Предварительные требования

### На локальном ПК:
- Python 3.11+
- Cloudflared
- Стабильное интернет-соединение

### На VPS:
- Ubuntu 20.04+ (рекомендуется)
- Docker и Docker Compose
- Nginx (встроен в контейнер)
- Минимум 2GB RAM, 20GB SSD

## 🏗️ Архитектура

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Локальный ПК  │    │       VPS        │    │   Пользователи  │
│                 │    │                  │    │                 │
│  TTS Service    │◄──►│  Bot Service     │◄──►│   Frontend      │
│  :8002         │    │  :8001           │    │   :80/443       │
│                 │    │                  │    │                 │
│  Cloudflare     │    │  Docker          │    │   Browser       │
│  Tunnel         │    │  Containers      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔧 Настройка TTS Service (локально)

### 1. Установка Cloudflare Tunnel

```bash
# Windows
# Скачайте с https://github.com/cloudflare/cloudflared/releases

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### 2. Настройка туннеля

```bash
# Запустите скрипт настройки
chmod +x setup-cloudflare-tunnel.sh
./setup-cloudflare-tunnel.sh
```

### 3. Запуск TTS Service

```bash
cd tts_service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### 4. Запуск туннеля

```bash
# В отдельном терминале
cloudflared tunnel run your-tunnel-name
```

## 🌐 Настройка VPS

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Загрузка проекта

```bash
git clone https://github.com/yourusername/tts-project.git
cd tts-project
git checkout main
```

### 3. Настройка переменных окружения

```bash
# Основные настройки
cp env.production.example .env.production
nano .env.production

# Frontend настройки  
cp frontend/env.production.example frontend/.env.production
nano frontend/.env.production
```

### 4. SSL сертификаты

#### Вариант A: Let's Encrypt (рекомендуется)

```bash
# Установка certbot
sudo apt install certbot

# Получение сертификата
sudo certbot certonly --standalone -d yourdomain.com

# Копирование в проект
mkdir -p ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/*
```

#### Вариант B: Самоподписанный (для тестов)

```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=yourdomain.com"
```

### 5. Деплой

```bash
chmod +x deploy.sh
./deploy.sh
```

## 🔒 Безопасность

### Обязательные настройки:

1. **Firewall**:
```bash
sudo ufw enable
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
```

2. **Fail2Ban**:
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

3. **Обновление паролей**:
- Смените `SECRET_KEY` в `.env.production`
- Используйте сложные пароли для всех сервисов
- Настройте регулярные бэкапы БД

### Rate Limiting:
- API: 10 req/s
- Auth: 1 req/s
- Настраивается в `nginx.conf`

## 📊 Мониторинг

### Логи:
```bash
# Все сервисы
docker-compose -f docker-compose.prod.yml logs -f

# Конкретный сервис
docker-compose -f docker-compose.prod.yml logs -f bot_service
```

### Статус:
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Ресурсы:
```bash
docker stats
```

## 🔄 Обновление

```bash
git pull origin main
./deploy.sh
```

## 🆘 Troubleshooting

### TTS Service не доступен:
1. Проверьте запущен ли локальный сервис: `curl http://localhost:8002/health`
2. Проверьте Cloudflare tunnel: `cloudflared tunnel list`
3. Проверьте DNS записи

### Frontend не загружается:
1. Проверьте контейнер: `docker logs tts_frontend_prod`
2. Проверьте SSL сертификаты
3. Проверьте конфигурацию nginx

### Bot Service ошибки:
1. Проверьте переменные окружения
2. Проверьте логи: `docker logs tts_bot_service_prod`
3. Проверьте доступность БД

## 💰 Стоимость

### VPS (рекомендации):
- **DigitalOcean**: $5-10/месяц (Basic Droplet)
- **Hetzner**: €3-5/месяц (CX11/CX21)
- **Vultr**: $5-10/месяц (Regular Performance)
- **Oracle Cloud**: Бесплатно (Always Free Tier)

### Cloudflare:
- Tunnel: **Бесплатно**
- DNS: **Бесплатно**
- SSL: **Бесплатно**

### Итого: **$0-10/месяц** 🎉
