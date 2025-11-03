# 🎙️ TTS_TTV_0.02 - Text-to-Speech Bot для Twitch & VK Live

![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)
![Version](https://img.shields.io/badge/version-0.02-blue)
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

# 4️⃣ Запусти
npm run dev          # Frontend (localhost:5173)
cd bot_service && python main.py  # Backend (localhost:8000)
```

**Полный гайд:** 📖 [QUICK_START.md](docs/QUICK_START.md)

---

## ✨ Основные возможности

| Функция | Статус | Описание |
|---------|--------|----------|
| 🎙️ Google TTS | ✅ | Облачный синтез через Google Cloud |
| 🎧 Локальный F5-TTS | ✅ | Локальный синтез через F5-TTS |
| 📺 Twitch | ✅ | OAuth, чат, команды, бейджи |
| 🌐 VK Live | ✅ | OAuth, чат, команды, баллы |
| 📊 YouTube | ✅ | Очередь заказов, плеер |
| 💰 Баллы канала | ✅ | Twitch + VK Live награды |
| 🎁 Drops система | ✅ | Lootbox, streak, donation |
| 💝 DonationAlerts | ✅ | Автоматическая интеграция |
| 👤 Гостевой режим | ✅ | Просмотр без авторизации |
| 🎮 Кастомные команды | ✅ | Глобальные, override, custom |
| 👥 Админ панель | ✅ | Управление пользователями |
| 🔌 OBS виджеты | ✅ | Chat, TTS, YouTube, Drops |

---

## 📚 Документация

### Для обычных пользователей
- 🎯 **[Быстрый старт](docs/QUICK_START.md)**
- 📖 **[Текущий статус](docs/CURRENT_STATUS.md)**

### Для разработчиков
- 📖 **[Архитектура](docs/ARCHITECTURE_OVERVIEW.md)**
- 👨‍💻 **[Руководство](docs/DEVELOPER_GUIDE.md)**
- 📜 **[Changelog](docs/CHANGELOG.md)**

### Для AI-агентов
- ⚠️ **[Правила разработки](docs/LLM_DEVELOPMENT_RULES.md)** ОБЯЗАТЕЛЬНО!
- 🚨 **[Текущий статус](docs/CURRENT_STATUS.md)**
- 🚫 **[Не трогать](docs/DO_NOT_TOUCH.md)**

**Полный индекс:** 📚 [docs/README.md](docs/README.md)

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
└── tts_service_simple/   # TTS микросервис
```

---

## 🔐 Безопасность

- ✅ **Rate Limiting** - защита от DDoS
- ✅ **Input Sanitization** - XSS/SQLi защита
- ✅ **JWT + OAuth2** - безопасная аутентификация
- ✅ **CSRF Protection** - защита от атак
- ✅ **Retry Logic** - устойчивость к сетевому отказу
- ✅ **Encryption** - токены зашифрованы в БД

---

## 📊 Технологии

**Backend:** Python, FastAPI, SQLAlchemy, Alembic  
**Frontend:** React 19, Vite, Tailwind CSS, shadcn/ui, React Query  
**Database:** SQLite (dev) / PostgreSQL (prod)  
**TTS:** Google Cloud TTS / F5-TTS  
**WebSocket:** FastAPI WebSocket (SharedWebSocket)  
**Интеграции:** Twitch, VK Live, YouTube, DonationAlerts

---

## 📝 История версий

| Дата | Версия | Основные изменения |
|------|--------|-------------------|
| Nov 3, 2025 | 0.02 | Code quality cleanup, production ready |
| Nov 1, 2025 | 0.01 | Security improvements |
| Oct 31, 2025 | 0.9.5 | Comprehensive audit |

**Полный changelog:** 📖 [CHANGELOG.md](docs/CHANGELOG.md)

---

## 📄 Лицензия

MIT License - Свободен для использования и модификации

---

**Последнее обновление:** 3 ноября 2025 | **Версия:** 0.02
