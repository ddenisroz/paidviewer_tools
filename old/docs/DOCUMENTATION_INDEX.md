# 📚 Индекс Документации TTS_TTV_0.02

**Последнее обновление:** 31 октября 2025  
**Версия:** 1.0.0

---

## 🎯 Главные документы

### 📊 Статус проекта
- **`CURRENT_STATUS.md`** - текущий статус проекта, последние изменения
- **`CHANGELOG.md`** - история всех изменений по сессиям
- **`README.md`** - описание проекта, quick start

### 🛠️ Руководства разработчика
- **`DEVELOPER_GUIDE.md`** - гайд для новых разработчиков
- **`ARCHITECTURE_GUIDE.md`** - общая архитектура системы
- **`LLM_DEVELOPMENT_RULES.md`** - правила для AI-ассистентов
- **`DO_NOT_TOUCH.md`** - критические файлы, не трогать!

### 🚀 Deployment
- **`DEPLOYMENT.md`** - инструкции по деплою
- **`QUICK_START.md`** - быстрый старт для разработки

---

## 🎤 TTS (Text-to-Speech)

### Основные документы
- **`TTS_ARCHITECTURE.md`** - архитектура TTS системы
- **`TTS_INTEGRATION_STATUS.md`** - статус интеграции TTS
- **`VOICE_UPLOAD_UNIFIED.md`** - единая система загрузки голосов

### Специализированные документы
- **`TTS_CHANNEL_POINTS_MODE.md`** - TTS за баллы канала (Twitch/VK)
- **`LOCAL_TTS_INTEGRATION.md`** - интеграция локального F5-TTS
- **`SESSION_26_LOCAL_TTS_INTEGRATION.md`** - детали сессии 26

### Голоса (Voices)
- **`VOICE_SEPARATION_GLOBAL_USER.md`** - разделение глобальных и пользовательских голосов
- **`ADMIN_VOICE_MANAGEMENT.md`** - управление голосами в админ-панели

---

## 🛡️ Безопасность и Модерация

### Блокировки
- **`ADMIN_BLOCKING_AND_WHITELIST.md`** - система блокировок и whitelist
- **`SECURITY_LOGIC.md`** - логика безопасности
- **`SECURITY_ANALYSIS.md`** - анализ безопасности

### Аккаунты
- **`ACCOUNT_DELETION_SYSTEM.md`** - система удаления аккаунтов (GDPR)
- **`GUEST_MODE_SUPPORT.md`** - поддержка гостевого режима

---

## 🎁 Channel Points & Rewards

### Twitch
- **`CHANNEL_POINTS_AUDIT.md`** - аудит системы Channel Points

### VK Live
- **`VK_CHANNEL_POINTS_IMPLEMENTATION.md`** - реализация наград VK Live
- **`vk/VK_LIVE_DEMANDS_AND_REWARDS.md`** - документация VK Live Demands

---

## 🎮 Команды и Интеграции

### Команды
- **`UNIFIED_COMMANDS.md`** - унифицированная система команд
- **`ROLES_REFERENCE.md`** - роли и права доступа

### Платформы
- **`VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md`** - VK username и админы
- **`CATEGORY_MAPPING_GUIDE.md`** - маппинг категорий (Twitch ↔ VK)

---

## 🔧 Админ-Панель

### Основные документы
- **`ADMIN_PANEL_ENDPOINTS_STATUS.md`** - статус всех endpoints админки

### Специализированные
- **`ADMIN_VOICE_MANAGEMENT.md`** - управление голосами
- **`ADMIN_BLOCKING_AND_WHITELIST.md`** - блокировки и whitelist

---

## 💻 Техническая документация

### Архитектура
- **`ARCHITECTURE_GUIDE.md`** - общая архитектура
- **`TOKEN_SYSTEM_UNIFIED.md`** - система токенов (OAuth)
- **`CACHING_SYSTEM.md`** - система кэширования

### WebSocket
- **`SHARED_WEBSOCKET.md`** - shared WebSocket с Leader Election

