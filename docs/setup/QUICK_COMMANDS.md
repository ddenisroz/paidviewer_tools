# ⚡ Быстрые команды

Шпаргалка для ежедневной работы с проектом.

## 🚀 Разработка

```bash
# Первый запуск
npm run setup           # Настройка среды разработки

# Запуск сервисов
npm run dev:frontend    # Frontend (React) на http://localhost:5173
npm run dev:bot         # Bot Service (FastAPI) на http://localhost:8001  
npm run dev:tts         # TTS Service на http://localhost:8002

# Сборка
npm run build           # Сборка frontend для продакшена
```

## 🔄 Обновления

```bash
npm run update          # Автоматическое обновление проекта
git pull origin main    # Ручное получение обновлений
```

## 🌐 Продакшен

```bash
# Деплой
npm run deploy          # Полный деплой на VPS

# Управление сервисами
npm run start           # Запуск всех сервисов
npm run stop            # Остановка всех сервисов
npm run restart         # Перезапуск всех сервисов

# Отдельные сервисы
npm run restart:frontend    # Только frontend
npm run restart:bot         # Только bot service

# Мониторинг
npm run status          # Статус сервисов
npm run logs            # Все логи
npm run logs:bot        # Логи bot service
npm run logs:frontend   # Логи frontend
```

## 🐛 Отладка

```bash
# Проверка здоровья сервисов
curl http://localhost:8001/health    # Bot service
curl http://localhost:8002/health    # TTS service

# Проверка продакшена
curl https://yourdomain.com/api/health
curl https://your-tunnel.trycloudflare.com/health
```

## 📝 Git

```bash
# Быстрый коммит
git add . && git commit -m "Описание изменений" && git push

# Проверка статуса
git status
git log --oneline -10   # Последние 10 коммитов
```

## 🔧 Docker (продакшен)

```bash
# Пересборка с нуля
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Очистка неиспользуемых образов
docker system prune -a

# Вход в контейнер
docker exec -it tts_bot_service_prod bash
```

## 📁 Быстрое редактирование

```bash
# Основные файлы для изменений:
code frontend/src/App.jsx              # Роуты и основная структура
code frontend/src/components/          # UI компоненты
code bot_service/main.py               # API эндпоинты
code tts_service/main.py               # TTS логика
code .env.production                   # Продакшен настройки
```

## 🔍 Полезные ссылки

- **Frontend (dev):** http://localhost:5173
- **Bot API (dev):** http://localhost:8001/docs
- **TTS API (dev):** http://localhost:8002/docs  
- **Продакшен:** https://yourdomain.com
- **Логи:** `npm run logs`

---

**Сохраните эту шпаргалку в закладки!** 📌
