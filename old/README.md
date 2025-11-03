# 🎙️ TTS_TTV_0.02 - Text-to-Speech Bot для Twitch & VK Live

![Status](https://img.shields.io/badge/status-stable-brightgreen)
![Version](https://img.shields.io/badge/version-0.9.5-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**TTS бот для стримеров** с поддержкой облачного (Google TTS) и локального (F5-TTS) синтеза, YouTube заказов, системы баллов и интеграции с донатами.

---

## ⚡ Быстрый старт (5 минут)

```bash
# 1️⃣ Клонируй и перейди
git clone <repo>
cd TTS_TTV_0.02

# 2️⃣ Установи зависимости
npm install           # Frontend
cd bot_service && pip install -r requirements.txt  # Backend

# 3️⃣ Настрой .env
cp .env.example .env
# Заполни: TWITCH_TOKEN, VK_TOKEN, GOOGLE_CLOUD_KEY, DATABASE_URL

# 3.5️⃣ Настрой PostgreSQL (если еще не установлен)
# Windows: .\bot_service\scripts\setup_postgresql.ps1
# Или установите PostgreSQL вручную и создайте базу данных

# 4️⃣ Запусти
npm run dev          # Frontend (localhost:5173)
cd bot_service && python main.py  # Backend (localhost:8000)
```

**Полный гайд:** 📖 [QUICK_START.md](docs/QUICK_START.md)

---

## 📚 Документация

### Для обычных пользователей (стримеры)
- 🎯 **[Как начать работу](docs/QUICK_START.md)**
- ⚙️ **[Параметры и настройки](docs/FEATURES_GUIDE.md)** (если есть)
- 🐛 **[Частые проблемы](docs/TROUBLESHOOTING.md)** (если есть)

### Для разработчиков
- 📖 **[Архитектура системы](docs/ARCHITECTURE_GUIDE.md)**
- 👨‍💻 **[Руководство разработчика](docs/DEVELOPER_GUIDE.md)**
- 🚨 **[Что работает / Что сломано](docs/CURRENT_STATUS.md)**

### Для AI-агентов (Claude, GPT и т.д.)
- 🤖 **[Правила разработки для AI](docs/LLM_DEVELOPMENT_RULES.md)** ⚠️ Обязательно!
- 🚫 **[Что НЕ менять](docs/DO_NOT_TOUCH.md)** ⚠️ Критично!

### Полный индекс
👉 **[Все документы](docs/README.md)**

---

## ✨ Основные возможности

| Функция | Статус |
|---------|--------|
| 🎙️ Google TTS синтез | ✅ Ready |
| 🎧 Локальный F5-TTS | ✅ Ready |
| 📺 Twitch интеграция | ✅ Ready |
| 🌐 VK Live интеграция | ✅ Ready |
| 📊 YouTube заказы | ✅ Ready |
| 💰 Система баллов канала | ✅ Ready |
| 🎁 Drops система (лутбоксы) | ✅ Ready |
| 💝 Интеграция DonationAlerts | ✅ Ready |
| 👤 Гостевой режим | ✅ Ready |
| 🎮 Custom команды | ✅ Ready |

---

## 🏗️ Структура проекта

```
├── bot_service/          # Backend (FastAPI)
│   ├── api/              # API endpoints
│   ├── bots/             # Twitch/VK бот логика
│   ├── services/         # Бизнес логика
│   ├── core/             # Конфиг, БД, auth
│   └── validators/       # Input validation
│
├── frontend/             # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/   # React компоненты
│   │   ├── pages/        # Страницы
│   │   ├── context/      # Context API
│   │   ├── services/     # API клиенты
│   │   └── utils/        # Утилиты
│   └── public/
│
├── docs/                 # Документация
└── tts_service_simple/   # TTS микросервис (опциональный)
```

---

## 🚀 Команды для разработки

```bash
# Frontend
npm run dev              # Запуск dev сервера (localhost:5173)
npm run build            # Production build
npm run preview          # Preview build
npm run fix-logs         # Заменить console.log на logger

# Backend
python main.py           # Запуск сервера
python scripts/clear_database.py clear  # Очистить БД
python scripts/init_db.py               # Инициализировать БД
```

---

## 🔐 Переменные окружения

Создай файл `.env` в корне (или в `bot_service/`):

```env
# Twitch
TWITCH_BOT_TOKEN=<token>
TWITCH_CLIENT_ID=<id>
TWITCH_CLIENT_SECRET=<secret>

# VK Live
VK_TOKEN=<token>

# Google Cloud TTS
GOOGLE_CLOUD_KEY=<path/to/key.json>

# DonationAlerts
DONATIONALERTS_TOKEN=<token>

# Local TTS (F5-TTS)
USE_LOCAL_TTS=false

# Environment
ENVIRONMENT=development  # development или production
```

---

## 🤝 Как помочь проекту

- 🐛 **Найти баг?** Открой issue с описанием
- 💡 **Идея?** Предложи в discussions
- 👨‍💻 **Хочешь кодить?** Прочитай [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)

---

## 📊 Статистика

- **Backend:** Python, FastAPI, SQLAlchemy
- **Frontend:** React 19, Vite, Tailwind CSS, shadcn/ui
- **Database:** SQLite (dev) / PostgreSQL (prod)
- **Интеграции:** Twitch, VK, YouTube, Google Cloud TTS
- **Lines of Code:** ~50,000+ (backend + frontend)

---

## 📝 История

- **v0.9.5** (Nov 1, 2025) - Security & Performance improvements
  - ✅ 501 console.log → logger replacements
  - ✅ Input sanitization (XSS/SQL injection protection)
  - ✅ Database utilities centralization
  - ✅ CSP hardening (nonce-based)
  
- **v0.9.0** - Comprehensive audit & fixes
- **v0.8.0** - Guest mode support
- **v0.7.0** - YouTube integration

**Полный changelog:** 📖 [CHANGELOG.md](docs/CHANGELOG.md)

---

## 🛟 Поддержка

- 💬 **Проблема?** Смотри [Troubleshooting](docs/TROUBLESHOOTING.md)
- 📖 **Документация** - [docs/README.md](docs/README.md)
- 🤖 **AI помощь?** Используй [LLM_DEVELOPMENT_RULES.md](docs/LLM_DEVELOPMENT_RULES.md)

---

## 📄 Лицензия

MIT License - Свободен для использования и модификации

---

**Последнее обновление:** November 1, 2025 | **Версия:** 0.9.5
