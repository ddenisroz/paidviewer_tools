# Индекс Документации TTS_TTV_0.02

**Последнее обновление:** 17 ноября 2025  
**Версия:** 4.0.0

**Note:** For legacy documentation (v0.02 pre-refactoring), see [../legacy/LEGACY_CONTENTS.md](../legacy/LEGACY_CONTENTS.md)

---

## Главные документы

### Статус проекта
- **`CURRENT_STATUS.md`** - текущий статус проекта, последние изменения
- **`CHANGELOG.md`** - история всех изменений по сессиям
- **`README.md`** (root) - описание проекта, quick start
- **`reports/`** - технические отчеты и анализы (см. reports/README.md)
- **`archive/reports/`** - архивные отчеты и чеклисты

### Руководства разработчика
- **`DEVELOPER_GUIDE.md`** - гайд для новых разработчиков
- **`architecture/ARCHITECTURE_GUIDE.md`** - общая архитектура системы
- **`LLM_DEVELOPMENT_RULES.md`** - правила для AI-ассистентов
- **`DO_NOT_TOUCH.md`** - критические файлы, не трогать!

### Deployment & Setup
- **`DEPLOYMENT.md`** - инструкции по деплою
- **`guides/QUICK_START.md`** - быстрый старт для разработки
- **`guides/QUICK_SETUP.md`** - быстрая настройка
- **`guides/SETUP_GUIDE.md`** - полное руководство по настройке

---

## TTS (Text-to-Speech)

### Основные документы
- **`architecture/TTS_ARCHITECTURE.md`** - архитектура TTS системы
- **`VOICE_UPLOAD_UNIFIED.md`** - единая система загрузки голосов

### Специализированные документы
- **`TTS_CHANNEL_POINTS_MODE.md`** - TTS за баллы канала (Twitch/VK)
- **`LOCAL_TTS_INTEGRATION.md`** - интеграция локального F5-TTS

### Голоса (Voices)
- **`VOICE_SEPARATION_GLOBAL_USER.md`** - разделение глобальных и пользовательских голосов
- **`ADMIN_VOICE_MANAGEMENT.md`** - управление голосами в админ-панели

---

## Авторизация и Безопасность

### Авторизация
- **`AUTH_TYPE_SYSTEM.md`** - система типов авторизации (full/basic)
- **`TOKEN_SYSTEM_UNIFIED.md`** - унифицированная система токенов

### Блокировки
- **`ADMIN_BLOCKING_AND_WHITELIST.md`** - система блокировок и whitelist
- **`SECURITY_LOGIC.md`** - логика безопасности

### Аккаунты
- **`ACCOUNT_DELETION_SYSTEM.md`** - система удаления аккаунтов (GDPR)

---

## Channel Points & Rewards

### VK Live
- **`VK_CHANNEL_POINTS_IMPLEMENTATION.md`** - реализация наград VK Live
- **`vk/VK_LIVE_DEMANDS_AND_REWARDS.md`** - документация VK Live Demands

### Drops (Лутбоксы)
- **`DROPS_SYSTEM.md`** - полное руководство по системе Drops (лутбоксы, стрики, донаты, награды)

---

## Команды и Интеграции

### Команды
- **`UNIFIED_COMMANDS.md`** - унифицированная система команд
- **`ROLES_REFERENCE.md`** - роли и права доступа

### Платформы
- **`VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md`** - VK username и админы
- **`CATEGORY_MAPPING_GUIDE.md`** - маппинг категорий (Twitch ↔ VK)

---

## Админ-Панель

### Основные документы
- **`api/ADMIN_PANEL_ENDPOINTS_STATUS.md`** - статус всех endpoints админки

### Специализированные
- **`ADMIN_VOICE_MANAGEMENT.md`** - управление голосами
- **`ADMIN_BLOCKING_AND_WHITELIST.md`** - блокировки и whitelist

---

## Техническая документация

### Архитектура
- **`architecture/ARCHITECTURE_GUIDE.md`** - общая архитектура
- **`architecture/VALIDATION_SYSTEM.md`** - система валидации
- **`architecture/CACHING_SYSTEM.md`** - система кэширования
- **`architecture/DESIGN_SYSTEM.md`** - дизайн система
- **`architecture/SHARED_WEBSOCKET.md`** - shared WebSocket с Leader Election
- **`architecture/TTS_ARCHITECTURE.md`** - архитектура TTS
- **`TOKEN_SYSTEM_UNIFIED.md`** - система токенов (OAuth)

### API
- **`api/ADMIN_PANEL_ENDPOINTS_STATUS.md`** - статус endpoints

---

## Структура документации

