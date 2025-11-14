# 🚀 Быстрый старт TTS_TTV_0.02

## Запуск проекта

### 1. Запуск бэкенда (обязательно!)

```bash
cd bot_service
python main.py
```

**Проверка:** Откройте http://localhost:8000/docs - должна открыться документация API

### 2. Запуск фронтенда

```bash
cd frontend
npm run dev
```

**Проверка:** Откройте http://localhost:5173/ - должен открыться интерфейс

---

## ⚠️ Если бэкенд не запущен

Фронтенд будет работать, но с ограничениями:

- ❌ Нет Twitch badges (значков пользователей)
- ❌ Нет TTS функционала
- ❌ Нет истории чата
- ❌ Нет интеграций с платформами

**Решение:** Запустите бэкенд (см. пункт 1)

---

## 🔧 Проверка портов

```bash
# Windows PowerShell
Test-NetConnection -ComputerName localhost -Port 8000  # Backend
Test-NetConnection -ComputerName localhost -Port 5173  # Frontend
```

---

## 📝 Переменные окружения

### Backend (.env в bot_service/)
Должен быть настроен файл `.env` с:
- Twitch API credentials
- VK API credentials
- Database settings

### Frontend (.env в frontend/)
Уже настроен правильно:
- `VITE_BOT_SERVICE_URL=http://localhost:8000`
- `VITE_TTS_SERVICE_URL=http://localhost:8001`

---

## 🐛 Частые проблемы

### 1. "Failed to load badges" в консоли
**Причина:** Бэкенд не запущен  
**Решение:** Запустите `cd bot_service && python main.py`

### 2. Стили не загружаются (белый экран)
**Причина:** Tailwind не компилирует TypeScript файлы  
**Решение:** Уже исправлено в `tailwind.config.js`

### 3. "enabled must be boolean" ошибка
**Причина:** React Query v5 требует строгий boolean  
**Решение:** Уже исправлено (используется `!!isAuthenticated`)

---

## ✅ Проверка что все работает

1. ✅ Бэкенд: http://localhost:8000/docs открывается
2. ✅ Фронтенд: http://localhost:5173/ открывается
3. ✅ Консоль браузера: нет красных ошибок
4. ✅ Стили загружены: интерфейс выглядит нормально

---

## 📚 Дополнительно

- Полный аудит: `AUDIT_REPORT.md`
- Документация: `docs/` папка
- Архитектура: `docs/ARCHITECTURE_OVERVIEW.md`