### Code Quality
- **`CODE_AUDIT_REPORT_2025_10_29.md`** - аудит кода (29.10.2025)
- **`CODE_REVIEW_SENIOR_ENGINEER.md`** - code review от senior engineer
- **`MEMORY_LEAKS_AUDIT.md`** - аудит утечек памяти

### Миграции и Рефакторинг
- **`API_CLIENT_MIGRATION.md`** - миграция на единый API client

---

## 📊 Аудит и Отчёты

### Аудиты
- **`DOCUMENTATION_AUDIT_REPORT.md`** - аудит документации (31.10.2025)
- **`CODE_AUDIT_REPORT_2025_10_29.md`** - аудит кода (29.10.2025)
- **`CHANNEL_POINTS_AUDIT.md`** - аудит Channel Points
- **`MEMORY_LEAKS_AUDIT.md`** - аудит утечек памяти

### Статусы
- **`TTS_INTEGRATION_STATUS.md`** - статус TTS
- **`ADMIN_PANEL_ENDPOINTS_STATUS.md`** - статус endpoints

---

## 🚑 Troubleshooting

### Гайды по исправлению
- **`QUICK_FIX_GUIDE.md`** - быстрые фиксы типичных проблем

---

## 📅 Исторические документы

### Сессии разработки
- **`SESSION_26_LOCAL_TTS_INTEGRATION.md`** - сессия 26 (Local TTS)

---

## 🗂️ Структура документации

```
docs/
├── 📊 Статус и История
│   ├── CURRENT_STATUS.md          # Главный документ статуса
│   ├── CHANGELOG.md               # История изменений
│   └── README.md                  # Описание проекта
│
├── 🎤 TTS
│   ├── TTS_ARCHITECTURE.md
│   ├── TTS_INTEGRATION_STATUS.md
│   ├── TTS_CHANNEL_POINTS_MODE.md
│   ├── LOCAL_TTS_INTEGRATION.md
│   ├── VOICE_UPLOAD_UNIFIED.md
│   ├── VOICE_SEPARATION_GLOBAL_USER.md
│   └── ADMIN_VOICE_MANAGEMENT.md
│
├── 🛡️ Безопасность
│   ├── ADMIN_BLOCKING_AND_WHITELIST.md
│   ├── SECURITY_LOGIC.md
│   ├── SECURITY_ANALYSIS.md
│   ├── ACCOUNT_DELETION_SYSTEM.md
│   └── GUEST_MODE_SUPPORT.md
│
├── 🎁 Channel Points
│   ├── CHANNEL_POINTS_AUDIT.md
│   └── VK_CHANNEL_POINTS_IMPLEMENTATION.md
│
├── 🎮 Команды и Интеграции
│   ├── UNIFIED_COMMANDS.md
│   ├── ROLES_REFERENCE.md
│   ├── VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md
│   └── CATEGORY_MAPPING_GUIDE.md
│
├── 🔧 Админ-Панель
│   ├── ADMIN_PANEL_ENDPOINTS_STATUS.md
│   ├── ADMIN_VOICE_MANAGEMENT.md
│   └── ADMIN_BLOCKING_AND_WHITELIST.md
│
├── 💻 Техническая документация
│   ├── ARCHITECTURE_GUIDE.md
│   ├── TOKEN_SYSTEM_UNIFIED.md
│   ├── CACHING_SYSTEM.md
│   ├── SHARED_WEBSOCKET.md
│   ├── CODE_AUDIT_REPORT_2025_10_29.md
│   ├── CODE_REVIEW_SENIOR_ENGINEER.md
│   ├── MEMORY_LEAKS_AUDIT.md
│   └── API_CLIENT_MIGRATION.md
│
├── 📊 Аудит и Отчёты
│   ├── DOCUMENTATION_AUDIT_REPORT.md
│   ├── CODE_AUDIT_REPORT_2025_10_29.md
│   ├── CHANNEL_POINTS_AUDIT.md
│   └── MEMORY_LEAKS_AUDIT.md
│
├── 🚑 Troubleshooting
│   └── QUICK_FIX_GUIDE.md
│
├── 🛠️ Разработка
│   ├── DEVELOPER_GUIDE.md
│   ├── LLM_DEVELOPMENT_RULES.md
│   ├── DO_NOT_TOUCH.md
│   ├── DEPLOYMENT.md
│   └── QUICK_START.md
│
└── 📅 Исторические
    └── SESSION_26_LOCAL_TTS_INTEGRATION.md
```

