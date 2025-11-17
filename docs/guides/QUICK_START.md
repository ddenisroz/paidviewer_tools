# 🚀 Quick Start Guide

## Быстрый старт для разработчиков

### 📋 Предварительные требования

- Python 3.11+
- Node.js 18+
- npm или yarn
- Docker (для production)

### 🔧 Установка

```bash
# 1. Клонировать репозиторий
git clone <repository-url>
cd TTS_TTV_0.02

# 2. Установить зависимости frontend
cd frontend
npm install
cd ..

# 3. Установить зависимости backend
cd bot_service
pip install -r requirements.txt
cd ..

# 4. Настроить переменные окружения
cp bot_service/.env.example bot_service/.env
# Отредактируйте bot_service/.env с вашими токенами
```

### 🏃 Запуск в dev режиме

```bash
# Терминал 1: Frontend
npm run dev:frontend

# Терминал 2: Bot Service
npm run dev:bot

# Терминал 3: TTS Service (опционально)
npm run dev:tts
```

Откройте http://localhost:5173

### 🎨 Работа с Design System

```bash
# Проверить соответствие Design System
npm run check:design

# Посмотреть примеры компонентов
# Откройте frontend/src/components/examples/DesignSystemExample.tsx
```

### 📚 Важные документы

1. **[DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)** - Правила дизайна (ЧИТАТЬ ПЕРВЫМ!)
2. **[PRIORITY_FIXES.md](./PRIORITY_FIXES.md)** - Текущие задачи
3. **[SESSION_SUMMARY.md](./SESSION_SUMMARY.md)** - Последние изменения
4. **[DO_NOT_TOUCH.md](./docs/DO_NOT_TOUCH.md)** - Защищенные файлы

### ✅ Чек-лист перед началом работы

- [ ] Прочитал DESIGN_SYSTEM.md
- [ ] Запустил все сервисы
- [ ] Проверил консоль на ошибки
- [ ] Знаю, какие файлы нельзя трогать (DO_NOT_TOUCH.md)

### 🐛 Частые проблемы

#### 403 на /api/points/platform/rewards
**Причина**: Вы не партнёр/аффилейт Twitch  
**Решение**: Это нормально, ошибка обрабатывается автоматически

#### ERR_CONNECTION_REFUSED на localhost:8001
**Причина**: TTS сервис не запущен  
**Решение**: `npm run dev:tts`

#### getUsers not implemented
**Причина**: Старая версия кода  
**Решение**: Обновите код, проблема исправлена

### 🔑 Основные команды

```bash
# Development
npm run dev:frontend    # Запустить frontend
npm run dev:bot        # Запустить bot service
npm run dev:tts        # Запустить TTS service

# Production
npm start              # Запустить все сервисы
npm stop               # Остановить все сервисы
npm restart            # Перезапустить все сервисы
npm run logs           # Посмотреть логи

# Quality checks
npm run check:design   # Проверить Design System
npm run build          # Собрать frontend

# Status
npm status             # Статус сервисов
```

### 📝 Правила разработки

#### 1. Используйте Design System
```tsx
// ❌ ПЛОХО
<Button className="h-11 px-5">Кнопка</Button>

// ✅ ХОРОШО
<Button className="h-10 px-4">Кнопка</Button>
```

#### 2. Используйте стандартные отступы
```tsx
// ❌ ПЛОХО
<div className="gap-[17px] p-[13px]">

// ✅ ХОРОШО
<div className="gap-4 p-4">
```

#### 3. Используйте CSS переменные для цветов
```tsx
// ❌ ПЛОХО
<div className="bg-blue-500">

// ✅ ХОРОШО
<div className="bg-primary">
```

#### 4. Проверяйте код перед коммитом
```bash
npm run check:design
```

### 🎯 Структура проекта

```
TTS_TTV_0.02/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/   # React компоненты
│   │   ├── pages/        # Страницы
│   │   ├── styles/       # CSS и design tokens
│   │   └── utils/        # Утилиты
│   └── package.json
├── bot_service/          # FastAPI backend
│   ├── api/             # API endpoints
│   ├── auth/            # Аутентификация
│   ├── core/            # Ядро приложения
│   └── main.py
├── tts_service/         # TTS микросервис
├── docs/                # Документация
└── scripts/             # Утилиты

```

### 🔗 Полезные ссылки

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **TTS Service**: http://localhost:8001
- **API Docs**: http://localhost:8000/docs

### 💡 Советы

1. **Всегда проверяйте консоль** - многие ошибки видны только там
2. **Используйте React DevTools** - для отладки компонентов
3. **Читайте логи backend** - `npm run logs:bot`
4. **Проверяйте Network tab** - для отладки API запросов
5. **Используйте Design System** - это экономит время

### 🆘 Нужна помощь?

1. Проверьте [PRIORITY_FIXES.md](./PRIORITY_FIXES.md) - возможно, это известная проблема
2. Посмотрите [SESSION_SUMMARY.md](./SESSION_SUMMARY.md) - что было сделано недавно
3. Прочитайте [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) - правила дизайна
4. Проверьте логи: `npm run logs`

### 🎉 Готово!

Теперь вы готовы к разработке. Удачи! 🚀

---

**Последнее обновление**: 15 ноября 2025
