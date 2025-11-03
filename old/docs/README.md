# 📚 Документация TTS_TTV_0.02

**Последнее обновление:** 27 октября 2025 (Session 10)  
**Версия проекта:** 0.9.5

---

## 🚀 Быстрый старт

### Для обычных пользователей (стримеры):
1. 📖 **[README.md](../README.md)** - Главный README (5 минут)
2. 🚀 **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Шпаргалка (команды, типичные задачи)
3. 🎯 **[QUICK_START.md](QUICK_START.md)** - Полная установка

### Для новых разработчиков:
1. 📖 **[README.md](../README.md)** - Обзор проекта
2. 🏗️ **[ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md)** - Архитектура (1 страница)
3. 👨‍💻 **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Паттерны и примеры
4. 🏗️ **[ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md)** - Полная архитектура

### Для AI-агентов (Claude, GPT):
1. ⚠️ **[LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md)** - ОБЯЗАТЕЛЬНО! Правила
2. 🚨 **[CURRENT_STATUS.md](CURRENT_STATUS.md)** - ЧТО РАБОТАЕТ/НЕ РАБОТАЕТ
3. 🚫 **[DO_NOT_TOUCH.md](DO_NOT_TOUCH.md)** - Что нельзя менять

---

## 📚 Организованная структура

### ⚡ БЫСТРЫЕ (для тех кто спешит)
| Файл | Время | Для кого |
|------|-------|----------|
| **[README.md](../README.md)** | 5 мин | Все |
| **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** | 10 мин | Разработчики |
| **[ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md)** | 10 мин | Разработчики |

### 🔴 КРИТИЧЕСКИЕ (обязательно читать!)
| Файл | Для кого |
|------|----------|
| **[DO_NOT_TOUCH.md](DO_NOT_TOUCH.md)** | AI-агенты, разработчики |
| **[CURRENT_STATUS.md](CURRENT_STATUS.md)** | AI-агенты, разработчики |
| **[LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md)** | AI-агенты |

### 🟢 ОСНОВНАЯ ДОКУМЕНТАЦИЯ
| Файл | Описание |
|------|----------|
| [QUICK_START.md](QUICK_START.md) | Установка и первый запуск |
| [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md) | Полная архитектура |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Паттерны, best practices |
| [CHANGELOG.md](CHANGELOG.md) | История изменений |

### 🔵 СПЕЦИАЛИЗИРОВАННЫЕ (по темам)

| Файл | Тема |
|------|------|
| [TTS_ARCHITECTURE.md](TTS_ARCHITECTURE.md) | 🎙️ Cloud (gTTS) + Local (F5-TTS) |
| [SHARED_WEBSOCKET.md](SHARED_WEBSOCKET.md) | 🔌 WebSocket Leader Election + Singleton |
| [CODE_REVIEW_SENIOR_ENGINEER.md](CODE_REVIEW_SENIOR_ENGINEER.md) | 👨‍💼 Senior-level code review |
| [MEMORY_LEAKS_AUDIT.md](MEMORY_LEAKS_AUDIT.md) | 🧠 Memory leaks audit (EXCELLENT) |
| [API_CLIENT_MIGRATION.md](API_CLIENT_MIGRATION.md) | 📡 Unified ApiClient guide |
| [CACHING_SYSTEM.md](CACHING_SYSTEM.md) | 💾 Multi-tab cache sync |
| [ACCOUNT_DELETION_SYSTEM.md](ACCOUNT_DELETION_SYSTEM.md) | 🗑️ 3-Level deletion system + GDPR |
| [GUEST_MODE_SUPPORT.md](GUEST_MODE_SUPPORT.md) | 👤 Гостевой режим |
| [TOKEN_SYSTEM_UNIFIED.md](TOKEN_SYSTEM_UNIFIED.md) | 🔐 TokenManager система |
| [UNIFIED_COMMANDS.md](UNIFIED_COMMANDS.md) | 🎮 Команды !game, !title |
| [ROLES_REFERENCE.md](ROLES_REFERENCE.md) | 👥 Twitch/VK роли |
| [CATEGORY_MAPPING_GUIDE.md](CATEGORY_MAPPING_GUIDE.md) | 🗺️ Кросс-платформенные категории |
| [VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md](VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md) | 📝 VK username логика |

