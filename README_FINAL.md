# 🎤 TTS Bot - Готовый к продакшену

**Полнофункциональный TTS бот с интеграцией Twitch, VK Live и YouTube**

[![Production Ready](https://img.shields.io/badge/Production-Ready-green.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)]()
[![Security](https://img.shields.io/badge/Security-Hardened-red.svg)]()

## 🚀 Быстрый старт

### Для разработки:
```bash
npm run setup      # Автоматическая настройка
npm run dev:frontend && npm run dev:bot && npm run dev:tts
```

### Для продакшена:
```bash
cp env.production.example .env.production  # Заполнить настройки
./deploy.sh        # Автоматический деплой
```

## 🏗️ Архитектура

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Локальный ПК  │    │       VPS        │    │   Пользователи  │
│                 │    │                  │    │                 │
│  TTS Service    │◄──►│  Bot Service     │◄──►│   Frontend      │
│  :8002         │    │  :8001           │    │   :80/443       │
│                 │    │                  │    │                 │
│  Cloudflare     │    │  Docker          │    │   HTTPS + SSL   │
│  Tunnel         │    │  Nginx + SSL     │    │   Rate Limiting │
│  (Бесплатно)    │    │  ($5-10/мес)     │    │   Security      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## ✨ Функции

### 🎤 TTS (Text-to-Speech)
- **Русский TTS** с F5-TTS и Vocos
- **Пользовательские голоса** 
- **Очередь сообщений**
- **OBS интеграция**
- **Управление громкостью**

### 📺 Twitch интеграция
- **Чат бот** с командами
- **Система ролей** (Broadcaster, Moderator, VIP, Subscriber)
- **Кулдауны команд**
- **Автоматическое подключение**

### 🔴 VK Live интеграция  
- **Чат бот** для VK Live
- **Система баллов**
- **Модерация чата**
- **WebSocket подключение**

### 🎵 YouTube интеграция
- **Очередь видео**
- **Синхронизированный плеер**
- **Глобальный мини-плеер**
- **Управление очередью**

### 🎮 Система баллов
- **Автоматическое начисление**
- **Команды с тратой баллов**
- **Аукционы и ставки**
- **Статистика пользователей**

### 👑 Админ панель
- **Управление пользователями**
- **Настройка команд**
- **Мониторинг системы**
- **Аналитика**

## 🔒 Безопасность

- ✅ **HTTPS принудительно**
- ✅ **Rate limiting** (10 req/s API, 1 req/s auth)
- ✅ **Security headers**
- ✅ **SQL injection защита**
- ✅ **XSS защита**
- ✅ **CORS настройки**
- ✅ **Firewall готовые правила**

## 📋 Требования

### Локальный ПК (для TTS):
- Python 3.11+
- 4GB RAM
- Стабильный интернет

### VPS:
- Ubuntu 20.04+
- 2GB RAM, 20GB SSD
- Docker + Docker Compose

## 🛠️ Установка и настройка

Подробные инструкции в:
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Полный деплой
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Разработка
- **[QUICK_COMMANDS.md](QUICK_COMMANDS.md)** - Быстрые команды

## 💰 Стоимость

| Компонент | Стоимость | Альтернатива |
|-----------|-----------|--------------|
| **VPS** | $5-10/мес | Oracle Cloud (бесплатно) |
| **Cloudflare Tunnel** | Бесплатно | - |
| **SSL сертификат** | Бесплатно (Let's Encrypt) | - |
| **Домен** | $10-15/год | Freenom (бесплатно) |
| **Итого** | **$0-15/мес** | **$0** с бесплатными опциями |

## 🔧 Быстрые команды

```bash
# Разработка
npm run dev:frontend    # Frontend
npm run dev:bot         # Bot Service  
npm run dev:tts         # TTS Service

# Продакшен
npm run deploy          # Деплой
npm run logs            # Логи
npm run restart         # Перезапуск

# Обновление
npm run update          # Автоматическое обновление

# Очистка
./cleanup.sh            # Очистка от мусора
```

## 📊 Мониторинг

### Проверка здоровья:
- **Frontend**: https://yourdomain.com
- **API**: https://yourdomain.com/api/health
- **TTS**: https://your-tunnel.trycloudflare.com/health

### Логи:
```bash
npm run logs            # Все логи
npm run logs:bot        # Bot Service
npm run logs:frontend   # Frontend
```

## 🎯 Готовые интеграции

### Настроенные платформы:
- **Twitch** - OAuth авторизация
- **VK Live** - WebSocket подключение  
- **YouTube** - API v3 интеграция
- **DonationAlerts** - Поддержка донатов

### Готовые команды:
- `!tts <текст>` - Озвучка текста
- `!skip` - Пропуск TTS
- `!volume <0-100>` - Громкость
- `!balance` - Баланс баллов
- `!youtube <url>` - Добавить видео
- И многие другие...

## 🚀 Что дальше?

1. **Настройте интеграции** следуя гайдам
2. **Кастомизируйте под себя** (голоса, команды, дизайн)
3. **Мониторьте производительность**
4. **Обновляйте регулярно** через `npm run update`

## 📚 Документация

- [DEPLOYMENT.md](DEPLOYMENT.md) - Деплой
- [DEVELOPMENT.md](DEVELOPMENT.md) - Разработка  
- [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) - Чеклист
- [CLEANUP_GUIDE.md](CLEANUP_GUIDE.md) - Очистка
- [VK_LIVE_COMMANDS_GUIDE.md](VK_LIVE_COMMANDS_GUIDE.md) - VK команды

## 🤝 Поддержка

Проект готов к продакшену и активному использованию!

**Особенности:**
- ⚡ Быстрое развертывание
- 🔄 Простые обновления  
- 🛡️ Высокая безопасность
- 📈 Масштабируемость
- 💡 Подробная документация

---

**Создано с ❤️ для стримеров и их сообществ**
