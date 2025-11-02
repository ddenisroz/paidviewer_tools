# 🚀 Quick Reference - Шпаргалка

Быстрый доступ к самым нужным командам и операциям.

---

## 📦 Установка и запуск

```bash
# Установить зависимости
npm install
cd bot_service && pip install -r requirements.txt

# Запустить оба сервера
npm run dev          # Frontend на localhost:5173
python main.py       # Backend на localhost:8000

# Только frontend
npm run dev

# Только backend
cd bot_service && python main.py
```

---

## 🛠️ Часто используемые команды

### Frontend

```bash
npm run dev          # Dev сервер с hot reload
npm run build        # Production build
npm run preview      # Preview production build
npm run fix-logs     # Заменить console.log на logger
npm run lint         # ESLint проверка
```

### Backend

```bash
python main.py                           # Запуск сервера
python scripts/clear_database.py clear   # Очистить БД (с бэкапом)
python scripts/clear_database.py restore # Восстановить БД из бэкапа
python scripts/init_blocked_bots.py      # Инициализировать заблокированные боты
```

---

## 🗄️ Работа с БД

### Очистить БД

```bash
cd bot_service
python scripts/clear_database.py clear
# ✅ Создаст backup, потом удалит БД
```

### Восстановить БД

```bash
cd bot_service
python scripts/clear_database.py restore
# ✅ Восстановит из последнего backup

# Восстановить конкретный backup
python scripts/clear_database.py restore --backup "app_data_backup_20251101_120000.db"
```

### Список backups

```bash
cd bot_service
python scripts/clear_database.py list
# ✅ Покажет все доступные backup'ы
```

---

## 🔐 Переменные окружения

### Где их найти

- **Frontend:** `frontend/.env.local` (если нужны)
- **Backend:** `bot_service/.env`

### Минимальные переменные

```env
# bot_service/.env
TWITCH_BOT_TOKEN=xxx
TWITCH_CLIENT_ID=xxx
TWITCH_CLIENT_SECRET=xxx
VK_TOKEN=xxx
ENVIRONMENT=development
```

---

## 🐛 Debug и Troubleshooting

### Проблема: Порт 8000 уже занят

```bash
# Найди процесс на порту 8000
lsof -i :8000      # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Убей процесс
kill -9 <PID>      # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### Проблема: Фронтенд не видит backend

```bash
# 1. Проверь что backend запущен
curl http://localhost:8000/health

# 2. Если не отвечает, проверь .env
grep API_BASE_URL frontend/src/constants.js
# Должно быть: http://localhost:8000

# 3. Очистить cache
npm run build && npm run preview
```

### Проблема: БД заблокирована

```bash
# SQLite может заблокироваться при одновременных операциях
# Решение: перезапусти backend

cd bot_service
python main.py
```

### Посмотреть логи

```bash
# Backend логи
tail -f bot_service/logs/app.log

# Frontend консоль (в browser DevTools)
F12 → Console tab

# Структурированные логи backend
tail -f bot_service/logs/app_*.log
```

---

## 🔄 API Endpoints (основные)

### Auth

```
POST   /auth/twitch/callback          # Twitch OAuth callback
POST   /auth/vk/callback              # VK OAuth callback
GET    /api/auth/status               # Статус авторизации
POST   /api/auth/logout               # Выход
```

### TTS

```
POST   /api/tts/synthesize            # Синтез речи
GET    /api/tts/health                # Статус TTS
POST   /api/tts/disable               # Отключить TTS
POST   /api/tts/voices                # Загрузить голос
```

### YouTube

```
POST   /api/youtube/queue             # Добавить видео в очередь
GET    /api/youtube/queue             # Получить очередь
DELETE /api/youtube/queue/:id         # Удалить видео
```

### Points (Баллы)

```
POST   /api/points/add                # Добавить баллы
POST   /api/points/deduct             # Вычесть баллы
GET    /api/points/balance            # Получить баланс
```

---

## 📝 Обновление документации

### Основной README

```bash
nano README.md       # Главный файл для новых пользователей
```

### Полный индекс документации

```bash
nano docs/README.md  # Полный индекс всех документов
```

### Для разработчиков

```bash
nano docs/DEVELOPER_GUIDE.md      # Паттерны и примеры
nano docs/ARCHITECTURE_GUIDE.md   # Архитектура системы
```

### Для AI-агентов

```bash
nano docs/LLM_DEVELOPMENT_RULES.md  # ОБЯЗАТЕЛЬНО читать!
nano docs/DO_NOT_TOUCH.md           # Что НЕ менять
nano docs/CURRENT_STATUS.md         # Что работает/сломано
```

---

## 🎯 Типичные задачи

### Добавить новый API endpoint

1. Создать функцию в `bot_service/api/xxx_api.py`
2. Добавить `@router.post/get(...)`
3. Использовать `@get_current_user` для auth
4. Вернуть JSON response

```python
from fastapi import APIRouter, Depends
from auth.auth import get_current_user

router = APIRouter(prefix="/api/feature", tags=["feature"])

@router.post("/create")
async def create_feature(
    data: MyModel,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Твой код
    return {"success": True}
```

### Добавить React компонент

```bash
# 1. Создать файл
touch frontend/src/components/MyComponent.jsx

# 2. Написать компонент
# 3. Импортировать где нужно
# 4. Использовать Context API если нужны данные
```

### Исправить console.log'и

```bash
# Автоматически заменит все console.log на logger
npm run fix-logs

# Или вручную
import { logger } from '@/utils/prodLogger';

logger.log('message');
logger.error('error');
logger.warn('warning');
```

---

## 🔗 Полезные ссылки

| Ссылка | Описание |
|--------|----------|
| [README.md](../README.md) | Главный README для всех |
| [docs/README.md](README.md) | Полный индекс документации |
| [docs/CURRENT_STATUS.md](CURRENT_STATUS.md) | Что работает / что сломано |
| [docs/LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md) | Правила для AI-агентов |
| [docs/QUICK_START.md](QUICK_START.md) | Полный гайд установки |
| [docs/DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Паттерны и best practices |

---

## 💡 Pro Tips

### Быстро открыть в VS Code

```bash
code .              # Открыть проект
code frontend/      # Открыть только frontend
code bot_service/   # Открыть только backend
```

### Горячие клавиши IDE

```
Ctrl+Shift+F        # Глобальный поиск
Ctrl+`              # Terminal в VS Code
Ctrl+G              # Go to line
Ctrl+P              # Quick file open
```

### Git коммиты

```bash
# Коммит с хорошим сообщением
git commit -m "feat: add TTS feature"
git commit -m "fix: resolve console.log issue"
git commit -m "docs: update README"

# Push
git push origin main
```

---

**Последнее обновление:** November 1, 2025  
**Версия:** 0.9.5