### 🟡 Deployment и безопасность

| Файл | Описание |
|------|----------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Деплой на production |
| [SECURITY_LOGIC.md](SECURITY_LOGIC.md) | Авторизация и безопасность |

### 📂 VK Live API Reference

Документация VK Live API находится в папке `vk/` (19 файлов).

---

## 🎯 Сценарии использования

### 🚀 Я хочу запустить проект

```bash
# 1. Читай
📖 QUICK_START.md

# 2. Настраивай
cp env.example .env
# Заполни Twitch/VK токены

# 3. Запускай
npm run dev  # В корне проекта
```

### 🛠️ Я хочу добавить фичу

```
1. ⚠️  ОБЯЗАТЕЛЬНО: CURRENT_STATUS.md (проверь что работает)
2. ⚠️  ОБЯЗАТЕЛЬНО: LLM_DEVELOPMENT_RULES.md (правила)
3. 📖 ARCHITECTURE_GUIDE.md (архитектура)
4. 👨‍💻 DEVELOPER_GUIDE.md (примеры кода)
```

### 🐛 Я хочу исправить баг

```
1. ⚠️  CURRENT_STATUS.md (убедись что это баг)
2. 🔧 QUICK_FIX_GUIDE.md (типичные проблемы)
3. 🤖 LLM_DEVELOPMENT_RULES.md (как правильно фиксить)
```

### 🤖 Я AI-агент

```
🚨 ШАГ 1: CURRENT_STATUS.md (ЧТО РАБОТАЕТ)
🚨 ШАГ 2: LLM_DEVELOPMENT_RULES.md (ПРАВИЛА)
📖 ШАГ 3: Если нужно - другие документы
```

**⚠️ НЕ НАЧИНАЙ РАБОТУ БЕЗ ПРОЧТЕНИЯ ЭТИХ ДВУХ ФАЙЛОВ!**

---

## 📊 Статус проекта

### ✅ Работает
- Multi-platform (Twitch, VK Live, DonationAlerts)
- TTS (Cloud gTTS + Local F5-TTS)
- ChatBox (OBS overlay)
- Commands (global, override, custom)
- Category Mapping (!game, !title)
- Guest Mode
- Caching + Multi-tab sync
- Shared WebSocket (Singleton)

### 🚧 В разработке
- Миграция на ApiClient (частично)
- JSDoc для критических функций

### ❌ Известные ограничения
- YouTube API key (не реализовано)
- F5-TTS требует GPU для скорости

---

## 🔍 Поиск информации

| Вопрос | Файл |
|--------|------|
| Как работает TTS? | TTS_ARCHITECTURE.md |
| Как работает ChatBox? | CURRENT_STATUS.md → ChatBox |
| Как работают токены? | TOKEN_SYSTEM_UNIFIED.md |
| Как работают команды? | UNIFIED_COMMANDS.md |
| Как работает WebSocket? | SHARED_WEBSOCKET.md |
| VK API не работает? | vk/Методы.*.md |

---

## 📦 Технический стек

**Backend:** FastAPI, SQLAlchemy, Alembic, WebSocket, TwitchIO, vk-api  
**Frontend:** React 18, Vite, Tailwind, shadcn/ui, Axios  
**TTS:** gTTS (cloud), F5-TTS (local, GPU)

---

## 📜 История версий

| Дата | Session | Основные изменения |
|------|---------|-------------------|
| 27.10.2025 | Session 9 | WebSocket Singleton, ErrorBoundary, ApiClient |
| 26.10.2025 | Session 8 | OAuth fixes, Token refresh |
| 24-25.10.2025 | Session 7 | TokenManager, UX improvements |

**Полная история:** [CHANGELOG.md](CHANGELOG.md)

---

## 🤝 Contributing

**Перед изменением кода:**
1. Прочитай [LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md)
2. Проверь [CURRENT_STATUS.md](CURRENT_STATUS.md)
3. Следуй паттернам из [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)

**После изменений:**
1. Обнови [CURRENT_STATUS.md](CURRENT_STATUS.md)
2. Добавь запись в [CHANGELOG.md](CHANGELOG.md)

---

**Версия документации:** 4.0  
**Статус:** ✅ Актуально  
**Последнее обновление:** 27 октября 2025 (Session 9)