---

## 🔍 Как найти нужную информацию

### По функциональности:

**TTS (Text-to-Speech):**
- Общая архитектура → `TTS_ARCHITECTURE.md`
- Загрузка голосов → `VOICE_UPLOAD_UNIFIED.md`
- TTS за баллы → `TTS_CHANNEL_POINTS_MODE.md`
- Локальный TTS → `LOCAL_TTS_INTEGRATION.md`
- Глобальные vs пользовательские голоса → `VOICE_SEPARATION_GLOBAL_USER.md`

**Безопасность:**
- Блокировки → `ADMIN_BLOCKING_AND_WHITELIST.md`
- Удаление аккаунтов → `ACCOUNT_DELETION_SYSTEM.md`
- Гостевой режим → `GUEST_MODE_SUPPORT.md`

**Channel Points:**
- Twitch → `CHANNEL_POINTS_AUDIT.md`
- VK Live → `VK_CHANNEL_POINTS_IMPLEMENTATION.md`

**Команды:**
- Система команд → `UNIFIED_COMMANDS.md`
- Роли → `ROLES_REFERENCE.md`

**Админка:**
- Endpoints → `ADMIN_PANEL_ENDPOINTS_STATUS.md`
- Управление голосами → `ADMIN_VOICE_MANAGEMENT.md`

**Разработка:**
- Быстрый старт → `QUICK_START.md`
- Деплой → `DEPLOYMENT.md`
- Правила → `LLM_DEVELOPMENT_RULES.md`

---

## 📝 Поддержка документации

### Правила обновления:

1. **После каждой сессии разработки:**
   - ✅ Обновить `CURRENT_STATUS.md`
   - ✅ Добавить запись в `CHANGELOG.md`
   - ✅ Создать специализированный документ если нужно

2. **При добавлении новой фичи:**
   - ✅ Документировать в соответствующем разделе
   - ✅ Обновить INDEX (этот файл)

3. **При изменении существующей функциональности:**
   - ✅ Обновить соответствующий документ
   - ✅ Отметить изменения в `CHANGELOG.md`

4. **При обнаружении устаревшей информации:**
   - ✅ Немедленно обновить
   - ✅ Проверить связанные документы

### Стандарты документации:

- **Заголовки:** Использовать эмодзи для категорий
- **Даты:** Формат "31 октября 2025"
- **Версии:** Semantic Versioning (1.0.0)
- **Статус:** ✅ Работает / ⚠️ Частично / ❌ Не работает
- **Code blocks:** Указывать язык (python, javascript, bash)
- **Ссылки:** Использовать относительные пути

---

## 🎯 Быстрый доступ

### Для новых разработчиков:
1. Начать с `README.md`
2. Прочитать `DEVELOPER_GUIDE.md`
3. Изучить `ARCHITECTURE_GUIDE.md`
4. Прочитать `DO_NOT_TOUCH.md` ⚠️

### Для AI-ассистентов:
1. Начать с `CURRENT_STATUS.md`
2. Прочитать `LLM_DEVELOPMENT_RULES.md`
3. Использовать `DOCUMENTATION_INDEX.md` для навигации

### Для администраторов:
1. `ADMIN_PANEL_ENDPOINTS_STATUS.md` - все endpoints
2. `ADMIN_VOICE_MANAGEMENT.md` - управление голосами
3. `ADMIN_BLOCKING_AND_WHITELIST.md` - модерация

---

**Индекс составлен:** 31 октября 2025  
**Версия:** 1.0.0  
**Всего документов:** 38