```
docs/
├── Статус и История
│   ├── CURRENT_STATUS.md          # Главный документ статуса
│   ├── CHANGELOG.md               # История изменений
│   └── README.md                  # Описание проекта
│
├── TTS
│   ├── TTS_ARCHITECTURE.md
│   ├── TTS_CHANNEL_POINTS_MODE.md
│   ├── LOCAL_TTS_INTEGRATION.md
│   ├── VOICE_UPLOAD_UNIFIED.md
│   ├── VOICE_SEPARATION_GLOBAL_USER.md
│   └── ADMIN_VOICE_MANAGEMENT.md
│
├── Безопасность
│   ├── ADMIN_BLOCKING_AND_WHITELIST.md
│   ├── SECURITY_LOGIC.md
│   ├── ACCOUNT_DELETION_SYSTEM.md
│   └── GUEST_MODE_SUPPORT.md
│
├── Channel Points & Drops
│   ├── VK_CHANNEL_POINTS_IMPLEMENTATION.md
│   └── DROPS_SYSTEM.md
│
├── Команды и Интеграции
│   ├── UNIFIED_COMMANDS.md
│   ├── ROLES_REFERENCE.md
│   ├── VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md
│   └── CATEGORY_MAPPING_GUIDE.md
│
├── Админ-Панель
│   ├── ADMIN_PANEL_ENDPOINTS_STATUS.md
│   ├── ADMIN_VOICE_MANAGEMENT.md
│   └── ADMIN_BLOCKING_AND_WHITELIST.md
│
├── Техническая документация
│   ├── ARCHITECTURE_GUIDE.md
│   ├── TOKEN_SYSTEM_UNIFIED.md
│   ├── CACHING_SYSTEM.md
│   ├── SHARED_WEBSOCKET.md
│   ├── COMPREHENSIVE_AUDIT_2025_11_03.md
│   └── ADMIN_PANEL_ENDPOINTS_STATUS.md
│
├── Разработка
│   ├── DEVELOPER_GUIDE.md
│   ├── LLM_DEVELOPMENT_RULES.md
│   ├── DO_NOT_TOUCH.md
│   ├── DEPLOYMENT.md
│   └── QUICK_START.md
```

---

## Как найти нужную информацию

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
- VK Live → `VK_CHANNEL_POINTS_IMPLEMENTATION.md`

**Drops (Лутбоксы):**
- Система Drops → `DROPS_SYSTEM.md`

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

## Поддержка документации

### Правила обновления:

1. **После каждой сессии разработки:**
   - Обновить `CURRENT_STATUS.md`
   - Добавить запись в `CHANGELOG.md`
   - Создать специализированный документ если нужно

2. **При добавлении новой фичи:**
   - Документировать в соответствующем разделе
   - Обновить INDEX (этот файл)

3. **При изменении существующей функциональности:**
   - Обновить соответствующий документ
   - Отметить изменения в `CHANGELOG.md`

4. **При обнаружении устаревшей информации:**
   - Немедленно обновить
   - Проверить связанные документы

### Стандарты документации:

- **Заголовки:** Использовать текстовые категории без эмодзи
- **Даты:** Формат "31 октября 2025"
- **Версии:** Semantic Versioning (1.0.0)
- **Статус:** Работает / Частично / Не работает
- **Code blocks:** Указывать язык (python, javascript, bash)
- **Ссылки:** Использовать относительные пути

---

## Быстрый доступ

### Для новых разработчиков:
1. Начать с `README.md`
2. Прочитать `DEVELOPER_GUIDE.md`
3. Изучить `ARCHITECTURE_GUIDE.md`
4. Прочитать `DO_NOT_TOUCH.md`

### Для AI-ассистентов:
1. Начать с `CURRENT_STATUS.md`
2. Прочитать `LLM_DEVELOPMENT_RULES.md`
3. Использовать `DOCUMENTATION_INDEX.md` для навигации

### Для администраторов:
1. `ADMIN_PANEL_ENDPOINTS_STATUS.md` - все endpoints
2. `ADMIN_VOICE_MANAGEMENT.md` - управление голосами
3. `ADMIN_BLOCKING_AND_WHITELIST.md` - модерация

---

---

---

## Changelog

### Version 3.3.0 (17 декабря 2025)
- Добавлен `architecture/AUDIO_PRIORITY_SYSTEM.md` - система приоритетов аудио
- Добавлен `reports/PROJECT_CLEANUP_REPORT.md` - отчет по очистке проекта
- Удалены устаревшие документы из frontend/ (7 файлов)
- Всего документов: 34 (актуальных)

### Version 3.2.0 (15 ноября 2025)
- Создана папка `reports/` для технических отчетов
- Перенесены отчеты из docs/ в docs/reports/ (4 файла)
- Обновлена структура документации
- Всего документов: 33 (актуальных)

### Version 3.1.0 (15 ноября 2025)
- Добавлен `FINAL_CODE_ANALYSIS_REPORT.md` - финальный анализ перед тестированием
- Обновлен `CURRENT_STATUS.md` - добавлена информация о финальной проверке
- Проверены все документы на актуальность
- Всего документов: 29 (актуальных)

### Version 3.0.0 (14 ноября 2025)
- Удалено 44 устаревших документа:
  - 14 файлов TypeScript Migration (миграция завершена)
  - 8 файлов Architecture Reports (устарели)
  - 6 файлов Audit Reports (устарели)
  - 6 файлов Migration Reports (устарели)
  - 3 файла Testing Reports (устарели)
  - 9 прочих устаревших файлов
- Обновлена структура документации
- Оставлено 28 актуальных документов

---

**Индекс составлен:** 17 декабря 2025  
**Версия:** 3.3.0  
**Всего документов:** 34 (актуальных)  
**Отчеты:** 2 (в docs/reports/)


